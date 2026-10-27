//---------------------------------------------------------
// Three gateway signals for the QoS page (gateway 9f5017e2)
//---------------------------------------------------------
//   loxilb_ai_fc_band_total{service,band,outcome}  admission by priority band
//   loxilb_log_lines_dropped_total{level}           operational log loss
//   loxilb_proxy_pools_live / _freed_total          rule pools held and freed
//
// Rules this module keeps:
//   - Rates are over the measured interval between the last two snapshots,
//     never "last hour": the history is a few observations and is dropped on
//     unmount. A reset, a gap or a single observation is said as such.
//   - An absent family is never zero. Its reading (conditional, missing, …)
//     comes from the manifest contract.
//   - `queued` counts parks, once per park. It overlaps the four terminal
//     outcomes and is never presented as a share of requests.
//   - Pool growth alone is an observation, not a leak diagnosis.
//---------------------------------------------------------
import {IMetricsSnapshot} from 'types/observability';
import {AbsenceReading, familyAbsence} from './familyActivation';
import {RateResult} from './rates';
import {aggregateSum, selectSamples} from './selectors';
import {groupRates, RATE_MAX_GAP_MS} from './snapshotRates';

export const BAND_OUTCOME_FAMILY = 'loxilb_ai_fc_band_total';
export const LOG_DROPPED_FAMILY = 'loxilb_log_lines_dropped_total';
export const POOLS_LIVE_FAMILY = 'loxilb_proxy_pools_live';
export const POOLS_FREED_FAMILY = 'loxilb_proxy_pools_freed_total';

export const BAND_ORDER = ['critical', 'standard', 'sheddable'] as const;
/** The four terminal outcomes, one per request. */
export const BAND_TERMINAL_OUTCOMES = ['admitted', 'shed', 'expired', 'cancelled'] as const;
/** Not an outcome: counts parks, once per park. */
export const BAND_PARK_OUTCOME = 'queued';
export const LOG_LEVELS = ['error', 'warn', 'notice', 'info', 'debug', 'trace'] as const;

export type SignalReport<T> =
	| {kind: 'no-data'} // no snapshot yet, or the scrape failed
	| {kind: 'absent'; reading: AbsenceReading}
	| ({kind: 'ok'} & T);

/** The interval the rates below were measured over, when any was. */
function measuredIntervalMs(rates: readonly RateResult[]): number | undefined {
	for (const rate of rates) if (rate.kind === 'ok') return rate.intervalMs;
	return undefined;
}

function readable(snapshot: IMetricsSnapshot | undefined): snapshot is IMetricsSnapshot {
	return !!snapshot && snapshot.available && !snapshot.failure;
}

//---------------------------------------------------------
// Admission by priority band
//---------------------------------------------------------
export interface IBandRow {
	band: string;
	outcomes: Record<string, RateResult>;
	parks: RateResult;
}

export interface IBandService {
	service: string;
	bands: IBandRow[];
}

export function bandOutcomes(history: readonly IMetricsSnapshot[], maxGapMs: number = RATE_MAX_GAP_MS): SignalReport<{services: IBandService[]; intervalMs?: number}> {
	const current = history[history.length - 1];
	if (!readable(current)) return {kind: 'no-data'};
	const reading = familyAbsence(current, BAND_OUTCOME_FAMILY);
	if (reading) return {kind: 'absent', reading};

	const rates = groupRates(history, BAND_OUTCOME_FAMILY, ['service', 'band', 'outcome'], maxGapMs);
	const byService = new Map<string, Map<string, Map<string, RateResult>>>();
	for (const row of rates) {
		const service = row.labels.service ?? '';
		const band = row.labels.band ?? '';
		const outcome = row.labels.outcome ?? '';
		if (!byService.has(service)) byService.set(service, new Map());
		const bands = byService.get(service)!;
		if (!bands.has(band)) bands.set(band, new Map());
		bands.get(band)!.set(outcome, row.rate);
	}

	const missing: RateResult = {kind: 'insufficient-samples'};
	const bandRank = (band: string) => {
		const index = (BAND_ORDER as readonly string[]).indexOf(band);
		return index === -1 ? BAND_ORDER.length : index;
	};
	const services: IBandService[] = [...byService.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([service, bands]) => ({
			service,
			bands: [...bands.entries()]
				.sort(([a], [b]) => bandRank(a) - bandRank(b) || a.localeCompare(b))
				.map(([band, outcomes]) => ({
					band,
					outcomes: Object.fromEntries(BAND_TERMINAL_OUTCOMES.map(outcome => [outcome, outcomes.get(outcome) ?? missing])),
					parks: outcomes.get(BAND_PARK_OUTCOME) ?? missing,
				})),
		}));
	return {kind: 'ok', services, intervalMs: measuredIntervalMs(rates.map(r => r.rate))};
}

//---------------------------------------------------------
// Operational log loss
//---------------------------------------------------------
export interface ILogLossLevel {
	level: string;
	total: number | undefined;
	rate: RateResult;
}

export function logLoss(history: readonly IMetricsSnapshot[], maxGapMs: number = RATE_MAX_GAP_MS): SignalReport<{levels: ILogLossLevel[]; dropping: boolean; everDropped: boolean; intervalMs?: number}> {
	const current = history[history.length - 1];
	if (!readable(current)) return {kind: 'no-data'};
	const reading = familyAbsence(current, LOG_DROPPED_FAMILY);
	if (reading) return {kind: 'absent', reading};

	const rates = groupRates(history, LOG_DROPPED_FAMILY, ['level'], maxGapMs);
	const byLevel = new Map(rates.map(row => [row.labels.level ?? '', row]));
	const known = LOG_LEVELS.filter(level => byLevel.has(level));
	const extra = [...byLevel.keys()].filter(level => !(LOG_LEVELS as readonly string[]).includes(level)).sort();
	const levels = [...known, ...extra].map(level => {
		const row = byLevel.get(level)!;
		return {level, total: row.current, rate: row.rate};
	});
	return {
		kind: 'ok',
		levels,
		dropping: levels.some(level => level.rate.kind === 'ok' && level.rate.perSecond > 0),
		everDropped: levels.some(level => (level.total ?? 0) > 0),
		intervalMs: measuredIntervalMs(levels.map(level => level.rate)),
	};
}

//---------------------------------------------------------
// Rule pools held and freed
//---------------------------------------------------------
export function proxyPools(history: readonly IMetricsSnapshot[], maxGapMs: number = RATE_MAX_GAP_MS): SignalReport<{live: number | undefined; livePrevious: number | undefined; freedTotal: number | undefined; freedRate: RateResult; freedAbsent?: AbsenceReading}> {
	const current = history[history.length - 1];
	if (!readable(current)) return {kind: 'no-data'};
	const liveReading = familyAbsence(current, POOLS_LIVE_FAMILY);
	if (liveReading) return {kind: 'absent', reading: liveReading};

	const previous = history.length >= 2 ? history[history.length - 2] : undefined;
	const live = aggregateSum(selectSamples(current, POOLS_LIVE_FAMILY)).value;
	const livePrevious = readable(previous) && previous.families.has(POOLS_LIVE_FAMILY) ? aggregateSum(selectSamples(previous, POOLS_LIVE_FAMILY)).value : undefined;
	const freedAbsent = familyAbsence(current, POOLS_FREED_FAMILY);
	const freed = freedAbsent ? undefined : groupRates(history, POOLS_FREED_FAMILY, [], maxGapMs)[0];
	return {
		kind: 'ok',
		live,
		livePrevious,
		freedTotal: freed?.current,
		freedRate: freedAbsent ? {kind: 'absent', reading: freedAbsent} : freed?.rate ?? {kind: 'insufficient-samples'},
		...(freedAbsent ? {freedAbsent} : {}),
	};
}
