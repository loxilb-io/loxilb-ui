//---------------------------------------------------------
// Real-Time Rate Card with Moving Graph
//---------------------------------------------------------
import {Box, Skeleton, Typography} from '@mui/material';
import {formatRate} from 'common';
import AnimatedValue from 'components/element/AnimatedValue';
import RateLineGraph from 'components/element/RateLineGraph';
import RateTooltip from 'components/element/RateTooltip';
import {useQuery} from '@tanstack/react-query';
import {query_get_live_metrics} from 'connector/instance/metrics';
import {t} from 'i18next';
import {useEffect, useMemo, useState} from 'react';
import {IInstance} from 'types/oam';
import {ITimeSeriesPoint} from 'types/global';
import {ITypedLiveMetricsResponse} from 'types/metrics';
import CardBase from './CardBase';

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

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function RealTimeRateCard(props: RealTimeRateCardProps) {
	const {title, instance, counterField, unit, maxPoints = 300} = props;

	// Get live metrics with polling (shared query key → one poll for all rate cards)
	const {data: rawLiveMetrics} = useQuery({
		queryKey: ['live-metrics-realtime', instance?.id],
		queryFn: async () => {
			if (!instance) throw new Error('Instance is not defined');
			return await query_get_live_metrics(instance, 2);
		},
		enabled: !!instance,
		refetchInterval: 1000, // 1-second polling
		refetchIntervalInBackground: false,
		staleTime: 5000,
	});
	const liveMetrics = rawLiveMetrics as ITypedLiveMetricsResponse | undefined;

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

	// Prepare data for the graph component
	const graphData = useMemo(() => ({
		label: unit === 'bps' ? t('Traffic (bps)') : t('Packets (pps)'),
		values: rateHistory
	}), [rateHistory, unit]);

	// Get current rate (last point)
	const currentRate = rateHistory[rateHistory.length - 1]?.data ?? 0;

	// Rates are deltas between samples — until the second poll lands there
	// is nothing to plot, so show a skeleton instead of an empty chart.
	if (rateHistory.length < 2) {
		return (
			<CardBase title={title}>
				<Skeleton variant="rounded" width="40%" height={24} sx={{mb: 1}} />
				<Skeleton variant="rounded" width="100%" height={170} />
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
