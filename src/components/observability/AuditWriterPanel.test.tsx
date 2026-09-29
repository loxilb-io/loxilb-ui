//---------------------------------------------------------
// Audit writer panel + System-page section
//---------------------------------------------------------
// Pins the three readings an operator must not confuse: no writer at all,
// a writer that is down, and a heartbeat that stopped while the up gauge
// still says 1. The section must not probe any instance until one is picked:
// the System page is OAM-level and the first registered instance may be
// unreachable.

import 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {PREFERENCE_KEYS} from 'preferences';
import {AuditWriterReport} from 'observability/auditWriter';
import {parseExposition} from 'observability/parser';
import {AuditRestSignals} from 'types/audit_status';
import AuditWriterSection, {AuditWriterPanel} from './AuditWriterPanel';

const mocks = vi.hoisted(() => ({
	resolution: vi.fn(),
	snapshot: vi.fn(),
	instances: [] as {id: number; name: string}[],
	auditRest: vi.fn(),
}));

vi.mock('hooks/query/oamHooks', () => ({useInstances: () => ({instance_list: mocks.instances})}));
vi.mock('hooks/query/flavorHook', () => ({useInstanceFlavorResolution: mocks.resolution}));
vi.mock('hooks/query/observabilityHooks', () => ({useMetricsSnapshot: mocks.snapshot}));
vi.mock('hooks/query/statusHook', () => ({useGatewayAuditRest: mocks.auditRest}));

const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
const severityOf = (re: RegExp) => screen.getByText(re).closest('[role="alert"]')?.className;

const NO_DROPS = [
	{stream: 'mgmt', total: 0, by: []},
	{stream: 'data', total: 0, by: []},
	{stream: 'audit_system', total: 0, by: []},
];

function okReport(o: Partial<Extract<AuditWriterReport, {kind: 'ok'}>> = {}): AuditWriterReport {
	return {kind: 'ok', up: true, reserveBreached: false, lastHeartbeatSeconds: 1_790_000_000, drops: NO_DROPS, faults: [], faultsNotReported: 0, ...o};
}

beforeEach(() => {
	localStorage.clear();
	mocks.resolution.mockReset();
	mocks.snapshot.mockReset();
	mocks.auditRest.mockReset();
	mocks.auditRest.mockReturnValue({data: undefined, isError: false});
	mocks.instances = [];
});
afterEach(cleanup);

describe('AuditWriterPanel', () => {
	it('reads no writer as every audited call refused, not as no data', () => {
		render(<AuditWriterPanel report={{kind: 'not-configured'}} liveness={{kind: 'unknown'}} />);
		expect(screen.getByText(/No audit writer is running on this gateway/)).toBeTruthy();
	});

	it('shows a healthy writer as four quiet lines and no alarm', () => {
		render(<AuditWriterPanel report={okReport()} liveness={{kind: 'advancing'}} />);
		expect(valueOf('Writer')).toBe('Running');
		expect(valueOf('Heartbeat')).toBe('Advancing');
		expect(valueOf('Records dropped since start')).toBe('Management 0 · Data 0 · Audit system 0');
		expect(valueOf('Fault counters')).toBe('None above zero');
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.queryByRole('table')).toBeNull();
	});

	// Compact: the gateway-clock times are gone (liveness answers them with no
	// clock skew), and so are the written counts and the housekeeping rows.
	it('drops the gateway-clock times, written counts and housekeeping counters', () => {
		render(<AuditWriterPanel report={okReport()} liveness={{kind: 'advancing'}} />);
		for (const gone of [/gateway clock/, /^Written/, /Segments pruned/, /Originator trust lookups/, /Writer restarts \(since start\)/]) {
			expect(screen.queryByText(gone)).toBeNull();
		}
	});

	// The up gauge says 1, the heartbeat says otherwise: the heartbeat wins.
	it('raises a stalled heartbeat even while the up gauge reads running', () => {
		render(<AuditWriterPanel report={okReport()} liveness={{kind: 'stalled', sinceMs: 95_000}} />);
		expect(valueOf('Writer')).toBe('Running');
		expect(valueOf('Heartbeat')).toBe('Not advancing for at least 95 s');
		expect(screen.getByText(/has not advanced for at least 95 s/)).toBeTruthy();
	});

	it('raises a down writer and a breached reserve', () => {
		render(<AuditWriterPanel report={okReport({up: false, reserveBreached: true})} liveness={{kind: 'advancing'}} />);
		expect(valueOf('Writer')).toBe('Not running');
		expect(screen.getByText(/every audited management call is refused until it restarts/)).toBeTruthy();
		expect(screen.getByText(/below its free-space reserve/)).toBeTruthy();
	});

	// ⭐ Per stream, never summed: a dropped management record refused its
	// call, a dropped data record is lost. A total of 4 would hide which.
	it('warns on drops with one count per stream and the reasons, never a sum', () => {
		const drops = [
			{stream: 'mgmt', total: 1, by: [{reason: 'writer_down', total: 1}]},
			{stream: 'data', total: 3, by: [{reason: 'queue_full', total: 3}]},
			{stream: 'audit_system', total: 0, by: []},
		];
		render(<AuditWriterPanel report={okReport({drops})} liveness={{kind: 'advancing'}} />);
		const cls = severityOf(/Management 1 \(writer_down 1\) · Data 3 \(queue_full 3\) · Audit system 0/);
		expect(cls).toMatch(/Warning/);
		expect(screen.queryByText(/\b4\b/)).toBeNull();
		expect(screen.queryByText('Records dropped since start')).toBeNull();
	});

	it('says "not reported" for a stream whose drops are absent, not 0', () => {
		const drops = [{stream: 'mgmt', total: undefined, by: []}, ...NO_DROPS.slice(1)];
		render(<AuditWriterPanel report={okReport({drops})} liveness={{kind: 'advancing'}} />);
		expect(valueOf('Records dropped since start')).toBe('Management not reported · Data 0 · Audit system 0');
	});

	it('names the fault counters only when some are above zero, restarts and panics included', () => {
		const faults = [
			{key: 'loxilb_audit_writer_restarts_total', total: 2},
			{key: 'loxilb_audit_writer_panics_total', total: 1},
			{key: 'loxilb_audit_write_failures_total', total: 5},
		];
		render(<AuditWriterPanel report={okReport({faults, faultsNotReported: 1})} liveness={{kind: 'advancing'}} />);
		const cls = severityOf(/3 audit fault counters are above zero since the gateway started: Writer restarts 2, Writer panics 1, Append failures 5\./);
		expect(cls).toMatch(/Warning/);
		expect(screen.getByText(/1 not reported/)).toBeTruthy();
		expect(screen.queryByText('Fault counters')).toBeNull();
	});

	it('does not call unreported fault counters zero', () => {
		render(<AuditWriterPanel report={okReport({faultsNotReported: 2})} liveness={{kind: 'advancing'}} />);
		expect(valueOf('Fault counters')).toBe('None above zero, 2 not reported');
	});

	it('says none since start for a writer that has never beaten', () => {
		render(<AuditWriterPanel report={okReport({lastHeartbeatSeconds: 0})} liveness={{kind: 'never'}} />);
		expect(valueOf('Heartbeat')).toBe('None since start');
	});
});

describe('AuditWriterSection', () => {
	it('probes no instance until one is picked', () => {
		mocks.instances = [
			{id: 1, name: 'dead'},
			{id: 2, name: 'gw'},
		];
		render(<AuditWriterSection />);
		expect(screen.getByText('Pick an inference gateway instance to see its audit writer.')).toBeTruthy();
		expect(mocks.resolution).not.toHaveBeenCalled();
		expect(mocks.snapshot).not.toHaveBeenCalled();
		expect(mocks.auditRest).not.toHaveBeenCalled();
	});

	it('renders the remembered gateway pick, and explains a plain loxilb pick', () => {
		mocks.instances = [{id: 2, name: 'gw'}];
		localStorage.setItem(PREFERENCE_KEYS.systemAuditInstance, JSON.stringify('gw'));
		mocks.resolution.mockReturnValue({state: 'resolved', flavor: 'inference-gateway'});
		mocks.snapshot.mockReturnValue({snapshot: undefined, history: [], cadenceMs: 10_000, isLoading: true});
		render(<AuditWriterSection />);
		expect(mocks.resolution).toHaveBeenCalledWith(expect.objectContaining({name: 'gw'}));
		expect(screen.getByText(/Audit writer health is unavailable/)).toBeTruthy();
		cleanup();

		mocks.resolution.mockReturnValue({state: 'resolved', flavor: 'loxilb'});
		mocks.auditRest.mockClear();
		render(<AuditWriterSection />);
		expect(screen.getByText(/plain loxilb, which keeps no audit trail/)).toBeTruthy();
		// Plain loxilb has no /audit/*: the read is never even set up.
		expect(mocks.auditRest).not.toHaveBeenCalled();
	});

	// React Query keeps the last good data when a refetch fails. For an alert
	// that would keep yesterday's "sink down" on screen; a failed read says nothing.
	it('shows the REST alert while the read succeeds, and drops it once a refetch fails', () => {
		mocks.instances = [{id: 2, name: 'gw'}];
		localStorage.setItem(PREFERENCE_KEYS.systemAuditInstance, JSON.stringify('gw'));
		mocks.resolution.mockReturnValue({state: 'resolved', flavor: 'inference-gateway'});
		mocks.snapshot.mockReturnValue({snapshot: undefined, history: [], cadenceMs: 10_000, isLoading: true});
		const down = {kind: 'ok', status: {available: true}, sink: {enabled: true, address: 'siem:6514'}};
		mocks.auditRest.mockReturnValue({data: down, isError: false});
		const {rerender} = render(<AuditWriterSection />);
		expect(mocks.auditRest).toHaveBeenCalledWith(expect.objectContaining({name: 'gw'}));
		expect(screen.getByText(/siem:6514 is configured but not connected/)).toBeTruthy();

		mocks.auditRest.mockReturnValue({data: down, isError: true});
		rerender(<AuditWriterSection />);
		expect(screen.queryByText(/is configured but not connected/)).toBeNull();
	});
});

// The section keeps what it has seen of the heartbeat across renders. Driven
// here by successive snapshots, with receive times passed in: no real clock.
describe('AuditWriterSection — heartbeat tracking across polls', () => {
	const snap = (beat: number, receivedAtMs: number) => {
		const text = ['loxilb_audit_writer_up 1', `loxilb_audit_last_heartbeat_timestamp_seconds ${beat}`, 'loxilb_audit_records_written_total{stream="data"} 1'].join('\n');
		const parsed = parseExposition(text);
		const snapshot = {instanceId: 2, flavor: 'inference-gateway' as const, receivedAtMs, available: true, families: parsed.families, diagnostics: parsed.diagnostics};
		return {snapshot, history: [snapshot], cadenceMs: 10_000, isLoading: false};
	};

	function setup() {
		mocks.instances = [{id: 2, name: 'gw'}];
		localStorage.setItem(PREFERENCE_KEYS.systemAuditInstance, JSON.stringify('gw'));
		mocks.resolution.mockReturnValue({state: 'resolved', flavor: 'inference-gateway'});
	}

	it('goes from watching to advancing when the value moves, then to stalled when it stops', () => {
		setup();
		mocks.snapshot.mockReturnValue(snap(1000, 0));
		const {rerender} = render(<AuditWriterSection />);
		expect(valueOf('Heartbeat')).toBe('No change seen yet (0 s observed)');

		mocks.snapshot.mockReturnValue(snap(1030, 30_000));
		rerender(<AuditWriterSection />);
		expect(valueOf('Heartbeat')).toBe('Advancing');

		// Same value, 71 s after it was first seen: past two beats plus a poll.
		mocks.snapshot.mockReturnValue(snap(1030, 101_000));
		rerender(<AuditWriterSection />);
		expect(valueOf('Heartbeat')).toBe('Not advancing for at least 71 s');
	});

	it('does not move the first-seen time on a re-render of the same snapshot', () => {
		setup();
		mocks.snapshot.mockReturnValue(snap(1000, 0));
		const {rerender} = render(<AuditWriterSection />);
		mocks.snapshot.mockReturnValue(snap(1000, 50_000));
		rerender(<AuditWriterSection />);
		rerender(<AuditWriterSection />);
		expect(valueOf('Heartbeat')).toBe('No change seen yet (50 s observed)');
	});
});

describe('AuditWriterPanel — /audit REST signals (urgent only)', () => {
	const SINK_DOWN: AuditRestSignals = {kind: 'ok', sinkDown: {address: 'siem.example:6514', lastError: 'x509: certificate signed by unknown authority', writeErrors: 4}};

	// The compactness guard: a healthy REST answer must not grow the panel.
	it('adds nothing for a healthy REST answer', () => {
		const bare = render(<AuditWriterPanel report={okReport()} liveness={{kind: 'advancing'}} />);
		const baseline = bare.container.innerHTML;
		cleanup();
		const withRest = render(<AuditWriterPanel report={okReport()} liveness={{kind: 'advancing'}} rest={{kind: 'ok'}} />);
		expect(withRest.container.innerHTML).toBe(baseline);
	});

	it('raises a disconnected sink as one warning carrying the address, the error and the failed submissions', () => {
		render(<AuditWriterPanel report={okReport()} liveness={{kind: 'advancing'}} rest={SINK_DOWN} />);
		const alerts = screen.getAllByRole('alert');
		expect(alerts).toHaveLength(1);
		expect(alerts[0].className).toMatch(/Warning/);
		expect(alerts[0].textContent).toContain('siem.example:6514 is configured but not connected');
		expect(alerts[0].textContent).toContain('x509: certificate signed by unknown authority');
		expect(alerts[0].textContent).toContain('4 submissions have failed');
	});

	it('names the latest orphaned event on the existing orphan fault line, without a second alert', () => {
		const report = okReport({faults: [{key: 'loxilb_audit_orphaned_intents_total', total: 2}]});
		render(<AuditWriterPanel report={report} liveness={{kind: 'advancing'}} rest={{kind: 'ok', orphan: {count: 2, eventId: 'evt-01a0'}}} />);
		const alerts = screen.getAllByRole('alert');
		expect(alerts).toHaveLength(1);
		expect(alerts[0].textContent).toContain('Orphaned intents from the previous boot 2 (most recent: event evt-01a0)');
	});

	it('gives the orphan its own line when the metrics fault line does not carry it', () => {
		render(<AuditWriterPanel report={okReport()} liveness={{kind: 'advancing'}} rest={{kind: 'ok', orphan: {count: 2, eventId: 'evt-7'}}} />);
		const alerts = screen.getAllByRole('alert');
		expect(alerts).toHaveLength(1);
		expect(alerts[0].textContent).toContain('2 management changes from the previous boot have no recorded result. Most recent: event evt-7.');
	});

	it('still shows the orphan and a down sink when the metrics scrape did not answer', () => {
		render(<AuditWriterPanel report={{kind: 'unavailable'}} liveness={{kind: 'unknown'}} rest={{...SINK_DOWN, orphan: {count: 1, eventId: 'evt-9'}}} />);
		expect(screen.getByText(/1 management changes from the previous boot have no recorded result/).textContent).toContain('event evt-9');
		expect(screen.getByText(/is configured but not connected/)).toBeTruthy();
	});

	it('says quietly that a 403 needs administrator rights: text, never an alert', () => {
		render(<AuditWriterPanel report={okReport()} liveness={{kind: 'advancing'}} rest={{kind: 'forbidden'}} />);
		expect(screen.getByText('Audit sink and orphan details need gateway administrator rights.')).toBeTruthy();
		expect(screen.queryByRole('alert')).toBeNull();
	});
});
