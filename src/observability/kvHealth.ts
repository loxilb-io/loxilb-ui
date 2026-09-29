//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IMetricsSnapshot} from 'types/observability';
import {selectSamples} from './selectors';

//---------------------------------------------------------
// KV attestation and KV subscriber freshness — one verdict each
//---------------------------------------------------------
// The P/D & KV page reports these as summaries: how many rules are under
// strict attestation and whether any has an enforcement fault; how many KV
// subscribers hold fresh inventory and which do not. The per-rule ladder
// position and the per-endpoint event times are Grafana's ("KV attestation",
// "KV event staleness").
//
// ⚠️ Every family here is conditional-with-proven-writer (vendored manifest):
// a child exists only once its writer ran. So absence is never zero — an
// absent fault family is "not reported", not "no faults", and a subscriber
// with no freshness child is "not reported", not fresh.

export const KV_ATTEST_STATE = 'loxilb_ai_kv_attest_state';
export const KV_ENFORCEMENT_FAULT = 'loxilb_ai_kv_enforcement_fault';
export const KV_ATTEST_PROBE_FAIL = 'loxilb_ai_kv_attest_probe_fail_total';
export const KV_SUBSCRIBER_LAST_EVENT = 'loxilb_kv_subscriber_last_event_timestamp_seconds';
export const KV_INVENTORY_FRESH = 'loxilb_kv_inventory_fresh';

export type KvAttestationReport =
	// No snapshot, or the scrape failed.
	| {kind: 'unavailable'}
	// No rule publishes a ladder position: none is configured for strict
	// KV-exact attestation, or its data-plane contract has not installed yet
	// (the controller starts only after the install ACK). The scrape cannot
	// tell which, so neither is claimed.
	| {kind: 'not-running'}
	| {
			kind: 'ok';
			/** Rules with a live attestation controller — any ladder position, READY or not. */
			rules: number;
			/** Rules whose enforcement-fault gauge is raised; `undefined` when the family is absent. */
			faulted: number | undefined;
			/** Typed probe failures since the gateway started; `undefined` when no reason child exists. */
			probeFailures: number | undefined;
	  };

/**
 * Count rules under strict KV attestation and the ones in enforcement fault.
 *
 * ⚠️ "Rules" are counted from `loxilb_ai_kv_attest_state`, which carries
 * exactly one series per rule set to 1 (the gateway's setter deletes the
 * previous state's series). Counting distinct `rule` labels with a positive
 * value rather than series keeps the count right even if a scrape lands
 * between the delete and the set.
 */
export function kvAttestation(snapshot: IMetricsSnapshot | undefined): KvAttestationReport {
	if (!snapshot || snapshot.failure) return {kind: 'unavailable'};
	if (!snapshot.families.get(KV_ATTEST_STATE)) return {kind: 'not-running'};

	const rules = new Set<string>();
	for (const s of selectSamples(snapshot, KV_ATTEST_STATE)) {
		if (s.value > 0) rules.add(s.labels.rule ?? '');
	}

	// The gauge is 0 while a rule is attested and 1 while its contract word
	// could not be ACKed; absent means no controller runs for that rule. So a
	// family-level absence is "not reported", never a count of zero.
	const faulted = snapshot.families.get(KV_ENFORCEMENT_FAULT)
		? selectSamples(snapshot, KV_ENFORCEMENT_FAULT).filter(s => s.value > 0).length
		: undefined;

	// ⚠️ A lifetime total, not a rate. The family is a lazy CounterVec{reason}:
	// with no failure yet it has no child, and a rate over no series can only
	// say "warming up" — forever, on a healthy gateway. The page shows this
	// line only when failures exist, and "since start" is what it can prove.
	let probeFailures: number | undefined;
	for (const s of selectSamples(snapshot, KV_ATTEST_PROBE_FAIL)) {
		if (!Number.isFinite(s.value)) continue;
		probeFailures = (probeFailures ?? 0) + s.value;
	}

	return {kind: 'ok', rules: rules.size, faulted, probeFailures};
}

export interface IKvSubscriberRow {
	service: string;
	/** ⚠️ Despite the label name, this is the ep_idx — join it through `loxilb_pd_ep_info` to get an address. */
	epIdx: string;
	/** Unix seconds of the last accepted event batch; `undefined` when none was ever accepted. */
	lastEventSec: number | undefined;
	/** `1` fresh, `0` invalidated, `undefined` when the gateway reports no freshness for this endpoint. */
	fresh: number | undefined;
}

export type KvSubscriberReport =
	| {kind: 'unavailable'}
	// Neither family has a child: no KV-exact rule runs a subscriber.
	| {kind: 'none'}
	| {
			kind: 'ok';
			total: number;
			fresh: number;
			/** Every subscriber that is not proven fresh, in service/ep order. */
			notFresh: readonly IKvSubscriberRow[];
	  };

/**
 * How many KV subscribers hold fresh inventory, and which do not.
 *
 * ⭐ The subscriber set is the UNION of both families' (service, ep) pairs.
 * The last-event stamp appears only once a publisher delivers, while the
 * freshness flag appears once the subscriber runs; reading either alone
 * would hide exactly the endpoint that connected but never published.
 *
 * ⚠️ Only `fresh === 1` counts as fresh. A missing flag is not reported,
 * and counting it fresh would put an unproven endpoint in the healthy total.
 */
export function kvSubscribers(snapshot: IMetricsSnapshot | undefined): KvSubscriberReport {
	if (!snapshot || snapshot.failure) return {kind: 'unavailable'};

	const rows = new Map<string, IKvSubscriberRow>();
	const rowFor = (labels: Readonly<Record<string, string>>) => {
		const service = labels.service ?? '';
		const epIdx = labels.ep ?? '';
		const key = JSON.stringify([service, epIdx]);
		let row = rows.get(key);
		if (!row) {
			row = {service, epIdx, lastEventSec: undefined, fresh: undefined};
			rows.set(key, row);
		}
		return row;
	};

	for (const s of selectSamples(snapshot, KV_SUBSCRIBER_LAST_EVENT)) rowFor(s.labels).lastEventSec = s.value;
	for (const s of selectSamples(snapshot, KV_INVENTORY_FRESH)) rowFor(s.labels).fresh = s.value;

	if (rows.size === 0) return {kind: 'none'};

	const all = [...rows.values()].sort((a, b) => a.service.localeCompare(b.service) || a.epIdx.localeCompare(b.epIdx, undefined, {numeric: true}));
	const notFresh = all.filter(r => r.fresh !== 1);
	return {kind: 'ok', total: all.length, fresh: all.length - notFresh.length, notFresh};
}
