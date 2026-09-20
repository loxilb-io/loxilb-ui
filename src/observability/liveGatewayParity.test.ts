// Live-gateway parity check.
//
// Drives the UI's REAL exposition parser + selectors with the REAL /netlox/v1/metrics
// payload captured from the live cicd gateway (llb1, vllm-kvcache-routing-cpu topology,
// KV-exact Tier-1.5 active). It answers one question the unit tests cannot: does the UI
// derive the same numbers the gateway actually emitted, for the AI + KV-tier families?
import fs from 'fs';
import path from 'path';
import {describe, expect, it} from 'vitest';
import {parseExposition} from './parser';
import {IMetricsSnapshot} from 'types/observability';
import {aggregateSum, selectFamily, selectSamples, selectScalar} from './selectors';
import {buildEpJoinIndex, joinEp} from './pdJoin';
import {AI_REQUESTS, hasOutcomePartition} from './aiRequests';
import {QUOTA_SCOPES, TOKEN_QUOTA_COLD_OPEN, tokenQuotaReport} from './tokenQuota';

// ⚠️⚠️ FIXTURE LOST, 2026-09-18, AND NOT RE-CAPTURABLE ON THE CURRENT BED.
// `live-metrics-cicd.txt` held a capture from the CICD gateway (llb1,
// vllm-kvcache-routing-cpu, KV-exact Tier-1.5 active). It was overwritten with
// a capture of the loxilb-igw testbed, which runs no KV-tier traffic, and it
// was untracked, so there is no copy to restore.
//
// ⚠️ Re-capturing it is blocked on the GATEWAY, not on anyone's diligence:
// re-probed 2026-09-20, llb1 emits none of `loxilb_pd_kv_tier15_hits_total`,
// `loxilb_pd_kv_blocks`, `loxilb_kv_subscriber_connected` or
// `loxilb_ai_requests_total`. KV-exact traffic cannot be generated there while
// the gateway refuses every KV-exact rule for want of `LLB_KV_NONE_HASH_SEED`
// in its launch environment — see GW-KV-1 in the gateway hand-off. Close that
// and this block comes back on its own.
//
// ⭐ The block below is therefore SKIPPED, VISIBLY, rather than deleted: the
// assertions are the specification of what parity means for the KV families,
// and they are worth more parked in the suite than lost with the fixture.
// Drop a cicd capture at `live-metrics-cicd.txt` and 17 tests light up.
const CICD = path.join(__dirname, 'live-metrics-cicd.txt');
const HAVE_CICD = fs.existsSync(CICD);
const RAW = HAVE_CICD ? fs.readFileSync(CICD, 'utf8') : '';

const FIXED_RECEIVED_AT = Date.UTC(2026, 8, 18, 0, 0, 0);

// The loxilb-igw testbed, re-captured 2026-09-18 for Stage 3.6.
const RAW_IGW = fs.readFileSync(path.join(__dirname, 'live-metrics-igw.txt'), 'utf8');

/** Ground truth read straight out of the exposition text, independent of the parser. */
function rawSum(name: string): number {
	const re = new RegExp('^' + name + '(?:\\{[^}]*\\})? ([0-9.eE+-]+)$', 'gm');
	let t = 0, m: RegExpExecArray | null;
	while ((m = re.exec(RAW)) !== null) t += parseFloat(m[1]);
	return t;
}
function rawSeriesCount(name: string): number {
	return (RAW.match(new RegExp('^' + name + '(?:\\{[^}]*\\})? ', 'gm')) || []).length;
}

describe.skipIf(!HAVE_CICD)('live gateway parity — AI + KV tier families', () => {
	// parseExposition returns families+diagnostics only; the selectors take a
	// full snapshot. Envelope fields are fixed constants — this file asserts
	// parity of values, never anything time- or instance-dependent.
	const parsed = parseExposition(RAW);
	const snap: IMetricsSnapshot = {
		instanceId: 1,
		flavor: 'inference-gateway',
		receivedAtMs: 0,
		available: true,
		families: parsed.families,
		diagnostics: parsed.diagnostics,
	};

	it('parses the live payload without dropping loxilb families', () => {
		const rawFamilies = new Set(
			(RAW.match(/^loxilb_[a-z0-9_]+/gm) || []).map(n =>
				n.replace(/_(bucket|sum|count)$/, '')),
		);
		const parsed = new Set<string>();
		for (const f of rawFamilies) if (selectFamily(snap, f)) parsed.add(f);
		// every family present in the text must be reachable through the UI selector
		expect([...rawFamilies].filter(f => !parsed.has(f))).toEqual([]);
		expect(parsed.size).toBeGreaterThan(50);
	});

	const EXACT: string[] = [
		'loxilb_pd_kv_tier15_hits_total',
		'loxilb_pd_kv_tier15_fallthrough_total',
		'loxilb_pd_kv_tier15_miss_reason_total',
		'loxilb_pd_kv_tier15_cold_seeds_total',
		'loxilb_pd_kv_blocks',
		'loxilb_kv_subscriber_connected',
		'loxilb_kv_inventory_fresh',
		'loxilb_ai_requests_total',
		'loxilb_ai_pd_requests_total',
		'loxilb_ai_pd_kv_params_missing_total',
	];

	it.each(EXACT)('aggregates %s exactly as the gateway emitted it', name => {
		const samples = selectSamples(snap, name);
		expect(samples.length).toBe(rawSeriesCount(name));
		const agg = aggregateSum(samples);
		expect(agg.value).toBeCloseTo(rawSum(name), 6);
	});

	it('preserves the tier-1.5 per-endpoint breakdown (ep_idx labels)', () => {
		const hits = selectSamples(snap, 'loxilb_pd_kv_tier15_hits_total');
		const byEp = new Map(hits.map(s => [s.labels.ep_idx, s.value]));
		// the cicd topology pins prefill EPs at non-adjacent absolute indices 0/2/4
		expect([...byEp.keys()].sort()).toEqual(['0', '2', '4']);
		for (const v of byEp.values()) expect(v).toBeGreaterThan(0);
	});

	it('reproduces the tier accounting invariant requests == t0 + t15 hits + fallthrough', () => {
		const qwen = selectSamples(snap, AI_REQUESTS)
			.filter(s => (s.labels.model || '').includes('Qwen'))
			.reduce((a, s) => a + s.value, 0);
		// aggregateSum reports an ABSENT family as undefined, never 0 (selectors.ts:55).
		// Tier-0 never hit in this capture, so its family has no series at all; for the
		// arithmetic identity an absent tier contributes nothing.
		const v = (n: string) => aggregateSum(selectSamples(snap, n)).value ?? 0;
		expect(v('loxilb_ai_pd_session_hits_total')).toBe(0);          // absent -> coerced
		expect(qwen).toBe(
			v('loxilb_pd_kv_tier15_hits_total') +
			v('loxilb_pd_kv_tier15_fallthrough_total') +
			v('loxilb_ai_pd_session_hits_total'));
	});

	it('reports an absent family as undefined rather than zero', () => {
		// the contract that keeps a dead pipeline from rendering as "0 errors"
		expect(aggregateSum(selectSamples(snap, 'loxilb_ai_pd_session_hits_total')).value)
			.toBeUndefined();
		expect(aggregateSum(selectSamples(snap, 'loxilb_pd_kv_tier15_spills_total')).value)
			.toBeUndefined();
	});

	it('exposes the outcome partition the AI rate logic depends on', () => {
		expect(hasOutcomePartition(snap)).toBe(true);
	});

	it('joins KV subscriber state to prefill endpoints', () => {
		const idx = buildEpJoinIndex(snap);
		for (const ep of ['0', '2', '4']) {
			const r = joinEp(idx, '1', ep);
			expect(r).toBeDefined();
		}
	});

	it('reads gauge scalars (trie nodes / sessions active) without inventing values', () => {
		for (const g of ['loxilb_pd_trie_nodes', 'loxilb_pd_sessions_active']) {
			const v = selectScalar(snap, g);
			expect(v).toBeDefined();
		}
	});
});

// Stage 3.6 — the quota panel against the real scrape, re-captured 2026-09-18.
// The live gateway answers 503 ai_key_store_unconfigured on EVERY quota-config
// endpoint (/config/ai/ratelimit/defaults/{global,rule},
// /config/ai/tenant/ratelimit/{id}, /config/ai/user/ratelimit/{id}), so this
// pins the verdict the panel must reach on a gateway in that state.
describe('live gateway parity — token quota (Stage 3.6)', () => {
	const parsed = parseExposition(RAW_IGW);
	const igwSeriesCount = (name: string) => (RAW_IGW.match(new RegExp('^' + name + '(?:\\{[^}]*\\})? ', 'gm')) || []).length;
	const igwSum = (name: string) => {
		const re = new RegExp('^' + name + '(?:\\{[^}]*\\})? ([0-9.eE+-]+)$', 'gm');
		let total = 0, m: RegExpExecArray | null;
		while ((m = re.exec(RAW_IGW)) !== null) total += parseFloat(m[1]);
		return total;
	};
	const snapshot: IMetricsSnapshot = {
		// Fixed, not Date.now(): this file asserts parity of VALUES and must not
		// acquire a clock dependence it does not need.
		instanceId: 1, flavor: 'inference-gateway', receivedAtMs: FIXED_RECEIVED_AT,
		available: true, families: parsed.families, diagnostics: parsed.diagnostics,
	};

	it('finds none of the twelve quota gauges on the wire', () => {
		for (const s of QUOTA_SCOPES) {
			expect(igwSeriesCount(s.utilization), s.utilization).toBe(0);
			expect(igwSeriesCount(s.limit), s.limit).toBe(0);
		}
	});

	// The eager counter IS there at 0 — which is what proves the twelve above
	// are absent because they are lazy, not because the collector is missing.
	it('finds the eager cold-open counter present at zero', () => {
		expect(igwSeriesCount(TOKEN_QUOTA_COLD_OPEN)).toBe(1);
		expect(igwSum(TOKEN_QUOTA_COLD_OPEN)).toBe(0);
	});

	it('reaches not-configurable, with no anomaly and no cold open', () => {
		const report = tokenQuotaReport({
			snapshot, storeState: 'unconfigured', anyLimitResolves: false, userIdentityAvailable: false,
		});
		expect(report.verdict).toBe('not-configurable');
		expect(report.rows).toEqual([]);
		expect(report.anomalies).toEqual([]);
		expect(report.coldOpened).toBe(false);
		expect(report.scopes.every(x => x.absent)).toBe(true);
	});

	// ⚠️⚠️ The same wire, the other store code: the panel must flip to the
	// alarm on the configuration read alone.
	it('flips to enforcement-offline on the SAME scrape when the store is unavailable', () => {
		const report = tokenQuotaReport({
			snapshot, storeState: 'unavailable', anyLimitResolves: false, userIdentityAvailable: false,
		});
		expect(report.verdict).toBe('enforcement-offline');
	});
});
