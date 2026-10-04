//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IMetricsSnapshot} from 'types/observability';
import {selectSamples} from './selectors';

//---------------------------------------------------------
// Strict P/D endpoint join (UI-MON-010)
//---------------------------------------------------------
// `ep_idx` is NOT an endpoint address. The only sanctioned way to display an
// endpoint for a P/D series is the info-metric join: `service + ep_idx` must
// match `loxilb_pd_ep_info{service,ep_idx,ep}` UNIQUELY. No match renders an
// unknown-endpoint state; more than one match (a torn scrape or duplicate
// info series) is ambiguous and must not pick a winner.

export type EpJoinResult =
	| {kind: 'ok'; ep: string}
	| {kind: 'unknown'}
	| {kind: 'ambiguous'};

const EP_INFO_FAMILY = 'loxilb_pd_ep_info';

export type EpJoinIndex = ReadonlyMap<string, EpJoinResult>;

// NUL cannot survive into a parsed label value, so the pair key cannot
// collide with crafted label content the way a printable separator could.
const SEP = String.fromCharCode(0);

function keyOf(service: string, epIdx: string): string {
	return service + SEP + epIdx;
}

export function buildEpJoinIndex(snapshot: IMetricsSnapshot): EpJoinIndex {
	const index = new Map<string, EpJoinResult>();
	for (const s of selectSamples(snapshot, EP_INFO_FAMILY)) {
		const {service, ep_idx: epIdx, ep} = s.labels;
		if (service === undefined || epIdx === undefined || ep === undefined) continue;
		const key = keyOf(service, epIdx);
		const existing = index.get(key);
		if (existing === undefined) index.set(key, {kind: 'ok', ep});
		else if (existing.kind === 'ok' && existing.ep !== ep) index.set(key, {kind: 'ambiguous'});
	}
	return index;
}

export function joinEp(index: EpJoinIndex, service: string, epIdx: string): EpJoinResult {
	return index.get(keyOf(service, epIdx)) ?? {kind: 'unknown'};
}
