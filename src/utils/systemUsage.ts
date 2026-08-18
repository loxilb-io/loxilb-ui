//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IFilesystemAttribute} from 'types/filesystem';
import {IProcessAttribute} from 'types/process';

//---------------------------------------------------------
// System usage derived from the /status/* endpoints
//---------------------------------------------------------
// Upstream loxilb publishes no `system_*_utilization` Prometheus series, but
// both backends do serve /status/process (top), /status/filesystem (df) and
// /status/device (uptime, hostnamectl) — the dashboard already fetches all
// three for the System Information block. These helpers turn that data into
// the CPU/memory/disk percentages the pies want, so the card shows real
// numbers on loxilb instead of N/A.
//
// The Prometheus gauge stays authoritative wherever it exists (the gateway):
// it measures the whole system directly, while `top` can only be summed over
// the processes it happened to list. Callers prefer the gauge and fall back
// to these — see SystemUsageCard.

// Where a displayed percentage came from, so the UI can say so rather than
// implying every number carries the same weight.
export type UsageSource = 'metrics' | 'top' | 'df';

export interface IDerivedUsage {
	percent: number;
	source: UsageSource;
	// Short human-readable detail (mount point, process count) for the caption.
	detail?: string;
}

// `top`/`df` fields arrive as strings ("5.1", "74%", "0"). Anything that isn't
// a finite number is dropped rather than coerced to 0 — a missing field must
// not read as "measured zero". Note the live loxilb scrape does return process
// rows with no CPUUsage/MemoryUsage at all (the `top` process itself).
function parse_percent(value: string | undefined): number | undefined {
	if (value === undefined) return undefined;
	const parsed = Number(String(value).trim().replace(/%$/, ''));
	return Number.isFinite(parsed) ? parsed : undefined;
}

// Sum a per-process percentage column from `top`.
//
// Precision note: this is the sum over the rows `top` returned, which is a
// close proxy for total utilization on a container/appliance running a handful
// of processes (the loxilb deployment shape) but a lower bound wherever the
// list is truncated. %CPU is also per-core normalized, so a multi-threaded
// process can exceed 100 on its own and the sum is clamped. That imprecision
// is why the card labels these values with their source.
function sum_process_column(processes: IProcessAttribute[], pick: (p: IProcessAttribute) => string | undefined): {total: number; counted: number} {
	let total = 0;
	let counted = 0;
	for (const process of processes) {
		const value = parse_percent(pick(process));
		if (value === undefined) continue;
		total += value;
		counted += 1;
	}
	return {total, counted};
}

function clamp_percent(value: number): number {
	return Math.min(Math.max(value, 0), 100);
}

// CPU utilization ≈ Σ %CPU across the processes `top` reported.
// Returns undefined when no row carried a usable CPUUsage, so the card can
// keep saying N/A instead of drawing a 0% pie.
export function derive_cpu_usage(processes: IProcessAttribute[] | undefined): IDerivedUsage | undefined {
	if (!processes?.length) return undefined;
	const {total, counted} = sum_process_column(processes, p => p.CPUUsage);
	if (counted === 0) return undefined;
	return {percent: clamp_percent(total), source: 'top', detail: `${counted}`};
}

// Memory utilization ≈ Σ %MEM (RSS as a share of total RAM) across processes.
// Shared pages are counted once per process, so this can read slightly high.
export function derive_memory_usage(processes: IProcessAttribute[] | undefined): IDerivedUsage | undefined {
	if (!processes?.length) return undefined;
	const {total, counted} = sum_process_column(processes, p => p.MemoryUsage);
	if (counted === 0) return undefined;
	return {percent: clamp_percent(total), source: 'top', detail: `${counted}`};
}

// Disk utilization straight from `df` — exact, unlike the two above.
//
// `df` lists every mount including container pseudo-filesystems (tmpfs, shm,
// overlay bind targets such as /etc/hosts). Summing them would be meaningless,
// so we report a single mount: `/` when present, otherwise the largest real
// filesystem, so a host deployment whose root is not listed still shows
// something truthful. Pseudo-filesystems are never chosen on their own.
const PSEUDO_FILESYSTEM_TYPES = new Set(['tmpfs', 'devtmpfs', 'squashfs', 'ramfs', 'overlay']);

// "96G" / "1.6G" / "24M" / "0" → bytes, for picking the biggest mount.
function parse_size_to_bytes(size: string | undefined): number {
	if (!size) return 0;
	const match = String(size).trim().match(/^([0-9.]+)\s*([KMGTP]?)i?B?$/i);
	if (!match) return 0;
	const value = Number(match[1]);
	if (!Number.isFinite(value)) return 0;
	const scale: Record<string, number> = {'': 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4, P: 1024 ** 5};
	return value * (scale[match[2].toUpperCase()] ?? 1);
}

export function derive_disk_usage(filesystems: IFilesystemAttribute[] | undefined): IDerivedUsage | undefined {
	if (!filesystems?.length) return undefined;

	const usable = filesystems.filter(fs => parse_percent(fs.usePercent) !== undefined);
	if (!usable.length) return undefined;

	const root = usable.find(fs => fs.mountedOn === '/');
	const real = usable.filter(fs => !PSEUDO_FILESYSTEM_TYPES.has((fs.type ?? '').toLowerCase()));
	const candidates = real.length ? real : usable;
	const largest = candidates.reduce((biggest, fs) => (parse_size_to_bytes(fs.size) > parse_size_to_bytes(biggest.size) ? fs : biggest), candidates[0]);

	const chosen = root ?? largest;
	const percent = parse_percent(chosen.usePercent);
	if (percent === undefined) return undefined;

	return {percent: clamp_percent(percent), source: 'df', detail: chosen.mountedOn};
}
