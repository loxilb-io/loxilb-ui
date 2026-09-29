//---------------------------------------------------------
// Observability pages — absent is not zero, omitted is not unknown
//---------------------------------------------------------
// The page-level half of GatewaySummaryCards.test.tsx: the same three values
// are rendered again on their own pages, and a fix to the card alone would
// leave the page telling the operator the opposite.
//   - PdKv "Enforcement faults" counted the series of a family the gateway
//     never exported and printed 0 ("measured, none faulted") — now a
//     verdict line that says "not reported" instead;
//   - Workers "Workers tracked" printed N/A for `worker_count`, which the
//     gateway omits (omitempty) precisely when it is 0;
//   - Persistence "Last persist" / "Last restore" printed N/A for records
//     /diagnostics omits until the first successful persist or restore.

import 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from 'observability/parser';
import PdKvPage from './PdKvPage';
import PersistencePage from './PersistencePage';
import QosPage from './QosPage';
import SecurityPage from './SecurityPage';
import WorkersPage from './WorkersPage';

const state = vi.hoisted(() => ({
	history: [] as IMetricsSnapshot[],
	gpu: undefined as unknown,
	workers: undefined as unknown,
	diagnostics: undefined as unknown,
	policies: undefined as unknown,
}));

vi.mock('hooks/instanceHook', () => ({
	useInstanceFromURL: () => ({id: 1, name: 'gw'}),
}));

vi.mock('hooks/query/flavorHook', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/flavorHook')>();
	return {
		...mod,
		useInstanceCapabilities: () => ({
			flavor: 'inference-gateway',
			resolved: true,
			resolution: {state: 'resolved', flavor: 'inference-gateway'},
			hasFeature: () => true,
			hasField: () => true,
			hasMethod: () => true,
			allowedEnum: <T,>(_c: string, v: T[]) => v,
		}),
	};
});

vi.mock('hooks/query/observabilityHooks', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/observabilityHooks')>();
	return {
		...mod,
		useObservabilityCadence: () => [10_000, () => undefined],
		useMetricsSnapshot: () => ({
			snapshot: state.history[state.history.length - 1],
			history: state.history,
			isLoading: false,
			flavor: 'inference-gateway' as const,
			cadenceMs: 10_000 as const,
			refetch: () => undefined,
		}),
	};
});

vi.mock('hooks/query/gatewayTelemetryHooks', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/gatewayTelemetryHooks')>();
	return {
		...mod,
		useGpuStatus: () => ({data: state.gpu, isLoading: false, error: null, refetch: () => undefined}),
		useWorkerMetrics: () => ({data: state.workers, isLoading: false, error: null, refetch: () => undefined}),
		useDiagnostics: () => ({data: state.diagnostics, isLoading: false, error: null, refetch: () => undefined}),
	};
});

vi.mock('hooks/query/queryHooks', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/queryHooks')>();
	return {...mod, useLoadBalancerConfig: () => ({data: [], refetch: () => undefined}), useQOSPolicies: () => ({data: state.policies, refetch: () => undefined})};
});

const T0 = 1_000_000;

function snapshotOf(text: string, receivedAtMs: number): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {instanceId: 1, flavor: 'inference-gateway', receivedAtMs, available: true, families: parsed.families, diagnostics: parsed.diagnostics};
}

// StatRow renders label and value as siblings; assert the value cell alone,
// so "0" cannot be satisfied by a digit somewhere in the label.
const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

function renderPage(page: JSX.Element) {
	render(<MemoryRouter>{page}</MemoryRouter>);
}

afterEach(() => {
	cleanup();
	state.history = [];
	state.gpu = undefined;
	state.workers = undefined;
	state.diagnostics = undefined;
	state.policies = undefined;
});

describe('PdKvPage — KV attestation verdict', () => {
	const attest = (rules: string[], faults?: number[]) =>
		snapshotOf(
			[
				...rules.map(r => `loxilb_ai_kv_attest_state{rule="${r}",state="READY"} 1`),
				...(faults ?? []).map((v, i) => `loxilb_ai_kv_enforcement_fault{rule="${rules[i]}"} ${v}`),
			].join('\n'),
			T0,
		);

	it('says no rule is attesting when the gateway exports no ladder state', () => {
		// No strict KV-exact rule → both families absent. Not "0 faults".
		state.history = [snapshotOf('loxilb_pd_sessions_active 0', T0)];
		renderPage(<PdKvPage />);
		expect(screen.getByText(/No rule reports a KV attestation state/)).toBeTruthy();
		expect(screen.queryByText(/none with an enforcement fault/)).toBeNull();
	});

	it('does not call an unreported fault state "none faulted"', () => {
		state.history = [attest(['a', 'b'])];
		renderPage(<PdKvPage />);
		expect(screen.getByText('2 rules under strict KV attestation. The enforcement-fault state is not reported.')).toBeTruthy();
	});

	it('counts the faulted rules as an error, and a true zero as healthy', () => {
		state.history = [attest(['a', 'b'], [1, 0])];
		renderPage(<PdKvPage />);
		const alert = screen.getByText('1 of 2 rules under strict KV attestation report an enforcement fault.');
		expect(alert.closest('[role="alert"]')?.className).toMatch(/Error/);
		cleanup();

		state.history = [attest(['a', 'b'], [0, 0])];
		renderPage(<PdKvPage />);
		expect(screen.getByText('2 rules under strict KV attestation, none with an enforcement fault.')).toBeTruthy();
	});

	it('shows probe failures only when there are some', () => {
		// A lazy CounterVec{reason}: no child on a clean ladder. The old rate
		// row read "Warming up…" forever there.
		state.history = [attest(['a'], [0])];
		renderPage(<PdKvPage />);
		expect(screen.queryByText(/probe failures/)).toBeNull();
		expect(screen.queryByText('Warming up…')).toBeNull();
		cleanup();

		state.history = [
			snapshotOf(
				[
					'loxilb_ai_kv_attest_state{rule="a",state="DEGRADED"} 1',
					'loxilb_ai_kv_enforcement_fault{rule="a"} 0',
					'loxilb_ai_kv_attest_probe_fail_total{reason="identity_mismatch"} 2',
					'loxilb_ai_kv_attest_probe_fail_total{reason="timeout"} 3',
				].join('\n'),
				T0,
			),
		];
		renderPage(<PdKvPage />);
		expect(screen.getByText('5 attestation probe failures since the gateway started.')).toBeTruthy();
	});
});

describe('WorkersPage — omitempty worker_count', () => {
	const gpu = (data: Record<string, unknown>) => ({receivedAtMs: T0, data: {enabled: true, routing_mode: 'gpu_aware', ...data}});

	it('reads an omitted worker_count as 0, not N/A', () => {
		state.gpu = gpu({});
		renderPage(<WorkersPage />);
		expect(valueOf('Workers tracked')).toBe('0');
	});

	it('shows the stated count when the gateway sends one', () => {
		state.gpu = gpu({worker_count: 3});
		renderPage(<WorkersPage />);
		expect(valueOf('Workers tracked')).toBe('3');
	});
});

// The compact trim: "Preemptions (as reported)" was caller-supplied and
// unverified, "GPU blocks" a static capacity. The queue and KV-cache columns
// stay because REST is the only source for them.
describe('WorkersPage — compact', () => {
	const ready = (data: Record<string, unknown> = {}) => ({receivedAtMs: T0, data: {enabled: true, routing_mode: 'gpu_aware', worker_count: 1, ebpf_map_loaded: true, ...data}});

	it('drops the preemption and GPU block columns and the redundant rows', () => {
		state.gpu = ready();
		state.workers = {receivedAtMs: T0, data: [{endpoint_ip: '10.0.0.1', queued_requests: 2, swapped_requests: 7, kv_cache_usage_perc: 40, num_gpu_blocks: 900}]};
		renderPage(<WorkersPage />);
		expect(screen.queryByText('Preemptions (as reported)')).toBeNull();
		expect(screen.queryByText('GPU blocks')).toBeNull();
		expect(screen.queryByText('7')).toBeNull();
		expect(screen.queryByText('900')).toBeNull();
		// "Enabled" is the page state, and a loaded map is not news.
		expect(screen.queryByText('Enabled')).toBeNull();
		expect(screen.queryByText(/eBPF map/)).toBeNull();
		expect(screen.getByText('Queued requests')).toBeTruthy();
		expect(screen.getByText('KV cache used')).toBeTruthy();
	});

	it('warns when the eBPF map is not loaded, including when the field is omitted', () => {
		// omitempty on the gateway: an omitted bool IS false.
		for (const data of [{ebpf_map_loaded: false}, {ebpf_map_loaded: undefined}]) {
			state.gpu = ready(data);
			renderPage(<WorkersPage />);
			const alert = screen.getByText(/worker-statistics eBPF map as not loaded/);
			expect(alert.closest('[role="alert"]')?.className).toMatch(/Warning/);
			cleanup();
		}
	});
});

// The gateway's pull of each engine's /metrics for load-aware P/D selection.
// One verdict line, above the frame: the scraper serves P/D rules whether or
// not GPU monitoring is enabled.
describe('WorkersPage — engine-metrics scrape verdict', () => {
	const T1 = T0 + 10_000;
	const scrape = (ok: number, unparseable: number, at: number) =>
		snapshotOf(
			['ok', 'unparseable', 'unreachable', 'http_error', 'body_error', 'bad_request', 'unknown']
				.map(r => `loxilb_ai_worker_scrape_total{result="${r}"} ${r === 'ok' ? ok : r === 'unparseable' ? unparseable : 0}`)
				.join('\n'),
			at,
		);

	it('⭐⭐ says so when not one scrape has parsed since start — even with GPU monitoring disabled', () => {
		// The live testbed's state: unparseable 39k, ok 0.
		state.gpu = {receivedAtMs: T0, data: {enabled: false}};
		state.history = [scrape(0, 39150, T0)];
		renderPage(<WorkersPage />);
		const alert = screen.getByText(/None of the 39150 engine-metrics scrapes since the gateway started could be parsed/);
		expect(alert.closest('[role="alert"]')?.className).toMatch(/Error/);
	});

	it('warns with the failed share when some scrapes in the window fail', () => {
		state.gpu = {receivedAtMs: T0, data: {enabled: false}};
		state.history = [scrape(100, 0, T0), scrape(130, 10, T1)];
		renderPage(<WorkersPage />);
		expect(screen.getByText(/25\.0% of engine-metrics scrapes in the last window failed/)).toBeTruthy();
	});

	it('is silent when idle, when healthy, and when the family is absent', () => {
		state.gpu = {receivedAtMs: T0, data: {enabled: false}};
		for (const history of [[scrape(0, 0, T0)], [scrape(100, 0, T0), scrape(130, 0, T1)], [snapshotOf('loxilb_pd_sessions_active 0', T0)]]) {
			state.history = history;
			renderPage(<WorkersPage />);
			expect(screen.queryByText(/engine-metrics scrapes/)).toBeNull();
			cleanup();
		}
	});
});

describe('PersistencePage — auto_persist sent only while failing', () => {
	const diagnostics = (data: Record<string, unknown>) => ({receivedAtMs: T0, data: {ready: true, maintenance_state: 'active', uptime_seconds: 1, version: 'v', ...data}});

	it('shows no last-error row while auto-persist is healthy (the gateway omits the record)', () => {
		state.history = [snapshotOf('loxilb_config_dirty 0', T0)];
		state.diagnostics = diagnostics({});
		renderPage(<PersistencePage />);
		expect(screen.queryByText('Auto-persist last error')).toBeNull();
	});

	it('shows the last error while the gateway reports failures, and warns from the gauge', () => {
		state.history = [snapshotOf('loxilb_autopersist_consecutive_failures 4', T0)];
		state.diagnostics = diagnostics({auto_persist: {consecutive_failures: 4, last_error: 'disk full'}});
		renderPage(<PersistencePage />);
		expect(valueOf('Auto-persist last error')).toBe('disk full');
		const alert = screen.getByText(/Auto-persist has failed 4 times in a row/);
		expect(alert.closest('[role="alert"]')?.className).toMatch(/Warning/);
	});
});

describe('PersistencePage — compact', () => {
	it('drops the breakdowns that moved to Grafana', () => {
		state.history = [
			snapshotOf(
				[
					'loxilb_config_dirty 0',
					'loxilb_persist_total{result="ok"} 9',
					'loxilb_snapshot_total{trigger="manual"} 3',
					'loxilb_restore_total{mode="commit",result="ok"} 2',
				].join('\n'),
				T0,
			),
		];
		state.diagnostics = {receivedAtMs: T0, data: {ready: true, maintenance_state: 'active', uptime_seconds: 1, version: 'v', last_persist: {generation: 7, mode: 'manual', at: new Date(T0).toISOString()}}};
		renderPage(<PersistencePage />);
		for (const gone of ['Persist attempts', 'Snapshots by trigger', 'Restores', 'Last persist generation', 'Last persist trigger', 'Legacy boot fallbacks']) {
			expect(screen.queryByText(gone)).toBeNull();
		}
		expect(screen.queryByText(/^Persists/)).toBeNull();
		expect(screen.queryByRole('table')).toBeNull();
		expect(screen.queryByText('7')).toBeNull();
	});

	it('warns on quarantined snapshots only above zero', () => {
		state.history = [snapshotOf('loxilb_snapshot_quarantine_total 1', T0)];
		renderPage(<PersistencePage />);
		expect(screen.getByText(/1 saved snapshots were quarantined/)).toBeTruthy();
		cleanup();
		state.history = [snapshotOf('loxilb_snapshot_quarantine_total 0', T0)];
		renderPage(<PersistencePage />);
		expect(screen.queryByText(/quarantined after/)).toBeNull();
	});
});

// `succeeded` is set only for a fully applied snapshot restore. With no
// snapshot found nothing was restored and nothing failed, yet the old row
// read "Boot restore succeeded: No". Now one verdict line.
describe('PersistencePage — boot verdict', () => {
	const boot = (b: Record<string, unknown>) => ({receivedAtMs: T0, data: {ready: true, maintenance_state: 'active', uptime_seconds: 1, version: 'v', boot: {profile: 'strict', legacy_fallback: false, degraded: false, ...b}}});
	const severity = (re: RegExp) => screen.getByText(re).closest('[role="alert"]')?.className;

	it('⭐ no snapshot found is information, not a failure', () => {
		state.history = [snapshotOf('loxilb_boot_config_conflict_total 0', T0)];
		state.diagnostics = boot({snapshot_found: false, succeeded: false});
		renderPage(<PersistencePage />);
		expect(severity(/Booted under the strict profile; no saved snapshot was applied/)).toMatch(/Info/);
		expect(screen.queryByText(/degraded/i)).toBeNull();
	});

	it('a fully applied snapshot is a success line', () => {
		state.history = [snapshotOf('loxilb_boot_config_conflict_total 0', T0)];
		state.diagnostics = boot({snapshot_found: true, succeeded: true});
		renderPage(<PersistencePage />);
		expect(severity(/Booted from the saved snapshot \(strict profile\)/)).toMatch(/Success/);
	});

	it('a failed restore is an error that names the fallback and the quarantined copy', () => {
		state.history = [snapshotOf('loxilb_boot_config_conflict_total 1', T0)];
		state.diagnostics = boot({profile: 'compat', snapshot_found: true, succeeded: false, degraded: true, legacy_fallback: true, quarantine_path: '/etc/loxilb/snapshot.json.failed-9'});
		renderPage(<PersistencePage />);
		const cls = severity(/Running degraded: the boot snapshot did not apply, and the gateway replayed its older legacy/);
		expect(cls).toMatch(/Error/);
		expect(screen.getByText(/snapshot.json.failed-9/)).toBeTruthy();
		// Degraded outranks the conflict warning.
		expect(screen.queryByText(/had to choose one/)).toBeNull();
	});

	it('a boot config conflict warns', () => {
		state.history = [snapshotOf('loxilb_boot_config_conflict_total 1', T0)];
		state.diagnostics = boot({snapshot_found: true, succeeded: true});
		renderPage(<PersistencePage />);
		expect(severity(/had to choose one/)).toMatch(/Warning/);
	});
});

describe('PdKvPage — compact', () => {
	it('renders no KV blocks table, tier table or admission table', () => {
		state.history = [
			snapshotOf(
				[
					'loxilb_pd_kv_blocks{service="s",ep_idx="0"} 4',
					'loxilb_ai_pd_tier_selected_total{tier="tier2",model="m"} 3',
					'loxilb_pd_admission_shed_total 0',
					'loxilb_pd_admission_queued_total 0',
					'loxilb_pd_admission_overflow_shed_total 0',
				].join('\n'),
				T0,
			),
		];
		renderPage(<PdKvPage />);
		expect(screen.queryByText('KV blocks stored by endpoint (strict join)')).toBeNull();
		expect(screen.queryByText('KV blocks stored')).toBeNull();
		expect(screen.queryByText('Tier 2 — min load')).toBeNull();
		expect(screen.queryByText('Queued (held)')).toBeNull();
		expect(screen.queryByRole('table')).toBeNull();
		// The panels themselves stay, and the page heading is what E2E keys on.
		expect(screen.getByText('P/D & KV Cache', {selector: 'h2'})).toBeTruthy();
		expect(screen.getByText('Prefill routing tier mix')).toBeTruthy();
		expect(screen.getByText('Admission pressure')).toBeTruthy();
		expect(screen.getByText('Sessions and routing')).toBeTruthy();
	});
});

//---------------------------------------------------------
// Reported-at sentinels and day-old instants
//---------------------------------------------------------
// Before any worker reports, the gateway still sends `last_metrics_update`
// as Go's zero time (strfmt.DateTime is a struct; omitempty never drops it).
// Read as an instant it printed a year-1 clock time AND tripped "ingestion
// stalled" — for ingestion that had never started. A bare clock time also
// hid the date, so a day-old report read as this morning's.
// The clock is faked (Date only) at NOW = 06:00 UTC, so NOW − 5 s is the
// same local day in every zone and NOW − 1 day never is.
const NOW = Date.UTC(2026, 8, 29, 6, 0, 0);
const DAY = 86_400_000;
const GO_ZERO_TIME = '0001-01-01T00:00:00.000Z';
const STALLED = /Worker ingestion is stalled/;

describe('reported-at times on the observability pages', () => {
	beforeEach(() => {
		vi.useFakeTimers({toFake: ['Date']});
		vi.setSystemTime(NOW);
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	const gpu = (last: string) => ({receivedAtMs: NOW, data: {enabled: true, routing_mode: 'gpu_aware', worker_count: 0, last_metrics_update: last}});
	const cellsOf = (rowText: string) => [...(screen.getByText(rowText).closest('tr')?.querySelectorAll('td') ?? [])].map(c => c.textContent);

	it('Workers: Go zero time is "none since start", not a stalled year-1 update', () => {
		state.gpu = gpu(GO_ZERO_TIME);
		renderPage(<WorkersPage />);
		expect(valueOf('Last metrics update')).toBe('None since start');
		expect(screen.queryByText(STALLED)).toBeNull();
	});

	it('Workers: a recent update is a clock time and not stalled', () => {
		const at = NOW - 5_000;
		state.gpu = gpu(new Date(at).toISOString());
		renderPage(<WorkersPage />);
		expect(valueOf('Last metrics update')).toBe(new Date(at).toLocaleTimeString());
		expect(screen.queryByText(STALLED)).toBeNull();
	});

	it('Workers: a day-old update carries its date and is stalled', () => {
		const at = NOW - DAY;
		state.gpu = gpu(new Date(at).toISOString());
		renderPage(<WorkersPage />);
		expect(valueOf('Last metrics update')).toBe(new Date(at).toLocaleString());
		expect(screen.getByText(STALLED)).toBeTruthy();
	});

	it('Workers: a row stamped with Go zero time reads "none since start"', () => {
		state.gpu = gpu(new Date(NOW - 5_000).toISOString());
		state.workers = {receivedAtMs: NOW, data: [{endpoint_ip: '10.0.0.1', queued_requests: 0, kv_cache_usage_perc: 0, timestamp: GO_ZERO_TIME}]};
		renderPage(<WorkersPage />);
		expect(cellsOf('10.0.0.1').at(-1)).toBe('None since start');
	});

	// The subscriber family's `ep` label carries the ep_idx: the page printed
	// "2" in the Endpoint column. The address comes from loxilb_pd_ep_info.
	it('PdKv: a stale subscriber is listed by its joined address, never the ep_idx', () => {
		const last = NOW / 1000 - 60;
		state.history = [
			snapshotOf(
				[
					`loxilb_kv_subscriber_last_event_timestamp_seconds{ep="2",service="1"} ${last}`,
					'loxilb_kv_inventory_fresh{ep="2",service="1"} 0',
					`loxilb_kv_subscriber_last_event_timestamp_seconds{ep="3",service="1"} ${last}`,
					'loxilb_kv_inventory_fresh{ep="3",service="1"} 1',
					'loxilb_pd_ep_info{ep="33.33.33.1",ep_idx="2",service="1"} 1',
					'loxilb_pd_ep_info{ep="33.33.33.9",ep_idx="3",service="1"} 1',
				].join('\n'),
				NOW,
			),
		];
		renderPage(<PdKvPage />);
		expect(screen.getByText('1 of 2 KV subscribers fresh.')).toBeTruthy();
		expect(cellsOf('33.33.33.1')).toEqual(['1', '33.33.33.1', new Date(last * 1000).toLocaleTimeString(), 'No']);
		// ⭐ Only the stale ones: a fresh subscriber needs no row.
		expect(screen.queryByText('33.33.33.9')).toBeNull();
	});

	it('PdKv: an unjoined ep_idx is an unknown endpoint, and a day-old event carries its date', () => {
		// No freshness child: not reported, so it is NOT counted fresh.
		const last = (NOW - DAY) / 1000;
		state.history = [snapshotOf(`loxilb_kv_subscriber_last_event_timestamp_seconds{ep="4",service="1"} ${last}`, NOW)];
		renderPage(<PdKvPage />);
		expect(screen.getByText('0 of 1 KV subscribers fresh.')).toBeTruthy();
		expect(cellsOf('Unknown endpoint')).toEqual(['1', 'Unknown endpoint', new Date(last * 1000).toLocaleString(), 'N/A']);
	});

	it('PdKv: all subscribers fresh is one line and no table', () => {
		state.history = [snapshotOf(['loxilb_kv_inventory_fresh{ep="0",service="1"} 1', 'loxilb_kv_inventory_fresh{ep="1",service="1"} 1'].join('\n'), NOW)];
		renderPage(<PdKvPage />);
		const line = screen.getByText('2 of 2 KV subscribers fresh.');
		expect(line.closest('[role="alert"]')?.className).toMatch(/Success/);
		expect(screen.queryByRole('table')).toBeNull();
	});

	// Both records are omitempty and nil until the first successful persist or
	// restore of this process: an omitted record printed "N/A".
	it('Persistence: an omitted restore record and a zero-time persist read "none since start"', () => {
		state.history = [snapshotOf('loxilb_config_dirty 0', NOW)];
		state.diagnostics = {
			receivedAtMs: NOW,
			data: {ready: true, maintenance_state: 'active', uptime_seconds: 1, version: 'v', last_persist: {generation: 1, mode: 'manual', at: GO_ZERO_TIME}},
		};
		renderPage(<PersistencePage />);
		expect(valueOf('Last restore')).toBe('None since start');
		expect(valueOf('Last persist')).toBe('None since start');
	});

	it('Persistence: a day-old restore carries its date', () => {
		state.history = [snapshotOf('loxilb_config_dirty 0', NOW)];
		state.diagnostics = {
			receivedAtMs: NOW,
			data: {ready: true, maintenance_state: 'active', uptime_seconds: 1, version: 'v', last_restore: {generation: 2, mode: 'commit', at: new Date(NOW - DAY).toISOString()}},
		};
		renderPage(<PersistencePage />);
		expect(valueOf('Last restore')).toBe(new Date(NOW - DAY).toLocaleString());
	});
});

describe('QosPage — compact', () => {
	it('shows only the attachment verdict, even while the shaper exports lanes', () => {
		state.history = [
			snapshotOf(
				[
					'loxilb_policer_attached{ident="p1"} 1',
					'loxilb_proxy_qos_bytes_passed_total{vip="10.0.0.1",port="80",proto="tcp",direction="upload"} 42',
				].join('\n'),
				T0,
			),
		];
		state.policies = [{policyIdent: 'p1', attached: true}];
		renderPage(<QosPage />);
		expect(screen.getByText(/All 1 configured policers are programmed/)).toBeTruthy();
		for (const gone of ['Shaped services', 'Traffic shaping', 'Bytes passed', 'Tokens (B)']) {
			expect(screen.queryByText(gone)).toBeNull();
		}
		expect(screen.queryByRole('table')).toBeNull();
	});
});

describe('SecurityPage — compact', () => {
	const severity = (re: RegExp) => screen.getByText(re).closest('[role="alert"]')?.className;

	it('drops passed traffic, byte rates, per-rule and per-reason rows and the OPA quantiles', () => {
		state.history = [
			snapshotOf(
				[
					'loxilb_security_syn_passed_total 5',
					'loxilb_fw_rule_drop_packets_total{fw_rule="r1"} 3',
					'loxilb_l4_error_events_total{proto="tcp",reason="rst"} 2',
					'loxilb_ai_rate_limit_hits_total{reason="rate_limit_exceeded"} 1',
					'loxilb_opa_circuit_breaker_state 0',
				].join('\n'),
				T0,
			),
		];
		renderPage(<SecurityPage />);
		for (const gone of ['SYN passed', 'UDP bytes blocked', 'Whitelist packets', 'Sync duration p50', 'Model not allowed', 'Rate limited', 'Unique source IPs tracked']) {
			expect(screen.queryByText(gone)).toBeNull();
		}
		expect(screen.queryByRole('table')).toBeNull();
		expect(screen.getByText('L4 error events')).toBeTruthy();
	});

	// The rule count is set on every stats pass, with one hit series per
	// blacklist rule: a count of 0 is "no rules", not a counter warming up.
	it('reads blacklist hits as "no blacklist rules" only when the rule count says so', () => {
		state.history = [snapshotOf('loxilb_ipfilter_rules{type="blacklist"} 0\nloxilb_ipfilter_rules{type="whitelist"} 2', T0)];
		renderPage(<SecurityPage />);
		expect(valueOf('Blacklist hits')).toBe('No blacklist rules');
		cleanup();
		state.history = [snapshotOf('loxilb_ipfilter_rules{type="blacklist"} 3', T0)];
		renderPage(<SecurityPage />);
		expect(valueOf('Blacklist hits')).not.toBe('No blacklist rules');
	});

	// ⭐ gw pkg/opa/watcher.go: an open breaker stops the policy fetch; the
	// OPA-managed rules stay as last synced. It never bypasses OPA.
	it('warns on an open OPA breaker as a paused sync, never as a bypass', () => {
		state.history = [snapshotOf('loxilb_opa_circuit_breaker_state 1', T0)];
		renderPage(<SecurityPage />);
		expect(valueOf('Circuit breaker')).toBe('Open (not syncing)');
		expect(severity(/stopped fetching policy from OPA/)).toMatch(/Warning/);
		expect(screen.queryByText(/bypass/i)).toBeNull();
		cleanup();
		state.history = [snapshotOf('loxilb_opa_circuit_breaker_state 0', T0)];
		renderPage(<SecurityPage />);
		expect(screen.queryByRole('alert')).toBeNull();
	});

	// ⭐ gw ai_metrics.go: the gateway fails CLOSED here — each count is a
	// request refused with 503.
	it('raises an error while requests are refused for an unreachable key store, and not otherwise', () => {
		const at = (n: number, ms: number) => snapshotOf(`loxilb_ai_policy_store_unavailable_total ${n}`, ms);
		state.history = [at(0, T0), at(20, T0 + 10_000)];
		renderPage(<SecurityPage />);
		expect(severity(/AI requests are being refused with 503/)).toMatch(/Error/);
		cleanup();
		state.history = [at(20, T0), at(20, T0 + 10_000)];
		renderPage(<SecurityPage />);
		expect(screen.queryByText(/being refused with 503/)).toBeNull();
	});
});
