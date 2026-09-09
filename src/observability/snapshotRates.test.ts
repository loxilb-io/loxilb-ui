import {describe, expect, it} from 'vitest';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from './parser';
import {familySumRate, groupRates} from './snapshotRates';

function snapshotOf(text: string, receivedAtMs: number): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {
		instanceId: 1,
		flavor: 'inference-gateway',
		receivedAtMs,
		available: true,
		families: parsed.families,
		diagnostics: parsed.diagnostics,
	};
}

const T0 = 1_000_000;
const T1 = T0 + 10_000;

describe('groupRates', () => {
	it('sums within each label group, then rates between the two most recent snapshots', () => {
		const history = [
			snapshotOf(['c{status="ok",tenant="a"} 100', 'c{status="ok",tenant="b"} 50', 'c{status="err",tenant="a"} 10'].join('\n'), T0),
			snapshotOf(['c{status="ok",tenant="a"} 200', 'c{status="ok",tenant="b"} 150', 'c{status="err",tenant="a"} 10'].join('\n'), T1),
		];
		const rates = groupRates(history, 'c', ['status']);
		const byStatus = Object.fromEntries(rates.map(r => [r.labels.status, r.rate]));
		// ok: (350-150)/10s = 20/s — tenants summed inside the group first.
		expect(byStatus['ok']).toEqual({kind: 'ok', perSecond: 20, intervalMs: 10_000});
		expect(byStatus['err']).toEqual({kind: 'ok', perSecond: 0, intervalMs: 10_000});
	});

	it('a freshly minted label group warms up instead of guessing', () => {
		const history = [
			snapshotOf('c{status="ok"} 100', T0),
			snapshotOf(['c{status="ok"} 110', 'c{status="new"} 5'].join('\n'), T1),
		];
		const rates = groupRates(history, 'c', ['status']);
		expect(rates.find(r => r.labels.status === 'new')!.rate).toEqual({kind: 'insufficient-samples'});
		expect(rates.find(r => r.labels.status === 'ok')!.rate.kind).toBe('ok');
	});

	it('one snapshot is not enough for any rate', () => {
		const rates = groupRates([snapshotOf('c 5', T0)], 'c', []);
		expect(rates[0].rate).toEqual({kind: 'insufficient-samples'});
		expect(rates[0].current).toBe(5);
	});

	it('a counter reset between snapshots is typed, not negative', () => {
		const history = [snapshotOf('c 900', T0), snapshotOf('c 5', T1)];
		expect(familySumRate(history, 'c')).toEqual({kind: 'reset'});
	});

	it('a hidden-tab gap beyond tolerance is typed', () => {
		const history = [snapshotOf('c 100', T0), snapshotOf('c 200', T0 + 3_600_000)];
		expect(familySumRate(history, 'c')).toEqual({kind: 'gap'});
	});
});

describe('familySumRate', () => {
	it('rates the explicit whole-family sum', () => {
		const history = [
			snapshotOf(['c{m="a"} 10', 'c{m="b"} 20'].join('\n'), T0),
			snapshotOf(['c{m="a"} 40', 'c{m="b"} 40'].join('\n'), T1),
		];
		expect(familySumRate(history, 'c')).toEqual({kind: 'ok', perSecond: 5, intervalMs: 10_000});
	});

	it('an absent family reports insufficient-samples, never zero', () => {
		expect(familySumRate([snapshotOf('other 1', T0), snapshotOf('other 2', T1)], 'c')).toEqual({kind: 'insufficient-samples'});
	});

	it('empty history reports insufficient-samples', () => {
		expect(familySumRate([], 'c')).toEqual({kind: 'insufficient-samples'});
	});
});
