import {describe, expect, it} from 'vitest';
import {IServiceArguments, IServiceConfiguration} from 'types/load_balancer';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from './parser';
import {
	affinityVerdict,
	IPDTierGates,
	PD_SESSION_HITS,
	PD_TIER_SELECTED,
	PD_TIERS,
	pdTierGates,
	pdTierMix,
	tier0Reconciliation,
	tierReachable,
} from './pdTiers';

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

const T0 = 1_700_000_000_000;
const T1 = T0 + 10_000;
const GAP = 35_000;

interface ITierLine {
	tier: string;
	model?: string;
	value: number;
}

/**
 * ⚠️ A child is emitted only for a tier that has been selected at least once.
 * Every fixture here therefore lists the children it wants and NOTHING else —
 * an absent tier means the ladder never terminated there, which is the case
 * `partitionRate` has to read as a genuine 0/s.
 */
function tierExposition(lines: readonly ITierLine[], sessionHits?: readonly {model?: string; value: number}[]): string {
	const out = lines.map(l => `${PD_TIER_SELECTED}{tier="${l.tier}",model="${l.model ?? 'm1'}"} ${l.value}`);
	for (const h of sessionHits ?? []) out.push(`${PD_SESSION_HITS}{model="${h.model ?? 'm1'}"} ${h.value}`);
	return out.join('\n');
}

const OPEN_ALL: IPDTierGates = {pdDisagg: true, cacheAware: true, kvExact: true};
const PD_ONLY: IPDTierGates = {pdDisagg: true, cacheAware: false, kvExact: false};

// Only the P/D fields matter to the gates; the rest of a real rule is noise
// here, so the fixture declares the subset and casts once.
const rule = (args: Partial<IServiceArguments>): IServiceConfiguration =>
	({serviceArguments: args as IServiceArguments, endpoints: [], secondaryIPs: [], allowedSources: []}) as IServiceConfiguration;

const shareOf = (report: ReturnType<typeof pdTierMix>, tier: string) =>
	report.kind === 'ok' ? report.tiers.find(r => r.tier === tier)?.share : undefined;
const rowOf = (report: ReturnType<typeof pdTierMix>, tier: string) =>
	report.kind === 'ok' ? report.tiers.find(r => r.tier === tier) : undefined;

//---------------------------------------------------------
// Configuration gates
//---------------------------------------------------------

describe('pdTierGates', () => {
	it('reads no gates from a gateway with no P/D rule', () => {
		expect(pdTierGates([rule({}), rule({sse_mode: true})])).toEqual({pdDisagg: false, cacheAware: false, kvExact: false});
	});

	it('distinguishes an unavailable rule list from no gates open', () => {
		// ⚠️ The load-bearing distinction: without configuration the panel
		// cannot say whether a zero at Tier-1 is expected, and `undefined`
		// keeps that unknown rather than asserting "not configured".
		expect(pdTierGates(undefined)).toBeUndefined();
		expect(pdTierGates([])).toEqual({pdDisagg: false, cacheAware: false, kvExact: false});
	});

	it('opens the cache-aware and KV-exact gates from separate rules', () => {
		const gates = pdTierGates([
			rule({pd_disagg_mode: true, pd_cache_aware_mode: true}),
			rule({pd_disagg_mode: true, kvExactMode: 1}),
		]);
		expect(gates).toEqual({pdDisagg: true, cacheAware: true, kvExact: true});
	});

	it('ignores cache-aware and KV-exact fields on a rule that is not in P/D mode', () => {
		// Upstream refuses that pairing outright (LB-CACHE-REQUIRES-PD,
		// LB-EXACT-PD-MODE), so honouring it here would open a gate the
		// datapath cannot reach and mark a correct zero as a defect.
		expect(pdTierGates([rule({pd_cache_aware_mode: true, kvExactMode: 1})])).toEqual({
			pdDisagg: false,
			cacheAware: false,
			kvExact: false,
		});
	});

	it('does not treat kvExactMode 3 as a Tier-1.5 gate', () => {
		// Mode 3 requires fullproxy and PROHIBITS P/D, so it produces no tier
		// selections at all; counting it would promise a tier that can never
		// appear.
		expect(pdTierGates([rule({pd_disagg_mode: true, kvExactMode: 3})])).toEqual({
			pdDisagg: true,
			cacheAware: false,
			kvExact: false,
		});
	});
});

describe('tierReachable', () => {
	it('gates tier1 on cache-aware and tier15 on KV-exact', () => {
		expect(tierReachable('tier1', PD_ONLY)).toBe(false);
		expect(tierReachable('tier15', PD_ONLY)).toBe(false);
		expect(tierReachable('tier1', OPEN_ALL)).toBe(true);
		expect(tierReachable('tier15', OPEN_ALL)).toBe(true);
	});

	it('treats tier0 and tier2 as reachable on any P/D rule', () => {
		// Session stickiness applies whenever a session key is present,
		// independently of cache-aware mode; min-load is the unconditional
		// fallback.
		expect(tierReachable('tier0', PD_ONLY)).toBe(true);
		expect(tierReachable('tier2', PD_ONLY)).toBe(true);
	});

	it('reaches nothing without a P/D rule, and answers unknown without configuration', () => {
		const closed: IPDTierGates = {pdDisagg: false, cacheAware: false, kvExact: false};
		for (const tier of PD_TIERS) {
			expect(tierReachable(tier, closed)).toBe(false);
			expect(tierReachable(tier, undefined)).toBeUndefined();
		}
	});
});

//---------------------------------------------------------
// The mix
//---------------------------------------------------------

describe('pdTierMix preconditions', () => {
	it('says unavailable when the scrape did not answer', () => {
		expect(pdTierMix(undefined, [], GAP, OPEN_ALL).kind).toBe('unavailable');
		const failed = snapshotOf('', T1, {status: 'unavailable', code: 'metrics.scrape', localeKey: 'Unavailable', retryable: true});
		expect(pdTierMix(failed, [failed], GAP, OPEN_ALL).kind).toBe('unavailable');
	});

	it('says not-exported when the family is absent, even with P/D configured', () => {
		// ⚠️ A precondition, never an error: a configured P/D rule that has
		// taken no AI traffic yet exports no child at all. This is the reading
		// the live testbed gives.
		const snap = snapshotOf('loxilb_pd_sessions_active 0', T1);
		expect(pdTierMix(snap, [snap], GAP, OPEN_ALL).kind).toBe('not-exported');
	});

	it('reports the mix on a first observation instead of claiming the scrape failed', () => {
		// ⚠️ The retention ring is filled in an effect, so a page holds a
		// snapshot while history is still empty. Reading the snapshot off the
		// history tail rendered a live "N/A" in Stage 3.1 — the two are passed
		// apart here for exactly that reason.
		const snap = snapshotOf(tierExposition([{tier: 'tier2', value: 7}]), T1);
		const report = pdTierMix(snap, [], GAP, OPEN_ALL);
		expect(report.kind).toBe('ok');
		if (report.kind !== 'ok') return;
		// Lifetime totals come from the snapshot and are known immediately;
		// only the rates have to wait for a second observation.
		expect(rowOf(report, 'tier2')?.total).toBe(7);
		expect(report.totalRate.kind).toBe('insufficient-samples');
	});
});

describe('pdTierMix shares', () => {
	const history = [
		snapshotOf(tierExposition([{tier: 'tier0', value: 10}, {tier: 'tier2', value: 100}]), T0),
		snapshotOf(tierExposition([{tier: 'tier0', value: 20}, {tier: 'tier2', value: 130}]), T1),
	];
	const report = pdTierMix(history[1], history, GAP, OPEN_ALL);

	it('derives each tier share from the same window as the total', () => {
		// 10 tier0 + 30 tier2 over 10 s = 4/s total; tier0 is a quarter.
		expect(report.kind).toBe('ok');
		expect(shareOf(report, 'tier0')).toEqual({kind: 'ok', ratio: 0.25});
		expect(shareOf(report, 'tier2')).toEqual({kind: 'ok', ratio: 0.75});
	});

	it('reads an absent tier child on a present family as a genuine zero, not warming up', () => {
		// ⭐ The `partitionRate` rule. Tier-1 has never been selected, so no
		// child exists — and `familySumRate` would answer insufficient-samples
		// and print "Warming up…" forever at the tier whose emptiness is the
		// finding.
		expect(rowOf(report, 'tier1')?.rate).toEqual({kind: 'ok', perSecond: 0, intervalMs: 10_000});
		expect(shareOf(report, 'tier1')).toEqual({kind: 'ok', ratio: 0});
		// No child also means no lifetime count — which is not the number 0.
		expect(rowOf(report, 'tier1')?.total).toBeUndefined();
	});

	it('takes the affinity share as the complement of the fallback tier', () => {
		// Not a sum of the other three: one predicate is one summed series and
		// therefore one rate, where summing three would report
		// insufficient-samples for the whole answer the first time any single
		// tier appeared.
		expect(report.kind === 'ok' && report.affinityShare).toEqual({kind: 'ok', ratio: 0.25});
	});

	it('does not report a share of 0% when nothing was selected at all', () => {
		// 0/0 asserts nothing. A printed 0% would tell an operator affinity
		// failed on a gateway that took no traffic.
		const idle = [
			snapshotOf(tierExposition([{tier: 'tier2', value: 5}]), T0),
			snapshotOf(tierExposition([{tier: 'tier2', value: 5}]), T1),
		];
		const r = pdTierMix(idle[1], idle, GAP, OPEN_ALL);
		expect(r.kind === 'ok' && r.affinityShare).toEqual({kind: 'no-traffic'});
		expect(shareOf(r, 'tier2')).toEqual({kind: 'no-traffic'});
	});

	it('marks a tier unreachable when its gate is closed', () => {
		const r = pdTierMix(history[1], history, GAP, PD_ONLY);
		expect(rowOf(r, 'tier1')?.reachable).toBe(false);
		expect(rowOf(r, 'tier15')?.reachable).toBe(false);
		expect(rowOf(r, 'tier0')?.reachable).toBe(true);
	});
});

describe('pdTierMix per-model rows', () => {
	it('builds rows from observed labels and orders them by lifetime volume', () => {
		const text = tierExposition([
			{tier: 'tier2', model: 'small', value: 3},
			{tier: 'tier0', model: 'big', value: 40},
			{tier: 'tier2', model: 'big', value: 10},
		]);
		const snap = snapshotOf(text, T1);
		const r = pdTierMix(snap, [snap], GAP, OPEN_ALL);
		expect(r.kind === 'ok' && r.byModel.map(m => m.model)).toEqual(['big', 'small']);
		expect(r.kind === 'ok' && r.byModel[0].total).toBe(50);
	});

	it('keeps model-less traffic as its own row with a rate beside its total', () => {
		// ⚠️ The datapath passes "" for traffic with no model, so the empty
		// label is real data. Label equality would never have matched a sample
		// that omitted the label, giving this row a total and no rate — the
		// predicate form the module uses keeps the two consistent.
		const history = [
			snapshotOf(`${PD_TIER_SELECTED}{tier="tier2"} 4`, T0),
			snapshotOf(`${PD_TIER_SELECTED}{tier="tier2"} 14`, T1),
		];
		const r = pdTierMix(history[1], history, GAP, OPEN_ALL);
		expect(r.kind === 'ok' && r.byModel.map(m => m.model)).toEqual(['']);
		expect(r.kind === 'ok' && r.byModel[0].total).toBe(14);
		expect(r.kind === 'ok' && r.byModel[0].fallbackRate).toEqual({kind: 'ok', perSecond: 1, intervalMs: 10_000});
	});
});

//---------------------------------------------------------
// Tier-0 reconciliation
//---------------------------------------------------------

describe('tier0Reconciliation', () => {
	it('agrees when the two one-to-one writers match', () => {
		// The session-hit and Tier-0 records are consecutive statements at the
		// same terminal return, so their LIFETIME totals must be equal — which
		// is why this needs no second observation.
		const snap = snapshotOf(tierExposition([{tier: 'tier0', value: 9}, {tier: 'tier2', value: 13}], [{value: 9}]), T1);
		expect(tier0Reconciliation(snap)).toEqual({kind: 'agrees', selections: 9});
	});

	it('reports a disagreement with both numbers', () => {
		const snap = snapshotOf(tierExposition([{tier: 'tier0', value: 9}], [{value: 7}]), T1);
		expect(tier0Reconciliation(snap)).toEqual({kind: 'disagrees', tierSelections: 9, sessionHits: 7});
	});

	it('sums over models so label bucketing cannot fake a mismatch', () => {
		// ⚠️ `boundModelLabel` collapses models past the 64th to "other"; if
		// the registry filled between the two adjacent writes the per-model
		// split could differ while the total still held. Totals are invariant
		// to that, so only a real writer defect fires.
		const snap = snapshotOf(
			tierExposition(
				[{tier: 'tier0', model: 'a', value: 4}, {tier: 'tier0', model: 'other', value: 5}],
				[{model: 'a', value: 5}, {model: 'other', value: 4}],
			),
			T1,
		);
		expect(tier0Reconciliation(snap)).toEqual({kind: 'agrees', selections: 9});
	});

	it('is not comparable when either family is absent', () => {
		// The expected reading on a gateway that has taken no Tier-0
		// selection: neither counter has a child, and silence is not a
		// mismatch.
		const noHits = snapshotOf(tierExposition([{tier: 'tier2', value: 3}]), T1);
		expect(tier0Reconciliation(noHits)).toEqual({kind: 'not-comparable'});
		const noTiers = snapshotOf(`${PD_SESSION_HITS}{model="m1"} 3`, T1);
		expect(tier0Reconciliation(noTiers)).toEqual({kind: 'not-comparable'});
		expect(tier0Reconciliation(undefined)).toEqual({kind: 'not-comparable'});
	});

	it('does not turn a non-finite sample into a mismatch', () => {
		const snap = snapshotOf(
			`${PD_TIER_SELECTED}{tier="tier0",model="m1"} 5\n${PD_TIER_SELECTED}{tier="tier0",model="m2"} NaN\n${PD_SESSION_HITS}{model="m1"} 5`,
			T1,
		);
		expect(tier0Reconciliation(snap)).toEqual({kind: 'agrees', selections: 5});
	});
});

//---------------------------------------------------------
// The verdict
//---------------------------------------------------------

describe('affinityVerdict', () => {
	it('calls a tier2-only mix as-configured when neither affinity gate is open', () => {
		// ⭐⭐ The trap this panel exists to avoid. The datapath never attempts
		// Tier-1 or Tier-1.5 here, so 0% affinity is the configured behaviour
		// and reporting it as a failure would raise an alarm on a correct
		// gateway.
		expect(affinityVerdict({kind: 'ok', ratio: 0}, PD_ONLY)).toBe('as-configured');
	});

	it('flags zero reuse only when an affinity gate IS open', () => {
		// ⭐ The one actionable state: the affinity machinery is configured,
		// traffic is flowing, and nothing reaches it.
		expect(affinityVerdict({kind: 'ok', ratio: 0}, OPEN_ALL)).toBe('configured-no-reuse');
		expect(affinityVerdict({kind: 'ok', ratio: 0}, {...PD_ONLY, kvExact: true})).toBe('configured-no-reuse');
		expect(affinityVerdict({kind: 'ok', ratio: 0.2}, OPEN_ALL)).toBe('reuse-working');
	});

	it('withholds the verdict rather than guessing, when traffic or configuration is unknown', () => {
		// No traffic wins over every gate combination: 0/0 measured nothing.
		expect(affinityVerdict({kind: 'no-traffic'}, OPEN_ALL)).toBe('no-traffic');
		expect(affinityVerdict({kind: 'no-traffic'}, PD_ONLY)).toBe('no-traffic');
		// Without the rule list "expected" cannot be told from "broken".
		expect(affinityVerdict({kind: 'ok', ratio: 0}, undefined)).toBe('unknown-configuration');
		// An underivable share qualifies a verdict; it never manufactures the
		// bad one.
		expect(affinityVerdict({kind: 'not-derivable', reason: 'gap'}, OPEN_ALL)).toBe('unknown-configuration');
	});
});
