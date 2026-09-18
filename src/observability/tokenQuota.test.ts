import {describe, expect, it} from 'vitest';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from './parser';
import {absenceReading} from './familyActivation';
import {
	NO_QUOTA_DEFAULTS,
	QUOTA_SCOPES,
	QuotaScope,
	TOKEN_QUOTA_COLD_OPEN,
	TOKEN_QUOTA_FAMILIES,
	effectiveLimit,
	quotaPressure,
	quotaScope,
	quotaVerdict,
	readQuotaScope,
	resolveQuotaDefaults,
	scopeAbsence,
	storeStateFromError,
	tokenQuotaReport,
} from './tokenQuota';

const T0 = 1_700_000_000_000;

function snapshotOf(text: string, failure?: IMetricsSnapshot['failure']): IMetricsSnapshot {
	const parsed = parseExposition(text);
	return {
		instanceId: 1,
		flavor: 'inference-gateway',
		receivedAtMs: T0,
		available: true,
		failure,
		families: parsed.families,
		diagnostics: parsed.diagnostics,
	};
}

const ALL_SCOPES: readonly QuotaScope[] = ['tenant', 'tenant-model', 'user', 'user-model', 'key', 'vip'];

const input = (over: Partial<Parameters<typeof tokenQuotaReport>[0]> = {}) => ({
	snapshot: undefined,
	storeState: 'readable' as const,
	anyLimitResolves: false,
	userIdentityAvailable: true,
	...over,
});

//---------------------------------------------------------
// The family set, against the artifact rather than the brief
//---------------------------------------------------------

describe('the scope table', () => {
	it('covers six scopes and twelve gauges, not the brief’s five and eight', () => {
		expect(QUOTA_SCOPES).toHaveLength(6);
		expect(new Set(QUOTA_SCOPES.flatMap(s => [s.utilization, s.limit])).size).toBe(12);
	});

	it('names every scope in the union, so quotaScope never returns undefined', () => {
		for (const scope of ALL_SCOPES) expect(quotaScope(scope).scope).toBe(scope);
	});

	// ⚠️ The registry entry is built from this list; a family dropped here
	// would silently un-declare a capability requirement.
	it('exports the twelve gauges plus the two counters for the registry', () => {
		expect(TOKEN_QUOTA_FAMILIES).toHaveLength(14);
		expect(new Set(TOKEN_QUOTA_FAMILIES).size).toBe(14);
	});

	// ⭐ Stage 3.5's machinery already answers "is absence expected?" for
	// these. Pinned so a re-vendor that changes an activation code fails here
	// rather than silently turning the panel's explanation into a fault
	// report.
	it('leaves every gauge a conditional absence per the manifest', () => {
		for (const s of QUOTA_SCOPES) {
			for (const family of [s.utilization, s.limit]) {
				const reading = absenceReading(family);
				expect(reading.kind, family).toBe('conditional');
			}
		}
	});
});

//---------------------------------------------------------
// The store state — the whole point of the panel
//---------------------------------------------------------

describe('storeStateFromError', () => {
	it('separates an unconfigured store from an unreachable one', () => {
		expect(storeStateFromError(503, 'ai_key_store_unconfigured')).toBe('unconfigured');
		expect(storeStateFromError(503, 'ai_key_store_unavailable')).toBe('unavailable');
	});

	// ⚠️ Deny by default. A 503 the gateway grows later must not be read as
	// the benign one — that is the direction that hides a fail-open.
	it('reads an unrecognised 503 code as unknown, never as unconfigured', () => {
		expect(storeStateFromError(503, 'ai_key_store_migrating')).toBe('unknown');
		expect(storeStateFromError(503, undefined)).toBe('unknown');
	});

	it('reads any other status as unknown', () => {
		expect(storeStateFromError(500, 'ai_key_store_unconfigured')).toBe('unknown');
		expect(storeStateFromError(undefined, undefined)).toBe('unknown');
	});
});

//---------------------------------------------------------
// The QoS defaults ladder
//---------------------------------------------------------

describe('resolveQuotaDefaults', () => {
	it('uses the global row when there is no rule row', () => {
		expect(resolveQuotaDefaults({defaultTenantTpm: 100, defaultUserTpm: 50, vipSharedTpm: 10}, undefined))
			.toEqual({tenantTpm: 100, userTpm: 50, vipTpm: 10});
	});

	// ⚠️⚠️ The defect this pins: a rule row is a FIELD-WISE override, not a
	// replacement. `resolveQoSDefaults` overrides only where the rule value is
	// positive, so a rule setting just the VIP bound still inherits the global
	// tenant and user defaults. Treating it as a whole-record override would
	// report "no tenant default" on a gateway that has one.
	it('overrides field-wise and keeps the global value where the rule is silent', () => {
		expect(resolveQuotaDefaults(
			{defaultTenantTpm: 100, defaultUserTpm: 50, vipSharedTpm: 10},
			{vipSharedTpm: 999},
		)).toEqual({tenantTpm: 100, userTpm: 50, vipTpm: 999});
	});

	it('ignores a non-positive rule value rather than clearing the global one', () => {
		expect(resolveQuotaDefaults({defaultTenantTpm: 100}, {defaultTenantTpm: 0}).tenantTpm).toBe(100);
		expect(resolveQuotaDefaults({defaultTenantTpm: 100}, {defaultTenantTpm: -5}).tenantTpm).toBe(100);
	});

	it('answers zero for missing rows rather than undefined', () => {
		expect(resolveQuotaDefaults(undefined, undefined)).toEqual(NO_QUOTA_DEFAULTS);
	});
});

describe('effectiveLimit', () => {
	const defaults = {tenantTpm: 100, userTpm: 50, vipTpm: 10};

	it('prefers an explicit limit and says so', () => {
		expect(effectiveLimit('tenant', 700, defaults)).toEqual({tpm: 700, source: 'explicit'});
	});

	it('falls through to the defaults for the two aggregate scopes', () => {
		expect(effectiveLimit('tenant', 0, defaults)).toEqual({tpm: 100, source: 'default'});
		expect(effectiveLimit('user', undefined, defaults)).toEqual({tpm: 50, source: 'default'});
	});

	// ⚠️⚠️ The asymmetry that makes this function necessary. `quotaBucketsFor`
	// substitutes a default for the tenant and user AGGREGATES only; the
	// per-model, per-user-model and per-key scopes have no default anywhere,
	// so an unset limit there means no bucket at all. Falling through for them
	// would promise enforcement the gateway never performs.
	it('does NOT fall through for the per-model, user-model or key scopes', () => {
		expect(effectiveLimit('tenant-model', 0, defaults)).toBeUndefined();
		expect(effectiveLimit('user-model', undefined, defaults)).toBeUndefined();
		expect(effectiveLimit('key', 0, defaults)).toBeUndefined();
	});

	// ⭐ VIP is the mirror image: no explicit entry exists, the default IS the
	// configuration.
	it('reads VIP from the defaults alone', () => {
		expect(effectiveLimit('vip', undefined, defaults)).toEqual({tpm: 10, source: 'default'});
		expect(effectiveLimit('vip', undefined, NO_QUOTA_DEFAULTS)).toBeUndefined();
	});

	it('treats a non-finite or non-positive explicit limit as unset', () => {
		expect(effectiveLimit('tenant-model', Number.NaN, defaults)).toBeUndefined();
		expect(effectiveLimit('tenant-model', -1, defaults)).toBeUndefined();
	});
});

//---------------------------------------------------------
// Pressure — the clamp trap
//---------------------------------------------------------

describe('quotaPressure', () => {
	// ⚠️⚠️ Utilization above 1.0 is the limiter working as designed: a settled
	// response put the bucket into post-hoc debt. Clamping it, or calling it
	// an error, is the trap this stage was briefed on.
	it('reports debt above 1.0 without clamping', () => {
		expect(quotaPressure(1.1)).toBe('in-debt');
		expect(quotaPressure(12)).toBe('in-debt');
	});

	// ⚠️ Exactly 1.0 denies the next request, so it is not "within".
	it('reports exactly 1.0 as saturated', () => {
		expect(quotaPressure(1)).toBe('saturated');
		expect(quotaPressure(0.999)).toBe('within');
	});
});

//---------------------------------------------------------
// Rows off the exposition
//---------------------------------------------------------

const TENANT = quotaScope('tenant');

describe('readQuotaScope', () => {
	it('reports absent when neither family is on the scrape', () => {
		const r = readQuotaScope(snapshotOf('# nothing\n'), 'tenant');
		expect(r.absent).toBe(true);
		expect(r.rows).toEqual([]);
	});

	it('reports absent for a failed scrape rather than inventing an explanation', () => {
		const snap = snapshotOf(`${TENANT.utilization}{tenant="a"} 0.5`, {kind: 'network', message: 'down'} as never);
		expect(readQuotaScope(snap, 'tenant').absent).toBe(true);
	});

	it('joins utilization to its limit and derives headroom from the gateway’s own formula', () => {
		const r = readQuotaScope(snapshotOf([
			`${TENANT.utilization}{tenant="acme"} 0.25`,
			`${TENANT.limit}{tenant="acme"} 1000`,
		].join('\n')), 'tenant');
		expect(r.absent).toBe(false);
		expect(r.rows).toEqual([{
			scope: 'tenant',
			labels: {tenant: 'acme'},
			utilization: 0.25,
			limitTokens: 1000,
			headroomTokens: 750,
			pressure: 'within',
		}]);
	});

	// ⚠️ Headroom stays NEGATIVE in debt. The magnitude is how far past the
	// bound the settle went, and flooring it at zero would erase that.
	it('keeps headroom negative while the bucket is in debt', () => {
		const r = readQuotaScope(snapshotOf([
			`${TENANT.utilization}{tenant="acme"} 1.1`,
			`${TENANT.limit}{tenant="acme"} 10`,
		].join('\n')), 'tenant');
		expect(r.rows[0].headroomTokens).toBeCloseTo(-1);
		expect(r.rows[0].pressure).toBe('in-debt');
	});

	it('keeps buckets of one scope separate', () => {
		const r = readQuotaScope(snapshotOf([
			`${TENANT.utilization}{tenant="a"} 0.1`,
			`${TENANT.limit}{tenant="a"} 100`,
			`${TENANT.utilization}{tenant="b"} 0.2`,
			`${TENANT.limit}{tenant="b"} 200`,
		].join('\n')), 'tenant');
		expect(r.rows.map(x => x.labels.tenant)).toEqual(['a', 'b']);
	});

	it('joins a multi-label scope on every declared label', () => {
		const um = quotaScope('user-model');
		const r = readQuotaScope(snapshotOf([
			`${um.utilization}{tenant="t",user="u",model="m1"} 0.5`,
			`${um.limit}{tenant="t",user="u",model="m1"} 20`,
			`${um.utilization}{tenant="t",user="u",model="m2"} 0.9`,
			`${um.limit}{tenant="t",user="u",model="m2"} 40`,
		].join('\n')), 'user-model');
		expect(r.rows.map(x => [x.labels.model, x.limitTokens])).toEqual([['m1', 20], ['m2', 40]]);
	});

	// ⭐ Both anomalies are impossible from `tokenQuotaCollector.Collect` —
	// the pair is emitted in one loop iteration and a bucket with Limit <= 0
	// is skipped before anything is emitted. So they are defects worth
	// surfacing, not states to render.
	it('reports a utilization with no limit as an unpaired series', () => {
		const r = readQuotaScope(snapshotOf(`${TENANT.utilization}{tenant="a"} 0.5`), 'tenant');
		expect(r.rows).toEqual([]);
		expect(r.anomalies).toEqual([{scope: 'tenant', labels: {tenant: 'a'}, kind: 'unpaired-series'}]);
	});

	it('reports a limit with no utilization as an unpaired series too', () => {
		const r = readQuotaScope(snapshotOf(`${TENANT.limit}{tenant="a"} 100`), 'tenant');
		expect(r.anomalies).toEqual([{scope: 'tenant', labels: {tenant: 'a'}, kind: 'unpaired-series'}]);
	});

	it('reports a non-positive limit rather than dividing by it', () => {
		const r = readQuotaScope(snapshotOf([
			`${TENANT.utilization}{tenant="a"} 0`,
			`${TENANT.limit}{tenant="a"} 0`,
		].join('\n')), 'tenant');
		expect(r.rows).toEqual([]);
		expect(r.anomalies).toEqual([{scope: 'tenant', labels: {tenant: 'a'}, kind: 'non-positive-limit'}]);
	});

	it('does not turn a non-finite sample into a row', () => {
		const r = readQuotaScope(snapshotOf([
			`${TENANT.utilization}{tenant="a"} NaN`,
			`${TENANT.limit}{tenant="a"} 100`,
		].join('\n')), 'tenant');
		expect(r.rows).toEqual([]);
		expect(r.anomalies[0].kind).toBe('unpaired-series');
	});

	// ⚠️ A present family with no children is not the same as an absent one:
	// the collector answered and had nothing to publish.
	it('separates a present-but-empty family from an absent one', () => {
		const r = readQuotaScope(snapshotOf([
			`# TYPE ${TENANT.utilization} gauge`,
			`# TYPE ${TENANT.limit} gauge`,
		].join('\n')), 'tenant');
		expect(r.absent).toBe(false);
		expect(r.rows).toEqual([]);
	});
});

//---------------------------------------------------------
// The verdict
//---------------------------------------------------------

describe('quotaVerdict', () => {
	// ⭐ The live-verified path: every config endpoint on the testbed answers
	// 503 ai_key_store_unconfigured and all twelve gauges are absent.
	it('calls an unconfigured store not-configurable', () => {
		expect(quotaVerdict(input({storeState: 'unconfigured'}), false)).toBe('not-configurable');
	});

	// ⚠️⚠️ THE FINDING. Identical empty exposition, opposite meaning: the
	// store is configured and unreachable, quotaBucketsFor drops every bucket,
	// and traffic that should be throttled is being admitted.
	it('calls an unreachable store an offline enforcement, not an empty one', () => {
		expect(quotaVerdict(input({storeState: 'unavailable'}), false)).toBe('enforcement-offline');
	});

	it('separates a readable store with no limits from one with limits but no buckets', () => {
		expect(quotaVerdict(input({anyLimitResolves: false}), false)).toBe('unconfigured');
		expect(quotaVerdict(input({anyLimitResolves: true}), false)).toBe('idle');
	});

	// ⚠️ 3.4's fourth state. A configuration read that failed for an unknown
	// reason cannot be defaulted to either side.
	it('reports indeterminate rather than guessing when the store state is unknown', () => {
		expect(quotaVerdict(input({storeState: 'unknown'}), false)).toBe('indeterminate');
	});

	// ⭐ Series on the wire prove the store answered at scrape time, so they
	// outrank a configuration read that failed for its own reasons.
	it('reports active on rows even when the configuration read failed', () => {
		for (const state of ['unknown', 'unavailable', 'unconfigured', 'readable'] as const) {
			expect(quotaVerdict(input({storeState: state}), true)).toBe('active');
		}
	});
});

describe('tokenQuotaReport', () => {
	it('reads every scope and flattens their rows', () => {
		const key = quotaScope('key');
		const report = tokenQuotaReport(input({
			snapshot: snapshotOf([
				`${TENANT.utilization}{tenant="a"} 0.5`,
				`${TENANT.limit}{tenant="a"} 100`,
				`${key.utilization}{key_id="df53abcb"} 1.1`,
				`${key.limit}{key_id="df53abcb"} 10`,
			].join('\n')),
		}));
		expect(report.scopes).toHaveLength(6);
		expect(report.rows).toHaveLength(2);
		expect(report.verdict).toBe('active');
		expect(report.rows.map(r => r.scope)).toEqual(['tenant', 'key']);
	});

	// ⭐ The manifest's own runtime evidence, rendered: key_id=df53… at
	// utilization 1.1 against limit 10, over 1.0 because the 12-token answer
	// put the bucket in post-hoc debt.
	it('renders the manifest’s recorded live over-quota reading without clamping it', () => {
		const key = quotaScope('key');
		const report = tokenQuotaReport(input({
			snapshot: snapshotOf([
				`${key.utilization}{key_id="df53abcbe67680c2a15d83d5f9dd82d4"} 1.1`,
				`${key.limit}{key_id="df53abcbe67680c2a15d83d5f9dd82d4"} 10`,
			].join('\n')),
		}));
		expect(report.rows[0].utilization).toBe(1.1);
		expect(report.rows[0].pressure).toBe('in-debt');
		expect(report.rows[0].headroomTokens).toBeCloseTo(-1);
	});

	// ⚠️ Independent of the verdict: a gateway can be actively metering AND
	// have cold-opened after a restart, which means a window went unmetered.
	it('reports a cold open alongside an active verdict', () => {
		const report = tokenQuotaReport(input({
			snapshot: snapshotOf([
				`${TENANT.utilization}{tenant="a"} 0.5`,
				`${TENANT.limit}{tenant="a"} 100`,
				`${TOKEN_QUOTA_COLD_OPEN} 2`,
			].join('\n')),
		}));
		expect(report.verdict).toBe('active');
		expect(report.coldOpened).toBe(true);
	});

	it('does not report a cold open on a zero counter or a missing family', () => {
		expect(tokenQuotaReport(input({snapshot: snapshotOf(`${TOKEN_QUOTA_COLD_OPEN} 0`)})).coldOpened).toBe(false);
		expect(tokenQuotaReport(input({snapshot: snapshotOf('# nothing\n')})).coldOpened).toBe(false);
	});

	it('matches the live testbed: store unconfigured, cold-open at zero, no gauges', () => {
		const report = tokenQuotaReport(input({
			storeState: 'unconfigured',
			snapshot: snapshotOf(`${TOKEN_QUOTA_COLD_OPEN} 0`),
		}));
		expect(report.verdict).toBe('not-configurable');
		expect(report.rows).toEqual([]);
		expect(report.anomalies).toEqual([]);
		expect(report.coldOpened).toBe(false);
		expect(report.scopes.every(s => s.absent)).toBe(true);
	});
});

//---------------------------------------------------------
// Per-scope absence
//---------------------------------------------------------

describe('scopeAbsence', () => {
	const withUser = {userIdentityUnavailable: false};
	const withoutUser = {userIdentityUnavailable: true};

	// ⚠️⚠️ Checked before the limit, and mutating the order must break this.
	// A user-scoped family on an X-Api-Key-only gateway is absent whatever
	// limit is configured, so answering "no limit" would send an operator to
	// configure something that changes nothing — the same ordering trap 3.5
	// hit with its precondition.
	it('reports no-user-identity ahead of a missing limit for the user scopes', () => {
		expect(scopeAbsence('user', withoutUser, false)).toBe('no-user-identity');
		expect(scopeAbsence('user-model', withoutUser, false)).toBe('no-user-identity');
	});

	it('still reports no-user-identity when the user limit IS configured', () => {
		expect(scopeAbsence('user', withoutUser, true)).toBe('no-user-identity');
	});

	it('does not apply the user-identity reason to the scopes that never need one', () => {
		for (const scope of ['tenant', 'tenant-model', 'key', 'vip'] as const) {
			expect(scopeAbsence(scope, withoutUser, false)).toBe('no-limit');
		}
	});

	it('reports awaiting-charge only where a bucket is created by the charge', () => {
		expect(scopeAbsence('key', withUser, true)).toBe('awaiting-charge');
		expect(scopeAbsence('vip', withUser, true)).toBe('awaiting-charge');
	});

	// ⭐ The tenant and user ladders are published from resolved store state,
	// so a configured limit with no series there is NOT explained by "nothing
	// charged yet" — it is unexplained, and saying so is the honest answer.
	it('does not explain an absent tenant or user scope as awaiting a charge', () => {
		expect(scopeAbsence('tenant', withUser, true)).toBe('unexplained');
		expect(scopeAbsence('user', withUser, true)).toBe('unexplained');
	});
});
