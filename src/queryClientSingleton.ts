//---------------------------------------------------------
// The app's single QueryClient and its localStorage persister.
//
// Extracted from App.tsx for: the session teardown has to purge the
// PERSISTED cache, not just the in-memory one, and it cannot import App
// without a cycle. Keeping both here means there is exactly one client and
// exactly one persister in the process, which is also what makes
// `registerSessionPurge` below able to speak for the whole cache.
//---------------------------------------------------------
import {createSyncStoragePersister} from '@tanstack/query-sync-storage-persister';
import {defaultShouldDehydrateQuery, Query, QueryClient} from '@tanstack/react-query';

export const queryClient = new QueryClient();
export const persister = createSyncStoragePersister({storage: window.localStorage});

//---------------------------------------------------------
// What may be written to localStorage — and what must never be
//---------------------------------------------------------
// ⚠️⚠️ THE PERSISTER IS JSON. Anything it stores is `JSON.stringify`d on save
// and `JSON.parse`d on restore, so a value survives only if it round-trips
// through JSON unchanged. A `Map` does NOT: it serializes to `{}` and comes
// back a plain object, so the next `.get(...)` throws
// `families.get is not a function` and takes the whole page down with it.
//
// That is not hypothetical — it crashed `JWTAuthProfilePage` in three E2E
// specs. The metrics snapshot keys its families by name in a Map
// (`IMetricsSnapshot.families`), and every observability reader calls `.get`
// on it, so a restored snapshot is a loaded gun pointed at the AI Traffic,
// Persistence, QoS, Security and JWT pages alike.
//
// The fix is exclusion rather than teaching the persister about Maps, because
// persisting a scrape is wrong on its own terms even when it does not crash:
// a metrics snapshot is a point-in-time observation on a ~10s cadence, and a
// restored one carries a stale `receivedAtMs`, which the freshness badge would
// then report as current. Telemetry is re-read, never remembered.

// The crash is only `metrics-snapshot`'s, but the freshness lie is not: every
// read below stamps its own client-side `receivedAtMs` (`ITimedRead`, and the
// snapshot's own field) and feeds it straight to a `FreshnessBadge` —
// `WorkersPage` for gpu-status and worker-metrics, `PersistencePage` for
// diagnostics, the observability pages for the snapshot. A restored cache
// replays the timestamp of the ORIGINAL scrape, so the badge reports
// yesterday's telemetry as current. Persisting them buys nothing either: each
// has a 2–5s `staleTime` and a refetch interval, so it is re-fetched on mount
// regardless. Telemetry is re-read, never remembered.
/** Query-key segments that mark a live-telemetry read. Never persisted. */
const LIVE_TELEMETRY_KEYS: readonly string[] = ['metrics-snapshot', 'worker-metrics', 'gpu-status', 'diagnostics'];

//---------------------------------------------------------
// Deployment state — a second reason, not a second instance of the first
//---------------------------------------------------------
// These do not describe numbers that go stale; they describe WHAT THE REMOTE
// GATEWAY IS. Each gates whether a control or a whole field set is offered, so
// remembering one across sessions does not merely show an old value — it makes
// the UI act on a deployment that may no longer exist. Both entries below were
// persisted, and in both cases persistence broke an invariant the consuming
// code states in its own comments.
//
// `capabilities` — `useCapabilityVerdict` documents: "an UNREAD query (no
// instance yet, still loading, or A READ THAT FAILED) yields `unknown`, never
// `not-ready`", because `not-ready` withdraws controls. React Query keeps the
// last successful data when a refetch fails, so a restored verdict meant a
// FAILED read answered with the previous session's verdict instead of
// `unknown`. A gateway relaunched without its seed could still read `ready`,
// and every rule built on that answer is refused with 412.
//
// `flavor` — the worse of the two, because it does not self-correct.
// `useInstanceFlavorResolution` documents "a session sees one probe per
// instance, re-detected on reconnect/refresh", and sets `staleTime: Infinity`
// with `gcTime: Infinity`. Restored from storage the data is already present
// and never stale, so NO refetch is ever issued: the documented re-detection
// simply does not happen. An instance redeployed from loxilb OSS to
// inference-gateway keeps the old flavor until someone clears browser storage
// — which is how AI-gateway fields would appear on an OSS form, the one thing
// `AIGatewaySettingsForm` says must never happen.
const DEPLOYMENT_STATE_KEYS: readonly string[] = ['capabilities', 'flavor'];

/**
 * Persist predicate. Composes with the library default rather than replacing
 * it — dropping `defaultShouldDehydrateQuery` would start persisting pending
 * and errored queries, which is a second bug wearing this one's clothes.
 */
export function shouldPersistQuery(query: Query): boolean {
	if (!defaultShouldDehydrateQuery(query)) return false;
	return !query.queryKey.some(
		segment => typeof segment === 'string' && (LIVE_TELEMETRY_KEYS.includes(segment) || DEPLOYMENT_STATE_KEYS.includes(segment)),
	);
}

/**
 * Bumped when the persisted shape stops being safe to read back. A mismatch
 * makes the persister DISCARD the stored cache instead of hydrating it, which
 * is the only way to disarm the snapshots already sitting in the localStorage
 * of everyone who ran a build between #91 and this fix. Change it only to
 * invalidate deliberately.
 */
export const PERSIST_BUSTER = 'v2-live-telemetry-excluded';
