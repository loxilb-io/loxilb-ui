//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {InstanceFlavor} from 'api/capabilities';
import {parseExposition} from 'observability/parser';
import {IMetricsSnapshot} from 'types/observability';
import {IInstance} from 'types/oam';
import {GET_INST_TEXT} from '../fetcher/fetcher_inst';
import {fromSimpleResponse} from '../fetcher/opResultAdapter';
import {STATUS_LOCALE_KEYS} from '../fetcher/opResultCodes';

//---------------------------------------------------------
// Raw metrics-snapshot connector (UI-MON-002/004)
//---------------------------------------------------------
// One scrape → one label-preserving snapshot. Shares the exposition endpoint
// and the HTTP→status mapping with the legacy flat read (`metrics.ts`), which
// is now a projection over this snapshot:
// - 503 "Prometheus option is disabled." maps through the standard OpResult
//   table to `unavailable` — a state, not an instance defect;
// - 401 under --userservice maps to `denied` — never rendered as empty data;
// - a parser hard-limit breach is a typed `failed`, never silent truncation.
// Like the legacy read this NEVER throws: it feeds a polled query, and a
// snapshot that tore itself down on one bad scrape would flicker rather than
// inform.

export async function query_get_metrics_snapshot(instance: IInstance, flavor: InstanceFlavor): Promise<IMetricsSnapshot> {
	const resp = await GET_INST_TEXT(instance, `/metrics`);
	const receivedAtMs = Date.now();

	// Any non-200 (503 collection disabled, 401/403, 5xx) is not an exposition.
	const body = resp.code === 200 && typeof resp.data === 'string' ? resp.data : '';
	const outcome = fromSimpleResponse(resp, 'observability.scrape');
	let failure = outcome.status === 'confirmed' ? undefined : outcome;

	const parsed = parseExposition(body);
	if (!failure && parsed.limitError) {
		failure = {
			status: 'failed',
			code: `observability.scrape.limit_${parsed.limitError.kind}`,
			localeKey: STATUS_LOCALE_KEYS.failed,
			retryable: false,
			rawDetail: `${parsed.limitError.kind}: ${parsed.limitError.observed} > ${parsed.limitError.limit}`,
		};
	}

	return {
		instanceId: instance.id,
		flavor,
		receivedAtMs,
		// Content decides availability, exactly like the legacy read: at least
		// one parseable sample. A pre-parity loxilb's 200-with-JSON-string body
		// parses to nothing and reads unavailable without matching its prose.
		available: !parsed.limitError && parsed.diagnostics.totalSamples > 0,
		failure,
		families: parsed.families,
		diagnostics: parsed.diagnostics,
	};
}
