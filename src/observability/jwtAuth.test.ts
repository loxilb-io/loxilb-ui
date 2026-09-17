import {describe, expect, it} from 'vitest';
import {IMetricsSnapshot} from 'types/observability';
import {parseExposition} from './parser';
import {
	bearerAdmission,
	classifyBearerReason,
	JWKS_KEYS,
	JWKS_LAST_SUCCESS,
	JWKS_REFRESH,
	JWKS_USABLE,
	JWT_VALIDATION,
	jwksHealthFor,
	jwksProfileLabel,
	lastSuccessAge,
} from './jwtAuth';

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

// The gateway's own clock, in the units the timestamp family uses.
const SECS = (ms: number) => ms / 1000;

interface IKeysetLine {
	profile: string;
	usable: 0 | 1;
	keys?: number;
	lastSuccessSec?: number;
	refreshSuccess?: number;
	refreshFailure?: number;
}

function keysetExposition(...profiles: IKeysetLine[]): string {
	const lines: string[] = [];
	for (const p of profiles) {
		lines.push(`${JWKS_USABLE}{profile="${p.profile}"} ${p.usable}`);
		if (p.keys !== undefined) lines.push(`${JWKS_KEYS}{profile="${p.profile}"} ${p.keys}`);
		// Upstream emits NO series before the first success — never a zero.
		if (p.lastSuccessSec !== undefined) lines.push(`${JWKS_LAST_SUCCESS}{profile="${p.profile}"} ${p.lastSuccessSec}`);
		if (p.refreshSuccess !== undefined) lines.push(`${JWKS_REFRESH}{profile="${p.profile}",outcome="success"} ${p.refreshSuccess}`);
		if (p.refreshFailure !== undefined) lines.push(`${JWKS_REFRESH}{profile="${p.profile}",outcome="failure"} ${p.refreshFailure}`);
	}
	return lines.join('\n');
}

// The hook hands the CURRENT snapshot separately from the rate history, so
// every call site here mirrors that. `tail` is only a convenience for the
// common case where they agree; the "first observation" cases below pass them
// apart deliberately.
const tail = (h: readonly IMetricsSnapshot[]) => h[h.length - 1];

const kindOf = (report: ReturnType<typeof jwksHealthFor>, profile: string) =>
	report.kind === 'ok' ? report.byProfile.find(p => p.profile === profile)?.kind : undefined;

describe('JWKS profile label join', () => {
	it('leaves a label-safe name alone', () => {
		expect(jwksProfileLabel('realm-a')).toBe('realm-a');
		expect(jwksProfileLabel('realm.a_1')).toBe('realm.a_1');
	});

	it('replaces each UTF-8 BYTE the gateway rejects, not each character', () => {
		// The gateway sanitizes over bytes (Go regexp on a string), so one
		// three-byte Hangul syllable becomes THREE underscores. A JS
		// String.replace would produce one and the join would silently miss
		// every non-ASCII profile — which is most of them in this product.
		expect(jwksProfileLabel('테')).toBe('___');
		expect(jwksProfileLabel('realm 테')).toBe('realm____');
		// Astral plane: 4 UTF-8 bytes, 2 JS code units.
		expect(jwksProfileLabel('\u{1F510}')).toBe('____');
	});

	it('replaces the punctuation an operator is most likely to type', () => {
		expect(jwksProfileLabel('realm a')).toBe('realm_a');
		expect(jwksProfileLabel('realm:a/b')).toBe('realm_a_b');
	});

	it('truncates at 64 bytes, after replacement, exactly as upstream does', () => {
		expect(jwksProfileLabel('p'.repeat(70))).toBe('p'.repeat(64));
		// 30 syllables = 90 bytes of underscore, cut to 64.
		expect(jwksProfileLabel('테'.repeat(30))).toBe('_'.repeat(64));
	});
});

describe('JWKS last-success age', () => {
	it('reports never when the series is absent, rather than an epoch age', () => {
		expect(lastSuccessAge(undefined, T0)).toEqual({kind: 'never'});
	});

	it('measures the age against the observation, not the render clock', () => {
		// Using Date.now() here would make the value depend on when the test
		// runs; the snapshot's own receive time is both reproducible and the
		// honest reference for data taken at that moment.
		expect(lastSuccessAge(SECS(T0) - 120, T0)).toEqual({kind: 'ok', ageSec: 120});
	});

	it('absorbs ordinary skew but reports a gateway clock genuinely ahead', () => {
		expect(lastSuccessAge(SECS(T0) + 5, T0)).toEqual({kind: 'ok', ageSec: 0});
		expect(lastSuccessAge(SECS(T0) + 3600, T0)).toEqual({kind: 'clock-skew', aheadSec: 3600});
	});
});

describe('JWKS keyset health', () => {
	it('says nothing is known when the scrape did not confirm', () => {
		const failed = snapshotOf(keysetExposition({profile: 'a', usable: 1}), T0, {status: 'denied'} as never);
		expect(jwksHealthFor(['a'], tail([failed]), [failed], GAP).kind).toBe('unavailable');
		expect(jwksHealthFor(['a'], tail([]), [], GAP).kind).toBe('unavailable');
	});

	it('⭐ reads the FIRST observation as warming up, never as a failed scrape', () => {
		// Found on the live gateway: the retention ring is filled in an effect,
		// so a page legitimately holds a snapshot while `history` is still
		// empty. Reading the current snapshot off the history tail answered
		// "unavailable" there — which means "the scrape did not answer", an
		// alarming claim about a gateway that had just answered fine.
		const only = snapshotOf(keysetExposition({profile: 'a', usable: 1, keys: 2, lastSuccessSec: SECS(T0)}), T0);
		const report = jwksHealthFor(['a'], only, [], GAP);
		expect(report.kind).toBe('ok');
		if (report.kind !== 'ok') throw new Error('expected ok');
		// The gauges are readable from one observation; only the rates are not.
		expect(report.byProfile[0].kind).toBe('healthy');
		expect(report.byProfile[0].keys).toBe(2);
		expect(report.byProfile[0].refreshSuccess).toEqual({kind: 'insufficient-samples'});
	});

	it('separates "the gateway exports no keyset health" from "this profile is unhealthy"', () => {
		// A gateway that predates the families, or one with no profile the
		// manager has instantiated. Neither is a verdict about profile `a`.
		const bare = snapshotOf('loxilb_lb_rules 3', T0);
		expect(jwksHealthFor(['a'], tail([bare]), [bare], GAP).kind).toBe('not-exported');
	});

	it('⭐ reads a never-fetched keyset as a 503 outage', () => {
		const s = snapshotOf(keysetExposition({profile: 'a', usable: 0, keys: 0, refreshFailure: 4}), T0);
		const report = jwksHealthFor(['a'], tail([s]), [s], GAP);
		expect(kindOf(report, 'a')).toBe('never-fetched');
		if (report.kind !== 'ok') throw new Error('expected ok');
		expect(report.byProfile[0].admitting).toBe(false);
		expect(report.byProfile[0].lastSuccess).toEqual({kind: 'never'});
	});

	it('⭐ reads an IdP that answered and then went away as STILL ADMITTING, not as failure', () => {
		// The trap this whole state machine exists for. The gateway keeps
		// serving on the last-known-good keyset; painting it red would tell an
		// operator their inference plane is down while every request succeeds.
		const at = (t: number, failures: number) =>
			snapshotOf(keysetExposition({profile: 'a', usable: 1, keys: 2, lastSuccessSec: SECS(T0) - 900, refreshSuccess: 10, refreshFailure: failures}), t);
		const report = jwksHealthFor(['a'], tail([at(T0, 3), at(T1, 5)]), [at(T0, 3), at(T1, 5)], GAP);
		expect(kindOf(report, 'a')).toBe('last-known-good');
		if (report.kind !== 'ok') throw new Error('expected ok');
		// The load-bearing assertion: admission is unaffected.
		expect(report.byProfile[0].admitting).toBe(true);
		expect(report.byProfile[0].refreshFailure).toEqual({kind: 'ok', perSecond: 0.2, intervalMs: 10_000});
	});

	it('distinguishes a keyset past the cutoff from one never fetched — both 503, different fixes', () => {
		const s = snapshotOf(keysetExposition({profile: 'a', usable: 0, keys: 2, lastSuccessSec: SECS(T0) - 86_400}), T0);
		const report = jwksHealthFor(['a'], tail([s]), [s], GAP);
		expect(kindOf(report, 'a')).toBe('stale-cutoff');
		if (report.kind !== 'ok') throw new Error('expected ok');
		expect(report.byProfile[0].lastSuccess).toEqual({kind: 'ok', ageSec: 86_400});
	});

	it('does not raise the last-known-good warning when refreshes stopped failing', () => {
		// A failure COUNT would keep this amber forever after one bad hour.
		const at = (t: number) =>
			snapshotOf(keysetExposition({profile: 'a', usable: 1, keys: 2, lastSuccessSec: SECS(T0) - 30, refreshSuccess: 10, refreshFailure: 7}), t);
		expect(kindOf(jwksHealthFor(['a'], tail([at(T0), at(T1)]), [at(T0), at(T1)], GAP), 'a')).toBe('healthy');
	});

	it('does not invent the warning from a single observation', () => {
		const s = snapshotOf(keysetExposition({profile: 'a', usable: 1, keys: 2, lastSuccessSec: SECS(T0) - 30, refreshFailure: 9}), T0);
		expect(kindOf(jwksHealthFor(['a'], tail([s]), [s], GAP), 'a')).toBe('healthy');
	});

	it('keeps a configured profile the gateway has not reported on, as not-reported', () => {
		const s = snapshotOf(keysetExposition({profile: 'a', usable: 1, keys: 1, lastSuccessSec: SECS(T0)}), T0);
		const report = jwksHealthFor(['a', 'b'], tail([s]), [s], GAP);
		expect(report.kind === 'ok' && report.byProfile.map(p => p.profile)).toEqual(['a', 'b']);
		expect(kindOf(report, 'b')).toBe('not-reported');
		// Not-reported is not a health claim: it must not read as admitting.
		expect(report.kind === 'ok' && report.byProfile[1].admitting).toBe(false);
	});

	it('joins through the sanitized label so a non-ASCII profile is not mis-read as unreported', () => {
		const s = snapshotOf(keysetExposition({profile: '___', usable: 1, keys: 3, lastSuccessSec: SECS(T0)}), T0);
		const report = jwksHealthFor(['테'], tail([s]), [s], GAP);
		expect(kindOf(report, '테')).toBe('healthy');
		expect(report.kind === 'ok' && report.byProfile[0].keys).toBe(3);
	});

	it('⭐ refuses to attribute one series to two profiles that sanitize alike', () => {
		// The collector drops the duplicate (first wins), so exactly one
		// series exists for the pair. Showing it under both names would put
		// one profile's health on the other's row — on a security page.
		const s = snapshotOf(keysetExposition({profile: 'realm_a', usable: 1, keys: 5, lastSuccessSec: SECS(T0)}), T0);
		const report = jwksHealthFor(['realm a', 'realm+a'], tail([s]), [s], GAP);
		expect(kindOf(report, 'realm a')).toBe('ambiguous-label');
		expect(kindOf(report, 'realm+a')).toBe('ambiguous-label');
		if (report.kind !== 'ok') throw new Error('expected ok');
		expect(report.byProfile.every(p => !p.admitting)).toBe(true);
	});

	it('⭐ reads an absent refresh outcome on a present family as 0/s, not "warming up"', () => {
		// Observed on the live gateway: a probe profile pointing at an
		// unreachable issuer carried `outcome="failure"` and NO success child
		// at all, because a counter child exists only once incremented. Read
		// as insufficient-samples, the Refresh-ok column would say "Warming
		// up…" forever on precisely the profile that is failing.
		const at = (t: number, failures: number) =>
			snapshotOf(keysetExposition({profile: 'a', usable: 0, keys: 0, refreshFailure: failures}), t);
		const report = jwksHealthFor(['a'], tail([at(T0, 3), at(T1, 5)]), [at(T0, 3), at(T1, 5)], GAP);
		if (report.kind !== 'ok') throw new Error('expected ok');
		expect(report.byProfile[0].refreshSuccess).toEqual({kind: 'ok', perSecond: 0, intervalMs: 10_000});
		expect(report.byProfile[0].refreshFailure).toEqual({kind: 'ok', perSecond: 0.2, intervalMs: 10_000});
	});

	it('⭐ ignores refresh counters left behind by profiles that no longer exist', () => {
		// Also observed live: the promauto counter keeps a child per profile
		// for the process lifetime, so a gateway with ZERO profiles configured
		// still exported failure counters for three deleted ones. Rows come
		// from REST configuration, never from whatever labels the counter has
		// accumulated.
		const text = [
			`${JWKS_USABLE}{profile="live"} 1`,
			`${JWKS_LAST_SUCCESS}{profile="live"} ${SECS(T0)}`,
			`${JWKS_REFRESH}{profile="live",outcome="success"} 4`,
			`${JWKS_REFRESH}{profile="deleted-last-week",outcome="failure"} 120`,
		].join('\n');
		const report = jwksHealthFor(['live'], tail([snapshotOf(text, T0)]), [snapshotOf(text, T0)], GAP);
		if (report.kind !== 'ok') throw new Error('expected ok');
		expect(report.byProfile.map(p => p.profile)).toEqual(['live']);
	});

	it('treats a non-finite gauge as not reported rather than as a number', () => {
		const s = snapshotOf(`${JWKS_USABLE}{profile="a"} NaN`, T0);
		expect(kindOf(jwksHealthFor(['a'], tail([s]), [s], GAP), 'a')).toBe('not-reported');
	});
});

describe('bearer reason classification', () => {
	it('separates the gateway\'s own fault from the caller\'s', () => {
		expect(classifyBearerReason('allowed')).toBe('admitted');
		expect(classifyBearerReason('invalid_token')).toBe('credential');
		expect(classifyBearerReason('missing_token')).toBe('credential');
		expect(classifyBearerReason('token_expired')).toBe('credential');
		expect(classifyBearerReason('model_not_allowed')).toBe('authorization');
		// Both of these mean the gateway refused traffic it should have served.
		expect(classifyBearerReason('policy_store_unavailable')).toBe('gateway-fault');
		expect(classifyBearerReason('internal_error')).toBe('gateway-fault');
	});

	it('surfaces an unknown reason as itself instead of guessing a class', () => {
		// Upstream records promoting bad_signature/unknown_kid/oversize onto
		// this label as an OPEN decision, so a value this build has never seen
		// is expected. Folding it into "credential" would attach advice that
		// may be wrong for it.
		expect(classifyBearerReason('bad_signature')).toBe('unclassified');
		expect(classifyBearerReason('')).toBe('unclassified');
	});
});

describe('bearer admission verdicts', () => {
	const validation = (allowed: number, invalid: number, storeDown: number) =>
		[
			`${JWT_VALIDATION}{tenant="-",reason="allowed"} ${allowed}`,
			`${JWT_VALIDATION}{tenant="-",reason="invalid_token"} ${invalid}`,
			`${JWT_VALIDATION}{tenant="-",reason="policy_store_unavailable"} ${storeDown}`,
		].join('\n');

	it('reports the absent family as a precondition, never as zero traffic', () => {
		// Until a rule selects the bearer arm AND a request carries an
		// Authorization header, this family does not exist. Rendering 0/s
		// would assert that bearer auth is working and idle.
		const bare = [snapshotOf('loxilb_lb_rules 3', T0)];
		expect(bearerAdmission(tail(bare), bare, GAP)).toEqual({kind: 'not-exported'});
		expect(bearerAdmission(undefined, [], GAP)).toEqual({kind: 'unavailable'});
	});

	it('⭐ reads the FIRST observation as warming up, never as a failed scrape', () => {
		// Same defect as the keyset half, and the one the live page actually
		// showed: "N/A" in the bearer panel on a gateway that had answered.
		const only = snapshotOf(validation(100, 10, 1), T0);
		const result = bearerAdmission(only, [], GAP);
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') throw new Error('expected ok');
		expect(result.admitted).toEqual({kind: 'insufficient-samples'});
		// The family IS present, and the panel says so by listing its reasons.
		expect(result.byReason.map(r => r.reason).sort()).toEqual(['allowed', 'invalid_token', 'policy_store_unavailable']);
	});

	it('splits admitted from denied and calls out the gateway-caused share', () => {
		const history = [snapshotOf(validation(100, 10, 1), T0), snapshotOf(validation(200, 30, 6), T1)];
		const result = bearerAdmission(tail(history), history, GAP);
		if (result.kind !== 'ok') throw new Error('expected ok');
		expect(result.admitted).toEqual({kind: 'ok', perSecond: 10, intervalMs: 10_000});
		// 20 invalid + 5 store-down over 10 s.
		expect(result.denied).toEqual({kind: 'ok', perSecond: 2.5, intervalMs: 10_000});
		expect(result.gatewayFault).toEqual({kind: 'ok', perSecond: 0.5, intervalMs: 10_000});
	});

	it('⭐ counts a reason this build has never seen as denied', () => {
		// "Denied" is the complement of allowed rather than a list of known
		// codes, so promoting a finer reason upstream cannot silently shrink
		// the denial rate the operator reads.
		const at = (t: number, novel: number) =>
			snapshotOf([`${JWT_VALIDATION}{tenant="-",reason="allowed"} 100`, `${JWT_VALIDATION}{tenant="-",reason="bad_signature"} ${novel}`].join('\n'), t);
		const result = bearerAdmission(tail([at(T0, 0), at(T1, 20)]), [at(T0, 0), at(T1, 20)], GAP);
		if (result.kind !== 'ok') throw new Error('expected ok');
		expect(result.denied).toEqual({kind: 'ok', perSecond: 2, intervalMs: 10_000});
		expect(result.byReason.find(r => r.reason === 'bad_signature')?.reasonClass).toBe('unclassified');
	});

	it('reads an absent refusal child on a present family as a true zero', () => {
		// A counter child exists only once incremented, so a gateway that has
		// never refused a bearer request exports no denial series at all. Read
		// as "warming up", a healthy gateway would never show a denial rate.
		const at = (t: number, allowed: number) => snapshotOf(`${JWT_VALIDATION}{tenant="-",reason="allowed"} ${allowed}`, t);
		const result = bearerAdmission(tail([at(T0, 100), at(T1, 200)]), [at(T0, 100), at(T1, 200)], GAP);
		if (result.kind !== 'ok') throw new Error('expected ok');
		expect(result.denied).toEqual({kind: 'ok', perSecond: 0, intervalMs: 10_000});
		expect(result.gatewayFault).toEqual({kind: 'ok', perSecond: 0, intervalMs: 10_000});
	});

	it('keeps the tenant stand-in visible per reason', () => {
		const text = [
			`${JWT_VALIDATION}{tenant="-",reason="invalid_token"} 5`,
			`${JWT_VALIDATION}{tenant="acme",reason="model_not_allowed"} 3`,
		].join('\n');
		const result = bearerAdmission(tail([snapshotOf(text, T0)]), [snapshotOf(text, T0)], GAP);
		if (result.kind !== 'ok') throw new Error('expected ok');
		// Only the 403 arm has a verified tenant; everything else is denied
		// before a signature is checked and carries the "-" stand-in.
		expect(result.byReason.find(r => r.reason === 'invalid_token')?.tenants).toEqual(['-']);
		expect(result.byReason.find(r => r.reason === 'model_not_allowed')?.tenants).toEqual(['acme']);
	});

	it('leads with what is happening now and keeps ties stable between polls', () => {
		const at = (t: number, invalid: number, expired: number) =>
			[
				`${JWT_VALIDATION}{tenant="-",reason="allowed"} 100`,
				`${JWT_VALIDATION}{tenant="-",reason="invalid_token"} ${invalid}`,
				`${JWT_VALIDATION}{tenant="-",reason="token_expired"} ${expired}`,
			].join('\n');
		const result = bearerAdmission(tail([snapshotOf(at(T0, 0, 0), T0), snapshotOf(at(T1, 50, 10), T1)]), [snapshotOf(at(T0, 0, 0), T0), snapshotOf(at(T1, 50, 10), T1)], GAP);
		if (result.kind !== 'ok') throw new Error('expected ok');
		// invalid_token 5/s, token_expired 1/s, allowed 0/s (flat).
		expect(result.byReason.map(r => r.reason)).toEqual(['invalid_token', 'token_expired', 'allowed']);
	});
});
