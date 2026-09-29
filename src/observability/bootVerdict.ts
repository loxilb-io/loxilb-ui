//---------------------------------------------------------
// Boot verdict — one line for how this gateway process booted its config
//---------------------------------------------------------
// Inputs are two independent reads: `boot` from GET /diagnostics and the
// `loxilb_boot_config_conflict_total` counter. Both describe the CURRENT
// process only (the counter resets with it, and a process boots once), so
// the conflict is a yes/no for this boot, never a history.
//
// Gateway semantics (api/loxinlp/nlp.go, api/models/boot_status.go):
//   - `degraded` — the boot snapshot restore failed and was quarantined.
//     Strict boots EMPTY; compat may replay legacy *.txt (`legacy_fallback`).
//   - `succeeded` — set only when a found snapshot was fully applied.
//   - `snapshot_found` without `succeeded` or `degraded` is not a failure:
//     the file vanished before the read, or the boot is still recording.
//     With no snapshot found there was nothing to restore at all.

export interface IBootStatus {
	degraded?: boolean;
	legacy_fallback?: boolean;
	profile?: string;
	quarantine_path?: string;
	snapshot_found?: boolean;
	succeeded?: boolean;
}

export type BootVerdict =
	| {kind: 'degraded'; legacyFallback: boolean; quarantinePath?: string}
	| {kind: 'conflict'}
	| {kind: 'restored'; profile?: string}
	| {kind: 'not-restored'; profile?: string}
	| {kind: 'unknown'};

/**
 * `conflicts` is the counter's value, or undefined when the family is absent
 * — absent is not zero, so it never contributes a verdict of its own.
 * A degraded boot outranks the conflict: the conflict only says which
 * artifact was chosen, the degraded flag says the chosen one did not apply.
 */
export function bootVerdict(boot: IBootStatus | undefined, conflicts: number | undefined): BootVerdict {
	if (boot?.degraded) {
		return {kind: 'degraded', legacyFallback: boot.legacy_fallback === true, quarantinePath: boot.quarantine_path || undefined};
	}
	if (conflicts !== undefined && conflicts > 0) return {kind: 'conflict'};
	if (!boot) return {kind: 'unknown'};
	const profile = boot.profile || undefined;
	return boot.snapshot_found && boot.succeeded ? {kind: 'restored', profile} : {kind: 'not-restored', profile};
}
