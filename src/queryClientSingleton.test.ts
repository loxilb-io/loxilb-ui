//---------------------------------------------------------
// What the localStorage persister is allowed to write
//---------------------------------------------------------
// Found by a full gateway E2E run: `JWTAuthProfilePage` crashed in three
// specs with `snapshot.families.get is not a function`. The persister stores
// the WHOLE query cache as JSON, and `IMetricsSnapshot.families` is a Map —
// which JSON turns into `{}`. Restoring one and reading it takes the page
// down.
//
// These tests pin both halves: that the round-trip really is destructive (so
// nobody "simplifies" the exclusion away believing it is precautionary), and
// that the predicate actually excludes it.
//---------------------------------------------------------
import {describe, expect, it} from 'vitest';
import {Query} from '@tanstack/react-query';
import {PERSIST_BUSTER, shouldPersistQuery} from './queryClientSingleton';
import {parseExposition} from 'observability/parser';
import {jwksHealthFor} from 'observability/jwtAuth';
import {IMetricsSnapshot} from 'types/observability';

/** Minimal stand-in for a cached query: the predicate reads only these. */
function queryOf(queryKey: readonly unknown[], status: 'success' | 'pending' | 'error' = 'success'): Query {
	return {queryKey, state: {status}} as unknown as Query;
}

function snapshotOf(exposition: string): IMetricsSnapshot {
	const parsed = parseExposition(exposition);
	return {
		instanceId: 1,
		flavor: 'inference-gateway',
		receivedAtMs: 1_758_000_000_000,
		available: true,
		families: parsed.families,
		diagnostics: parsed.diagnostics,
	};
}

describe('the persisted-cache round trip', () => {
	it('DESTROYS a metrics snapshot — this is the defect the exclusion exists for', () => {
		const snap = snapshotOf('loxilb_ai_jwks_usable{profile="p"} 1');
		// Before: a real Map.
		expect(typeof snap.families.get).toBe('function');
		expect(snap.families.get('loxilb_ai_jwks_usable')).toBeDefined();

		// Exactly what createSyncStoragePersister does on save + restore.
		const restored = JSON.parse(JSON.stringify(snap)) as IMetricsSnapshot;

		// After: a plain object. The Map's contents are gone, not just its type.
		expect(typeof (restored.families as unknown as {get?: unknown}).get).toBe('undefined');
		expect(Object.keys(restored.families as unknown as object)).toHaveLength(0);

		// And reading it is not a graceful degradation — it throws, which in a
		// component means an unmounted page. This is the browser's exact error.
		expect(() => jwksHealthFor(['p'], restored, [], 30_000)).toThrow(/families\.get is not a function/);
	});

	it('also silently falsifies freshness, independently of the crash', () => {
		// Even if families survived, `receivedAtMs` is the moment of the ORIGINAL
		// scrape. Restored a day later it still claims that instant, and the
		// freshness badge reports stale telemetry as current.
		const snap = snapshotOf('loxilb_lb_rules 3');
		const restored = JSON.parse(JSON.stringify(snap)) as IMetricsSnapshot;
		expect(restored.receivedAtMs).toBe(snap.receivedAtMs);
	});
});

describe('shouldPersistQuery', () => {
	it('refuses the metrics snapshot wherever it appears in the key', () => {
		// The real key shape: ['instance', 'metrics-snapshot', id, flavor, version].
		expect(shouldPersistQuery(queryOf(['instance', 'metrics-snapshot', 1, 'inference-gateway', 3]))).toBe(false);
		// Position must not matter — the marker is what disqualifies it.
		expect(shouldPersistQuery(queryOf(['metrics-snapshot']))).toBe(false);
	});

	it('refuses the sibling live reads too, which lie about freshness rather than crash', () => {
		// These three are JSON-safe, so they never crashed and are easy to
		// overlook. But each stamps its own `receivedAtMs` at fetch time and
		// renders it as a FreshnessBadge (WorkersPage, PersistencePage,
		// GatewaySummaryCards). Restored from storage, the badge reports the
		// ORIGINAL scrape's instant as current — stale telemetry shown as live.
		expect(shouldPersistQuery(queryOf(['instance', 'worker-metrics', 1]))).toBe(false);
		expect(shouldPersistQuery(queryOf(['instance', 'gpu-status', 1]))).toBe(false);
		expect(shouldPersistQuery(queryOf(['instance', 'diagnostics', 1]))).toBe(false);
	});

	it('refuses the capability verdict, because a FAILED read must read as unknown', () => {
		// `useCapabilityVerdict` states: an unread query — including a read that
		// FAILED — yields `unknown`, never `not-ready`, because `not-ready`
		// withdraws controls. React Query keeps the last successful data when a
		// refetch fails, so a persisted verdict made a failed read answer with
		// the PREVIOUS SESSION's verdict. A gateway relaunched without its seed
		// could still report `ready`, and every rule built on that is 412'd.
		expect(shouldPersistQuery(queryOf(['status', 'capabilities', '1', '1']))).toBe(false);
	});

	it('refuses the instance flavor, which persisted would NEVER be re-probed', () => {
		// The one that does not self-correct. `useInstanceFlavorResolution`
		// documents "re-detected on reconnect/refresh" but sets
		// `staleTime: Infinity` / `gcTime: Infinity`. Restored from storage the
		// data is present and never stale, so no refetch is ever issued and an
		// instance redeployed OSS -> inference-gateway keeps the wrong flavor
		// until browser storage is cleared.
		expect(shouldPersistQuery(queryOf(['instance', 'flavor', 1]))).toBe(false);
	});

	it('still persists ordinary configuration reads', () => {
		// The persister earns its keep on these; the fix must not disable it.
		expect(shouldPersistQuery(queryOf(['instance', 'lb', 1]))).toBe(true);
		expect(shouldPersistQuery(queryOf(['ai_model_profiles', 1]))).toBe(true);
		expect(shouldPersistQuery(queryOf(['metadata']))).toBe(true);
	});

	it('keeps the library default: only SUCCEEDED queries are written', () => {
		// Composed with, never replaced. Replacing it would start persisting
		// pending and errored queries — a second bug wearing this one's clothes.
		expect(shouldPersistQuery(queryOf(['instance', 'lb', 1], 'pending'))).toBe(false);
		expect(shouldPersistQuery(queryOf(['instance', 'lb', 1], 'error'))).toBe(false);
	});

	it('is not fooled by a non-string key segment', () => {
		// `queryKey.some(...)` must type-check each segment; an object segment
		// that happens to stringify near the marker is not a match.
		expect(shouldPersistQuery(queryOf(['instance', {q: 'metrics-snapshot'}]))).toBe(true);
	});
});

describe('PERSIST_BUSTER', () => {
	it('is a non-empty constant, which is what discards already-poisoned storage', () => {
		// Anyone running a build between #91 and this fix has a snapshot sitting
		// in localStorage. Excluding future writes does not help them; only a
		// buster mismatch makes the persister throw the stored cache away.
		expect(PERSIST_BUSTER).toBeTruthy();
		expect(PERSIST_BUSTER).not.toBe('');
	});
});
