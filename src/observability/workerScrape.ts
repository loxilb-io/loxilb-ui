//---------------------------------------------------------
// Load-aware worker scrape health
//---------------------------------------------------------
// For P/D rules the gateway PULLS each engine's own /metrics and scores
// endpoints on the queue depth and KV-cache use it finds there. This is a
// different path from the worker rows on the Workers page, which workers
// PUSH to the gateway's REST API. `loxilb_ai_worker_scrape_total{result}`
// counts every pull attempt by outcome, and anything but `ok` means the
// scoring for that attempt ran on a stale or substituted value.
//
// ⭐ The result label is a PARTITION of attempts: `RecordWorkerScrape`
// (api/prometheus/ai_metrics.go) increments exactly one child per attempt
// from a closed set, folding anything unrecognised into `unknown`. So the
// children sum to the attempt count, and "not ok" is their complement.
//
// The gateway pre-creates every result child at zero, so all zeros is a
// gateway with no scraper running (no P/D rule), not missing data. A missing
// `ok` child on a present family is NOT zero: the page then withholds the
// verdict rather than calling the scraper broken.
//
// `unparseable` is an HTTP 200 whose body carried none of the series the
// parser recognizes (vllm:num_requests_waiting, vllm:kv_cache_usage_perc,
// vllm:gpu_cache_usage_perc, or the SGLang queue/usage pair).
//
// One verdict line only: the per-result breakdown is not in Grafana either,
// and is a gateway hand-off rather than a UI table.

import {IMetricsSnapshot} from 'types/observability';
import {ratioOf} from './rates';
import {aggregateSum, selectSamples, selectScalar} from './selectors';
import {partitionRate} from './snapshotRates';

export const WORKER_SCRAPE = 'loxilb_ai_worker_scrape_total';

export type WorkerScrapeVerdict =
	// No snapshot, a failed scrape, or a build without the family.
	| {kind: 'unavailable'}
	// No attempt since start: no P/D rule runs the scraper.
	| {kind: 'idle'}
	// ⭐⭐ Attempts, and not one parsed since start. Load-aware selection has
	// never scored an endpoint on a real reading.
	| {kind: 'never-ok'; attempts: number}
	// Some attempts in the window did not parse.
	| {kind: 'failing'; failedShare: number}
	| {kind: 'healthy'}
	// Not decidable yet: one observation, a gap, a reset, or no `ok` child.
	| {kind: 'pending'};

export function workerScrape(snapshot: IMetricsSnapshot | undefined, history: readonly IMetricsSnapshot[], maxGapMs: number): WorkerScrapeVerdict {
	if (!snapshot || snapshot.failure || !snapshot.families.get(WORKER_SCRAPE)) return {kind: 'unavailable'};

	const attempts = aggregateSum(selectSamples(snapshot, WORKER_SCRAPE)).value;
	const okTotal = selectScalar(snapshot, WORKER_SCRAPE, {result: 'ok'});
	if (attempts === undefined || okTotal === undefined) return {kind: 'pending'};
	if (attempts === 0) return {kind: 'idle'};
	// ⭐ Lifetime first: a scraper that has never parsed is the loudest state
	// and needs no window to prove.
	if (okTotal === 0) return {kind: 'never-ok', attempts};

	const all = partitionRate(history, WORKER_SCRAPE, maxGapMs, () => true);
	const failed = partitionRate(history, WORKER_SCRAPE, maxGapMs, labels => labels.result !== 'ok');
	const share = ratioOf(failed, all);
	// No attempts in the window is not a failure: the rules may just be idle.
	if (share.kind === 'no-traffic') return {kind: 'healthy'};
	if (share.kind !== 'ok') return {kind: 'pending'};
	return share.ratio > 0 ? {kind: 'failing', failedShare: share.ratio} : {kind: 'healthy'};
}
