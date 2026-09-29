//---------------------------------------------------------
// AIAdmissionPanel / ProxyOverloadPanel
//---------------------------------------------------------
// The two ways this panel could lie:
//   - an ungated pool reports 0 in flight and 0 queued BY CONSTRUCTION; a
//     bare "0" would read as a measured, idle gate;
//   - decision reasons overlap (queued then admitted, observe once per
//     ceiling), so a total over them would count requests twice.

import 'locales/i18n';
import {afterEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {ADMISSION_REASONS, AiAdmissionReport, IAdmissionPool, ProxyOverloadReport} from 'observability/aiAdmission';
import {AIAdmissionPanel, ProxyOverloadPanel} from './AIAdmissionPanel';

afterEach(cleanup);

const OK_RATE = (perSecond: number) => ({kind: 'ok' as const, perSecond, intervalMs: 10_000});

function pool(o: Partial<IAdmissionPool> & {totals?: Record<string, number>} = {}): IAdmissionPool {
	const {totals, ...rest} = o;
	return {
		service: '10.0.0.1:8080',
		pool: 'p1',
		mode: 'enforce',
		inflight: 0,
		limit: 0,
		queued: 0,
		queueDepth: 0,
		resumedTotal: 0,
		meanWaitSeconds: undefined,
		decisions: ADMISSION_REASONS.map(({reason, group}) => ({reason, group, rate: OK_RATE(0), total: totals?.[reason] ?? 0})),
		...rest,
	};
}

const ok = (pools: IAdmissionPool[], anomalyTotal = 0): AiAdmissionReport => ({kind: 'ok', pools, anomalyTotal, anomalies: []});
const cellsOf = (rowText: string) => [...(screen.getAllByText(rowText)[0].closest('tr')?.querySelectorAll('td') ?? [])].map(c => c.textContent);
const poolRow = () => cellsOf('p1');

describe('AIAdmissionPanel', () => {
	it('says an ungated pool is not gated instead of printing its structural zeros', () => {
		render(<AIAdmissionPanel report={ok([pool({mode: 'off'})])} />);
		expect(poolRow()).toEqual(['10.0.0.1:8080', 'p1', 'Off', 'Not gated', 'Not gated', 'None since start']);
		expect(screen.getByText(/The capacity gate is off on every pool/)).toBeTruthy();
		expect(screen.getByText('The gate has taken no decision since start.')).toBeTruthy();
	});

	it('shows units against the ceiling, a 0 ceiling as unlimited, and depth 0 as no queue', () => {
		render(<AIAdmissionPanel report={ok([pool({inflight: 3, limit: 8, queued: 1, queueDepth: 4, resumedTotal: 2, meanWaitSeconds: 0.25})])} />);
		expect(poolRow()).toEqual(['10.0.0.1:8080', 'p1', 'Enforce', '3 / 8', '1 / 4', '250 ms']);
		cleanup();

		render(<AIAdmissionPanel report={ok([pool({inflight: 3, limit: 0, queueDepth: 0})])} />);
		expect(poolRow().slice(3, 5)).toEqual(['3 / unlimited', 'No queue']);
		expect(screen.queryByText(/The capacity gate is off on every pool/)).toBeNull();
	});

	// Observe mode counts and holds units like enforce (it only never
	// refuses), so its gauges are real readings, not "Not gated".
	it('reads an observe-mode pool as measured, and an unencoded mode as unknown', () => {
		render(<AIAdmissionPanel report={ok([pool({mode: 'observe', inflight: 2, limit: 4})])} />);
		expect(poolRow().slice(2, 4)).toEqual(['Observe', '2 / 4']);
		cleanup();

		render(<AIAdmissionPanel report={ok([pool({mode: 'unknown'})])} />);
		expect(poolRow()[2]).toBe('Unknown value');
	});

	it('lists each decision that happened on its own row and never totals them', () => {
		render(<AIAdmissionPanel report={ok([pool({totals: {queued: 10, admitted: 10, capacity_shed: 5}})])} />);
		const decisionTable = screen.getByRole('table', {name: 'Admission gate decisions'});
		const rows = [...decisionTable.querySelectorAll('tbody tr')].map(r => r.querySelectorAll('td')[2].textContent);
		expect(rows).toEqual(['Refused at capacity (429)', 'Parked in the queue', 'Admitted']);
		expect(cellsOf('Parked in the queue').at(-1)).toBe('10');
		// 10 parked + 10 admitted is ten requests, not twenty: no total row.
		expect(screen.queryByText('20')).toBeNull();
		expect(screen.queryByText('25')).toBeNull();
	});

	it('raises an anomaly as a gateway defect, with or without pools', () => {
		render(<AIAdmissionPanel report={ok([pool()], 2)} />);
		expect(screen.getByText(/recorded 2 accounting anomalies since start/)).toBeTruthy();
		cleanup();

		render(<AIAdmissionPanel report={{kind: 'no-pools', anomalyTotal: 1}} />);
		expect(screen.getByText(/recorded 1 accounting anomalies since start/)).toBeTruthy();
		expect(screen.getByText(/No model pool reports admission-gate state/)).toBeTruthy();
	});

	it('stays quiet about anomalies at zero', () => {
		render(<AIAdmissionPanel report={{kind: 'no-pools', anomalyTotal: 0}} />);
		expect(screen.queryByText(/accounting anomalies/)).toBeNull();
	});
});

describe('ProxyOverloadPanel', () => {
	const report: ProxyOverloadReport = {
		kind: 'ok',
		listenDrops: {rate: OK_RATE(0.5), total: 5},
		listenOverflows: {rate: OK_RATE(0.3), total: 3},
		headerDeadlineDrops: {rate: OK_RATE(0), total: 0},
	};

	// Overflows are a share of drops: 5 all-cause, 3 of them overflows.
	it('shows overflows as a share of listen drops, never an added total', () => {
		render(<ProxyOverloadPanel report={report} />);
		expect(cellsOf('Listen drops (all causes)').at(-1)).toBe('5');
		expect(cellsOf('of which: listen backlog full').at(-1)).toBe('3');
		expect(cellsOf('Closed at the header deadline').at(-1)).toBe('0');
		expect(screen.queryByText('8')).toBeNull();
	});
});
