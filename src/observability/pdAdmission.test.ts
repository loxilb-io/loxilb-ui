import {describe, expect, it} from 'vitest';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from './parser';
import {
	PD_ADMISSION_OVERFLOW_SHED,
	PD_ADMISSION_QUEUED,
	PD_ADMISSION_SHED,
	admissionMode,
	admissionVerdict,
	branchReachable,
	pdAdmission,
} from './pdAdmission';

const T0 = 1_700_000_000_000;
const T1 = T0 + 10_000;
const GAP = 35_000;

function snapshotOf(text: string, receivedAtMs: number, failure?: IMetricsSnapshot['failure']): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {
		instanceId: 1,
		flavor: 'inference-gateway',
		receivedAtMs,
		available: true,
		failure,
		families: parsed.families,
		diagnostics: parsed.diagnostics,
	};
}

interface ICounts {
	shed?: number;
	overflow?: number;
	queued?: number;
}

/**
 * ⭐ All three are unlabelled `promauto.NewCounter`s registered at package
 * init, so a real gateway exports every one of them from process start —
 * confirmed live. `undefined` in a fixture therefore models a BUILD that
 * lacks the family (a gateway predating `overflow`), never a lazy child.
 */
function exposition(c: ICounts): string {
	const out: string[] = [];
	if (c.shed !== undefined) out.push(`${PD_ADMISSION_SHED} ${c.shed}`);
	if (c.overflow !== undefined) out.push(`${PD_ADMISSION_OVERFLOW_SHED} ${c.overflow}`);
	if (c.queued !== undefined) out.push(`${PD_ADMISSION_QUEUED} ${c.queued}`);
	return out.join('\n');
}

/** A two-sample history so rates are derivable. */
function historyOf(a: ICounts, b: ICounts): IMetricsSnapshot[] {
	return [snapshotOf(exposition(a), T0), snapshotOf(exposition(b), T1)];
}

const ok = (r: ReturnType<typeof pdAdmission>) => {
	if (r.kind !== 'ok') throw new Error(`expected ok, got ${r.kind}`);
	return r;
};

describe('admissionMode — inferring a gate no REST surface exposes', () => {
	it('reads any queueing evidence as depth > 0', () => {
		// Either a park or an overflow proves the queueing branch was taken,
		// and the branches are mutually exclusive for the process lifetime.
		expect(admissionMode(0, 0, 5)).toBe('queueing');
		expect(admissionMode(0, 3, 0)).toBe('queueing');
	});

	it('reads a plain shed as depth == 0', () => {
		expect(admissionMode(7, 0, 0)).toBe('shedding');
	});

	it('⭐ refuses to guess when nothing has queued or shed', () => {
		// ⚠️ The case Pattern 5 cannot help with: the gate is getenv-only and
		// process-cached, so with no increments the UI genuinely cannot know
		// which valve is armed. Defaulting either way would label a
		// structurally-zero counter as a real zero or vice versa.
		expect(admissionMode(0, 0, 0)).toBe('indeterminate');
		expect(admissionMode(undefined, undefined, undefined)).toBe('indeterminate');
	});

	it('⚠️ reports a datapath-impossible split rather than picking a branch', () => {
		// The depth is resolved once per process, so a plain shed cannot
		// coexist with a park or an overflow. Choosing a mode here would
		// assert something the code forbids.
		expect(admissionMode(1, 1, 0)).toBe('contradictory');
		expect(admissionMode(1, 0, 1)).toBe('contradictory');
	});
});

describe('branchReachable — a structural zero is not a real zero', () => {
	it('⭐⭐ marks the plain shed unreachable while queueing is armed', () => {
		// This is the defect the whole stage exists to remove: the page used
		// to show this counter alone, and it CANNOT move on a queueing
		// gateway no matter how many requests are dropped.
		expect(branchReachable(PD_ADMISSION_SHED, 'queueing')).toBe(false);
		expect(branchReachable(PD_ADMISSION_OVERFLOW_SHED, 'queueing')).toBe(true);
	});

	it('marks the overflow valve unreachable while queueing is off', () => {
		expect(branchReachable(PD_ADMISSION_OVERFLOW_SHED, 'shedding')).toBe(false);
		expect(branchReachable(PD_ADMISSION_QUEUED, 'shedding')).toBe(false);
		expect(branchReachable(PD_ADMISSION_SHED, 'shedding')).toBe(true);
	});

	it('answers unknown, not false, when the mode is not established', () => {
		// `false` would claim the zero is expected; `undefined` withholds.
		for (const family of [PD_ADMISSION_SHED, PD_ADMISSION_OVERFLOW_SHED, PD_ADMISSION_QUEUED]) {
			expect(branchReachable(family, 'indeterminate')).toBeUndefined();
			expect(branchReachable(family, 'contradictory')).toBeUndefined();
		}
	});
});

describe('pdAdmission — drops as one quantity across both valves', () => {
	it('⭐⭐ counts an overflow drop even though the plain shed reads zero', () => {
		// The exact scenario the old single-row page got wrong: queueing on,
		// the overflow valve firing, the plain shed pinned at 0. A reader of
		// the plain counter alone would conclude nothing was dropped.
		const r = pdAdmission(
			snapshotOf(exposition({shed: 0, overflow: 3, queued: 6}), T1),
			historyOf({shed: 0, overflow: 0, queued: 0}, {shed: 0, overflow: 3, queued: 6}),
			GAP,
		);
		expect(ok(r).mode).toBe('queueing');
		expect(ok(r).verdict).toBe('dropping');
		expect(ok(r).dropTotal).toBe(3);
		expect(ok(r).shedTotal).toBe(0);
		// The headline rate is non-zero even though the plain shed's is zero.
		expect(ok(r).dropRate).toEqual({kind: 'ok', perSecond: 0.3, intervalMs: 10_000});
		expect(ok(r).shedRate).toEqual({kind: 'ok', perSecond: 0, intervalMs: 10_000});
	});

	it('counts a plain shed drop with queueing off', () => {
		const r = pdAdmission(
			snapshotOf(exposition({shed: 6, overflow: 0, queued: 0}), T1),
			historyOf({shed: 0, overflow: 0, queued: 0}, {shed: 6, overflow: 0, queued: 0}),
			GAP,
		);
		expect(ok(r).mode).toBe('shedding');
		expect(ok(r).verdict).toBe('dropping');
		expect(ok(r).dropTotal).toBe(6);
		expect(ok(r).dropRate).toEqual({kind: 'ok', perSecond: 0.6, intervalMs: 10_000});
	});

	it('⭐ calls parking success, not a fault', () => {
		// Parking is hold-don't-drop: the request is still going to be served,
		// so absorbing a burst is the FIFO working as designed.
		const r = pdAdmission(
			snapshotOf(exposition({shed: 0, overflow: 0, queued: 6}), T1),
			historyOf({shed: 0, overflow: 0, queued: 0}, {shed: 0, overflow: 0, queued: 6}),
			GAP,
		);
		expect(ok(r).verdict).toBe('absorbing');
		expect(ok(r).dropTotal).toBe(0);
		expect(ok(r).queuedTotal).toBe(6);
	});

	it('⭐ puts drops ahead of parking in the verdict', () => {
		// A gateway that parked a thousand and dropped one has dropped one,
		// and that is the fact an operator needs first.
		const r = pdAdmission(
			snapshotOf(exposition({shed: 0, overflow: 1, queued: 1000}), T1),
			historyOf({shed: 0, overflow: 0, queued: 0}, {shed: 0, overflow: 1, queued: 1000}),
			GAP,
		);
		expect(ok(r).verdict).toBe('dropping');
	});

	it('reports no pressure when the pool has never filled', () => {
		// The live testbed's actual state: all three exported, all zero.
		const r = pdAdmission(
			snapshotOf(exposition({shed: 0, overflow: 0, queued: 0}), T1),
			historyOf({shed: 0, overflow: 0, queued: 0}, {shed: 0, overflow: 0, queued: 0}),
			GAP,
		);
		expect(ok(r).verdict).toBe('no-pressure');
		expect(ok(r).mode).toBe('indeterminate');
		expect(ok(r).blindSpot).toBe(false);
	});
});

describe('pdAdmission — the pre-overflow-family blind spot', () => {
	it('⚠️⚠️ flags a queueing gateway that cannot export its only drop counter', () => {
		// Queueing PROVEN armed (requests parked) while the overflow family is
		// absent from the build. The only shed this gateway can take is the
		// one it does not export, so drops are happening invisibly.
		const counts: ICounts = {shed: 0, queued: 6};
		const r = pdAdmission(snapshotOf(exposition(counts), T1), historyOf({shed: 0, queued: 0}, counts), GAP);
		expect(ok(r).mode).toBe('queueing');
		expect(ok(r).blindSpot).toBe(true);
		expect(ok(r).overflowTotal).toBeUndefined();
		// ⚠️ And the drop total must NOT read as a confident zero from the
		// unreachable counter alone... it is 0 because that is all that is
		// readable, which is exactly why blindSpot exists as a separate flag.
		expect(ok(r).dropTotal).toBe(0);
	});

	it('does not call an idle gateway blind', () => {
		// The overflow family absent AND nothing ever queued: this gateway is
		// not blind, it simply has headroom. Warning here would fire on every
		// old build with a quiet pool.
		const counts: ICounts = {shed: 0, queued: 0};
		const r = pdAdmission(snapshotOf(exposition(counts), T1), historyOf(counts, counts), GAP);
		expect(ok(r).mode).toBe('indeterminate');
		expect(ok(r).blindSpot).toBe(false);
	});

	it('excludes an absent valve from the drop rate instead of poisoning it', () => {
		// ⚠️ Including an absent family would make `familySumRate` answer
		// insufficient-samples and print "warming up" forever on a build that
		// merely predates the counter.
		const counts: ICounts = {shed: 4, queued: 0};
		const r = pdAdmission(snapshotOf(exposition(counts), T1), historyOf({shed: 0, queued: 0}, counts), GAP);
		expect(ok(r).dropRate).toEqual({kind: 'ok', perSecond: 0.4, intervalMs: 10_000});
	});
});

describe('pdAdmission — the drop rate never understates', () => {
	it('⚠️⚠️ propagates a counter reset instead of reporting the other valve alone', () => {
		// A gateway restart inside the window resets the counters, so the
		// window's arithmetic cannot be trusted. Summing only the derivable
		// term would print a confident rate that is missing whatever the reset
		// valve lost — and UNDERSTATING a drop count is exactly the failure
		// this stage removed from the page. The window must say so instead.
		const r = pdAdmission(
			snapshotOf(exposition({shed: 2, overflow: 3, queued: 0}), T1),
			historyOf({shed: 10, overflow: 0, queued: 0}, {shed: 2, overflow: 3, queued: 0}),
			GAP,
		);
		expect(ok(r).shedRate).toEqual({kind: 'reset'});
		expect(ok(r).overflowRate).toEqual({kind: 'ok', perSecond: 0.3, intervalMs: 10_000});
		// The combined answer is the RESET, not the 0.3/s one term happens to
		// support.
		expect(ok(r).dropRate).toEqual({kind: 'reset'});
	});

	it('⚠️ does not report the other valve alone when one carries a non-finite sample', () => {
		const r = pdAdmission(
			snapshotOf(`${PD_ADMISSION_SHED} NaN\n${PD_ADMISSION_OVERFLOW_SHED} 3`, T1),
			[
				snapshotOf(`${PD_ADMISSION_SHED} 0\n${PD_ADMISSION_OVERFLOW_SHED} 0`, T0),
				snapshotOf(`${PD_ADMISSION_SHED} NaN\n${PD_ADMISSION_OVERFLOW_SHED} 3`, T1),
			],
			GAP,
		);
		// ⚠️ The PROPERTY that matters: the combined rate must not come back
		// `ok` at the other valve's 0.3/s, which would understate drops.
		expect(ok(r).dropRate.kind).not.toBe('ok');
		// The exact kind is `insufficient-samples` rather than
		// `invalid-sample` because the parser drops a non-finite sample before
		// the rate layer sees it, so the term has no points at all rather than
		// bad ones. Pinned so a parser change that started admitting NaN
		// through surfaces here instead of silently changing this rate.
		expect(ok(r).dropRate.kind).toBe('insufficient-samples');
	});

	it('still answers insufficient-samples while warming up', () => {
		// One observation cannot produce a rate, and saying 0/s there would
		// claim no drops on a page that has simply just loaded.
		const r = pdAdmission(snapshotOf(exposition({shed: 0, overflow: 0, queued: 0}), T1), [], GAP);
		expect(ok(r).dropRate).toEqual({kind: 'insufficient-samples'});
	});
});

describe('pdAdmission — presence and failure', () => {
	it('is not-exported only when all three families are missing', () => {
		expect(pdAdmission(snapshotOf('', T1), [], GAP).kind).toBe('not-exported');
		// One family is enough to report on.
		expect(pdAdmission(snapshotOf(exposition({shed: 0}), T1), [], GAP).kind).toBe('ok');
	});

	it('is unavailable without a snapshot and on a failed scrape', () => {
		expect(pdAdmission(undefined, [], GAP).kind).toBe('unavailable');
		const failed = snapshotOf(exposition({shed: 5}), T1, {
			status: 'unavailable',
			code: 'metrics.scrape',
			localeKey: 'status.unavailable',
			retryable: true,
		});
		// ⚠️ A failed scrape must not be read as counters reporting values.
		expect(pdAdmission(failed, [], GAP).kind).toBe('unavailable');
	});

	it('⚠️ reads a labelled admission family as absent rather than summing it', () => {
		// `selectScalar` takes exactly one sample. If a future gateway gave
		// these counters labels, summing would report a total the contract
		// never promised; reading absent is the safe failure.
		const r = pdAdmission(
			snapshotOf(`${PD_ADMISSION_SHED}{ep="a"} 3\n${PD_ADMISSION_SHED}{ep="b"} 4`, T1),
			[],
			GAP,
		);
		expect(ok(r).shedTotal).toBeUndefined();
		expect(ok(r).verdict).toBe('no-pressure');
	});

	it('does not invent a drop total when neither valve is readable', () => {
		const r = pdAdmission(snapshotOf(exposition({queued: 2}), T1), [], GAP);
		expect(ok(r).dropTotal).toBeUndefined();
		expect(ok(r).verdict).toBe('absorbing');
	});
});

describe('admissionVerdict — precedence', () => {
	it('ranks dropping over absorbing over quiet', () => {
		expect(admissionVerdict(1, 1000)).toBe('dropping');
		expect(admissionVerdict(0, 1)).toBe('absorbing');
		expect(admissionVerdict(0, 0)).toBe('no-pressure');
		expect(admissionVerdict(undefined, undefined)).toBe('no-pressure');
	});
});
