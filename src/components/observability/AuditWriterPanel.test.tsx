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
import AuditWriterSection, {AuditWriterPanel} from './AuditWriterPanel';

const mocks = vi.hoisted(() => ({
	resolution: vi.fn(),
	snapshot: vi.fn(),
	instances: [] as {id: number; name: string}[],
}));

vi.mock('hooks/query/oamHooks', () => ({useInstances: () => ({instance_list: mocks.instances})}));
vi.mock('hooks/query/flavorHook', () => ({useInstanceFlavorResolution: mocks.resolution}));
vi.mock('hooks/query/observabilityHooks', () => ({useMetricsSnapshot: mocks.snapshot}));

const NOW = Date.UTC(2026, 8, 29, 6, 0, 0);
const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
const cellsOf = (rowText: string) => [...(screen.getByText(rowText).closest('tr')?.querySelectorAll('td') ?? [])].map(c => c.textContent);

function okReport(o: Partial<Extract<AuditWriterReport, {kind: 'ok'}>> = {}): AuditWriterReport {
	return {
		kind: 'ok',
		up: true,
		reserveBreached: false,
		lastHeartbeatSeconds: NOW / 1000 - 5,
		lastWriteSeconds: NOW / 1000 - 5,
		streams: [
			{stream: 'mgmt', writtenRate: {kind: 'ok', perSecond: 0, intervalMs: 10_000}, writtenTotal: 6, droppedTotal: 0, droppedBy: []},
			{stream: 'data', writtenRate: {kind: 'ok', perSecond: 5, intervalMs: 10_000}, writtenTotal: 150, droppedTotal: 4, droppedBy: [{reason: 'queue_full', total: 4}]},
		],
		restarts: 0,
		panics: 0,
		failures: [{key: 'loxilb_audit_write_failures_total', total: 2}],
		activity: [{key: 'loxilb_audit_segments_pruned_total', total: 1}],
		...o,
	};
}

beforeEach(() => {
	localStorage.clear();
	mocks.resolution.mockReset();
	mocks.snapshot.mockReset();
	mocks.instances = [];
});
afterEach(cleanup);

describe('AuditWriterPanel', () => {
	it('reads no writer as every audited call refused, not as no data', () => {
		render(<AuditWriterPanel report={{kind: 'not-configured'}} liveness={{kind: 'unknown'}} nowMs={NOW} />);
		expect(screen.getByText(/No audit writer is running on this gateway/)).toBeTruthy();
	});

	it('shows a running writer with an advancing heartbeat and no alarm', () => {
		render(<AuditWriterPanel report={okReport()} liveness={{kind: 'advancing'}} nowMs={NOW} />);
		expect(valueOf('Writer')).toBe('Running');
		expect(valueOf('Heartbeat')).toBe('Advancing');
		expect(valueOf('Last heartbeat (gateway clock)')).toBe(new Date(NOW - 5000).toLocaleTimeString());
		expect(screen.queryByRole('alert')).toBeNull();
	});

	// The up gauge says 1, the heartbeat says otherwise: the heartbeat wins.
	it('raises a stalled heartbeat even while the up gauge reads running', () => {
		render(<AuditWriterPanel report={okReport()} liveness={{kind: 'stalled', sinceMs: 95_000}} nowMs={NOW} />);
		expect(valueOf('Writer')).toBe('Running');
		expect(valueOf('Heartbeat')).toBe('Not advancing for at least 95 s');
		expect(screen.getByText(/has not advanced for at least 95 s/)).toBeTruthy();
	});

	it('raises a down writer and a breached reserve', () => {
		render(<AuditWriterPanel report={okReport({up: false, reserveBreached: true})} liveness={{kind: 'advancing'}} nowMs={NOW} />);
		expect(valueOf('Writer')).toBe('Not running');
		expect(screen.getByText(/every audited management call is refused until it restarts/)).toBeTruthy();
		expect(screen.getByText(/below its free-space reserve/)).toBeTruthy();
	});

	it('shows written and dropped per stream, with the drop reasons', () => {
		render(<AuditWriterPanel report={okReport()} liveness={{kind: 'advancing'}} nowMs={NOW} />);
		expect(cellsOf('Data')).toEqual(['Data', '5.0/s', '150', '4 (queue_full 4)']);
		expect(cellsOf('Management')).toEqual(['Management', '0.000/s', '6', '0']);
		expect(cellsOf('Append failures')).toEqual(['Append failures', '2']);
		expect(cellsOf('Segments pruned by retention')).toEqual(['Segments pruned by retention', '1']);
	});

	it('says none since start for a writer that has never beaten or written', () => {
		render(<AuditWriterPanel report={okReport({lastHeartbeatSeconds: 0, lastWriteSeconds: 0})} liveness={{kind: 'never'}} nowMs={NOW} />);
		expect(valueOf('Heartbeat')).toBe('None since start');
		expect(valueOf('Last durable write (gateway clock)')).toBe('None since start');
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
		render(<AuditWriterSection />);
		expect(screen.getByText(/plain loxilb, which keeps no audit trail/)).toBeTruthy();
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
