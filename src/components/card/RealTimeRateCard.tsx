//---------------------------------------------------------
// Real-Time Rate Card with Moving Graph
//---------------------------------------------------------
import {Box, Skeleton, Typography} from '@mui/material';
import {formatRate} from 'common';
import AnimatedValue from 'components/element/AnimatedValue';
import RateLineGraph from 'components/element/RateLineGraph';
import RateTooltip from 'components/element/RateTooltip';
import {useLiveMetrics} from 'hooks/query/metricsHook';
import {t} from 'i18next';
import {useEffect, useMemo, useState} from 'react';
import {IInstance} from 'types/oam';
import {ITimeSeriesPoint} from 'types/global';
import {ITypedLiveMetricsResponse} from 'types/metrics';
import CardBase from './CardBase';
import MetricScrapeState from './MetricScrapeState';

//---------------------------------------------------------
// Component Props
//---------------------------------------------------------
// The gateway deleted the pre-computed rps_* rate gauges (they were fabricated
// and already read 0). Rates are now derived client-side as per-second deltas
// of a cumulative counter — the same technique DeltaTrafficCard uses — so this
// card takes a monotonic counter field, not a rate field.
type CounterField = keyof NonNullable<ITypedLiveMetricsResponse['important']>;
interface RealTimeRateCardProps {
	title: string;
	instance: IInstance | null;
	counterField: CounterField;
	unit: 'bps' | 'pps' | 'eps' | 'fps';
	maxPoints?: number;
}

// Lazily evaluated (t() must run at render time, not module load, or the label
// freezes at whatever language was active when the module was first imported).
const RATE_SERIES_LABEL: Record<RealTimeRateCardProps['unit'], () => string> = {
	bps: () => t('Traffic (bps)'),
	pps: () => t('Packets (pps)'),
	eps: () => t('Errors (eps)'),
	fps: () => t('Flows (fps)'),
};

//---------------------------------------------------------
// Warm-up
//---------------------------------------------------------
// ⚠️⚠️ A RATE IS A DELTA, SO THIS CARD CANNOT DRAW ANYTHING UNTIL SAMPLES HAVE
// ACCUMULATED — two samples make one rate point, and this card plots a series,
// so it needs three. That wait is a function of the SHARED SNAPSHOT CADENCE
// and of nothing this card controls.
//
// It used to be an unexplained one. The card asked `useLiveMetrics` for a
// 1000 ms interval, the hook ignored it, and the operator got a bare skeleton
// for two ticks of the real cadence — 20 s at the default, and a full TWO
// MINUTES at the 60 s option, with nothing on screen to distinguish "warming
// up" from "hung". Saying how long, derived from the cadence actually in
// force, is the honest version of what the ignored parameter was reaching for.
export const RATE_SAMPLES_REQUIRED = 3;

/** Seconds still to wait before a rate series can be plotted. */
export function rateWarmUpSeconds(samplesSoFar: number, cadenceMs: number): number {
	const remaining = Math.max(RATE_SAMPLES_REQUIRED - samplesSoFar, 1);
	return Math.ceil((remaining * cadenceMs) / 1000);
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function RealTimeRateCard(props: RealTimeRateCardProps) {
	const {title, instance, counterField, unit, maxPoints = 300} = props;

	// Reads the shared snapshot — one poll for every metrics card on screen.
	// ⭐ `cadenceMs` is the operator's chosen interval, and this card needs it:
	// a rate is a delta, so nothing can be plotted until samples have
	// accumulated, and how long that takes is a function of the cadence alone.
	const {metrics: liveMetrics, failure: scrapeFailure, cadenceMs, refetch: refetchMetrics} = useLiveMetrics(instance);

	// Accumulate raw cumulative-counter samples; the rate is the delta between
	// consecutive samples divided by the elapsed time.
	const [counterHistory, setCounterHistory] = useState<ITimeSeriesPoint<number>[]>([]);

	useEffect(() => {
		if (!liveMetrics?.important) return;
		const counter = liveMetrics.important[counterField];
		if (typeof counter !== 'number' || !Number.isFinite(counter)) return;

		setCounterHistory(prev => {
			const next = [...prev, {timestamp: liveMetrics.timestamp, data: counter}];
			// Keep one extra sample so we always have a previous point to diff against.
			return next.slice(-(maxPoints + 1));
		});
	}, [liveMetrics, counterField, maxPoints]);

	// Derive the per-second rate series from the cumulative counter samples.
	const rateHistory = useMemo<ITimeSeriesPoint<number>[]>(() => {
		return counterHistory.slice(1).map((point, i) => {
			const prev = counterHistory[i]; // i is offset by slice(1)
			const deltaValue = point.data - prev.data;
			const deltaSeconds = (point.timestamp - prev.timestamp) / 1000;
			// Clamp negatives: a counter reset (gateway restart / metrics re-enable)
			// or a sub-tick sample must not render as a huge negative spike.
			const rawRate = deltaSeconds > 0 ? Math.max(deltaValue, 0) / deltaSeconds : 0;
			// Byte counters are reported in bytes; bps panels want bits.
			return {timestamp: point.timestamp, data: unit === 'bps' ? rawRate * 8 : rawRate};
		});
	}, [counterHistory, unit]);

	// Prepare data for the graph component. Every unit gets its own label: the
	// old bps-or-else split labelled the error-rate series "Packets (pps)".
	const graphData = useMemo(() => ({
		label: RATE_SERIES_LABEL[unit](),
		values: rateHistory
	}), [rateHistory, unit]);

	// Get current rate (last point)
	const currentRate = rateHistory[rateHistory.length - 1]?.data ?? 0;

	// A refused or disabled scrape is not this instance declining to publish a
	// counter — say which it was. Checked BEFORE the skeleton below, or a card
	// whose scrape is being refused sits on a loading skeleton forever, since
	// the second sample it is waiting for can never arrive.
	if (scrapeFailure) return <MetricScrapeState title={title} failure={scrapeFailure} onRetry={refetchMetrics} />;

	// Rates are deltas between samples, so until enough polls have landed there
	// is nothing to plot. Show a skeleton — and say what it is waiting for, at
	// the cadence actually in force, rather than leaving a silent placeholder
	// that is indistinguishable from a stuck card.
	if (rateHistory.length < 2) {
		return (
			<CardBase title={title}>
				<Skeleton variant="rounded" width="40%" height={24} sx={{mb: 1}} />
				<Skeleton variant="rounded" width="100%" height={170} />
				<Typography variant="caption" color="textSecondary" sx={{display: 'block', mt: 1}}>
					{t('Collecting counter samples to derive a rate — about {{n}}s at the current refresh interval.', {n: rateWarmUpSeconds(counterHistory.length, cadenceMs)})}
				</Typography>
			</CardBase>
		);
	}

	return (
		<CardBase title={title}>
			<Box display="flex" flexDirection="column" gap={1}>
				{/* Current Rate Display */}
				<Box display="flex" justifyContent="space-between" alignItems="center">
					<Typography variant="caption" color="textSecondary">
						{t('Current Rate')}
					</Typography>
					<RateTooltip rate={currentRate} unit={unit} title={title}>
						<AnimatedValue variant="h6" sx={{cursor: 'help', fontVariantNumeric: 'tabular-nums'}} value={formatRate(currentRate, unit)} />
					</RateTooltip>
				</Box>

				{/* Real-time Moving Graph */}
				<RateLineGraph data={graphData} unit={unit} />

			</Box>
		</CardBase>
	);
}
