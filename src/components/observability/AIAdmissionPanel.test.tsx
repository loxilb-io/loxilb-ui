//---------------------------------------------------------
// AIAdmissionPanel / ProxyOverloadPanel
//---------------------------------------------------------
// Compact by rule: a verdict, not tables. The ways this panel could lie:
//   - an ungated pool reads 0 by construction; printed, it looks like a
//     measured, idle gate;
//   - refusals are summed as DECISIONS (a request can be counted twice), so
//     the figure must never be captioned as requests;
//   - listen drops already include overflows, so the two are never added.

import 'locales/i18n';
import {afterEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {AiAdmissionReport, IAdmissionPool, ISaturatedPool, ProxyOverloadReport} from 'observability/aiAdmission';
import {AIAdmissionPanel, ProxyOverloadPanel} from './AIAdmissionPanel';

afterEach(cleanup);

const OK_RATE = (perSecond: number) => ({kind: 'ok' as const, perSecond, intervalMs: 10_000});

function pool(o: Partial<IAdmissionPool> = {}): IAdmissionPool {
	return {service: '10.0.0.1:8080', pool: 'p1', mode: 'enforce', inflight: 0, limit: 0, queued: 0, queueDepth: 0, ...o};
}

const ok = (pools: IAdmissionPool[], o: {anomalyTotal?: number; refusing?: number; wouldRefuse?: number; saturated?: ISaturatedPool[]} = {}): AiAdmissionReport => ({
	kind: 'ok',
	pools,
	anomalyTotal: o.anomalyTotal ?? 0,
	refusing: OK_RATE(o.refusing ?? 0),
	wouldRefuse: OK_RATE(o.wouldRefuse ?? 0),
	saturated: o.saturated ?? [],
});
const rowText = (label: string) => screen.getByText(label).parentElement?.textContent ?? '';

describe('AIAdmissionPanel', () => {
	it('says an all-off gate is off and prints none of its structural zeros', () => {
		render(<AIAdmissionPanel report={ok([pool({mode: 'off'})])} />);
		expect(screen.getByText(/The capacity gate is off on every pool/)).toBeTruthy();
		// A rule's own mode switches the gate on too; the process setting is not the only way.
		expect(screen.getByText(/switched on per rule with the rule's Admission Mode, or for every rule that declares none with the gateway's LLB_FC_MODE setting/)).toBeTruthy();
		expect(screen.queryByText('Refusal decisions')).toBeNull();
		expect(screen.queryByText('Gated pools')).toBeNull();
	});

	it('shows refusals as decisions, with the caption that they are not requests', () => {
		render(<AIAdmissionPanel report={ok([pool(), pool({pool: 'p2', mode: 'off'})], {refusing: 1.5})} />);
		expect(rowText('Gated pools')).toContain('1 of 2');
		expect(rowText('Refusal decisions')).toContain('1.5/s');
		expect(screen.getByText(/count gate decisions, not requests/)).toBeTruthy();
		expect(screen.queryByText(/requests\/s/)).toBeNull();
		// No observe pool: no would-refuse row.
		expect(screen.queryByText('Would-refuse decisions (observe mode)')).toBeNull();
	});

	// Observe mode never refuses, so its row is what enforce WOULD have done.
	it('shows would-refuse for observe pools and no refusal row without an enforcing pool', () => {
		render(<AIAdmissionPanel report={ok([pool({mode: 'observe'})], {wouldRefuse: 0.2})} />);
		expect(rowText('Would-refuse decisions (observe mode)')).toContain('0.200/s');
		expect(screen.queryByText('Refusal decisions')).toBeNull();
	});

	it('warns about a pool at its ceiling now, naming it', () => {
		const saturated: ISaturatedPool[] = [
			{service: 's:1', pool: 'p1', what: 'limit', value: 8, bound: 8},
			{service: 's:1', pool: 'p1', what: 'queue', value: 4, bound: 4},
		];
		render(<AIAdmissionPanel report={ok([pool()], {saturated})} />);
		expect(screen.getByText('At a ceiling now: s:1 / p1: 8 of 8 units in flight; s:1 / p1: queue full, 4 of 4')).toBeTruthy();
	});

	it('stays quiet about ceilings when no pool is at one', () => {
		render(<AIAdmissionPanel report={ok([pool({inflight: 3, limit: 8})])} />);
		expect(screen.queryByText(/At a ceiling now/)).toBeNull();
	});

	it('raises an anomaly as a gateway defect, with or without pools, and even with the gate off', () => {
		render(<AIAdmissionPanel report={ok([pool({mode: 'off'})], {anomalyTotal: 2})} />);
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
	const report = (drops: number, overflows: number, headerTotal: number): ProxyOverloadReport => ({
		kind: 'ok',
		listenDrops: {rate: OK_RATE(drops), total: 5},
		listenOverflows: {rate: OK_RATE(overflows), total: 3},
		headerDeadlineDrops: {rate: OK_RATE(0.1), total: headerTotal},
	});

	// Overflows are a share of drops: 0.5/s all-cause, 0.3/s of them overflows.
	it('shows overflows as a share of listen drops, never an added total, and warns', () => {
		render(<ProxyOverloadPanel report={report(0.5, 0.3, 0)} />);
		expect(rowText('Listen drops (all causes)')).toContain('0.500/s (backlog full: 0.300/s)');
		expect(screen.queryByText(/0\.800/)).toBeNull();
		expect(screen.getByText(/dropping connections at its listeners/)).toBeTruthy();
	});

	it('is quiet at zero and hides the header-deadline row until it has fired', () => {
		render(<ProxyOverloadPanel report={report(0, 0, 0)} />);
		expect(screen.queryByText(/dropping connections/)).toBeNull();
		expect(screen.queryByText('Closed at the header deadline')).toBeNull();
		cleanup();

		render(<ProxyOverloadPanel report={report(0, 0, 2)} />);
		expect(rowText('Closed at the header deadline')).toContain('0.100/s');
	});
});
