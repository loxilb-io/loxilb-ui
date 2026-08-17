//---------------------------------------------------------
// Critical Metric Card with Real-time Updates
//---------------------------------------------------------
import {Box, Typography, Chip, Skeleton} from '@mui/material';
import {useLiveMetrics} from 'hooks/query/metricsHook';
import {t} from 'i18next';
import {useEffect, useMemo, useState} from 'react';
import {IInstance} from 'types/oam';
import {ITimeSeriesPoint} from 'types/global';
import {ITypedLiveMetricsResponse} from 'types/metrics';
import AnimatedValue from 'components/element/AnimatedValue';
import RateLineGraph from 'components/element/RateLineGraph';
import CardBase from './CardBase';

//---------------------------------------------------------
// Component Props
//---------------------------------------------------------
interface CriticalMetricCardProps {
	title: string;
	instance: IInstance | null;
	metricField: keyof ITypedLiveMetricsResponse['critical'];
	description?: string;
	warningThreshold?: number;
	criticalThreshold?: number;
	showGraph?: boolean;
	maxPoints?: number;
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function CriticalMetricCard(props: CriticalMetricCardProps) {
	const {
		title, 
		instance, 
		metricField, 
		description, 
		warningThreshold, 
		criticalThreshold,
		showGraph = true,
		maxPoints = 60
	} = props;

	// Get live metrics with polling
	const {metrics: liveMetrics} = useLiveMetrics(instance, {
		keyPrefix: 'critical-metrics-realtime',
		refetchInterval: 10000,
		extraKey: metricField as string,
	});

	// State to accumulate time series data
	const [metricHistory, setMetricHistory] = useState<ITimeSeriesPoint<number>[]>([]);

	// Whether the last poll told us anything about THIS metric. Distinct from
	// "no poll has landed yet", which is the skeleton case below.
	const [polled, setPolled] = useState(false);
	const reported = liveMetrics?.critical?.[metricField] !== undefined;

	// Update metric history when new metrics arrive
	useEffect(() => {
		if (!liveMetrics?.critical) return;
		setPolled(true);

		// An absent metric contributes NO data point. Recording it as 0 would
		// both state a number the instance never gave us and drag the trend line
		// down to a floor that never happened — the graph is the more damaging
		// half, because a fabricated 0 there looks exactly like a real outage.
		const currentValue = liveMetrics.critical[metricField];
		if (currentValue === undefined) return;

		const timestamp = Date.now();

		setMetricHistory(prev => {
			// Add new data point
			const newHistory = [...prev, {
				timestamp,
				data: currentValue
			}];

			// Keep only the last N points for performance
			return newHistory.slice(-maxPoints);
		});
	}, [liveMetrics, metricField, maxPoints]);

	// Get current value and determine status
	const currentValue = metricHistory[metricHistory.length - 1]?.data ?? 0;

	const status = useMemo(() => {
		if (criticalThreshold !== undefined && currentValue >= criticalThreshold) {
			return { level: 'critical', color: 'error', label: 'Critical' };
		}
		if (warningThreshold !== undefined && currentValue >= warningThreshold) {
			return { level: 'warning', color: 'warning', label: 'Warning' };
		}
		return { level: 'normal', color: 'success', label: 'Normal' };
	}, [currentValue, warningThreshold, criticalThreshold]);

	// Prepare data for the graph component
	const graphData = useMemo(() => ({
		label: title,
		values: metricHistory
	}), [metricHistory, title]);

	// First poll still in flight → skeleton, not a blank card.
	if (!polled && metricHistory.length === 0) {
		return (
			<CardBase title={title}>
				<Skeleton variant="rounded" width="60%" height={48} sx={{mb: 1}} />
				<Skeleton variant="rounded" width="100%" height={60} />
			</CardBase>
		);
	}

	// Polled, but this instance does not publish this metric (or collection is
	// off). Say so — the old code left the skeleton up forever, which reads as
	// "still loading" for something that is never going to arrive.
	if (!reported) {
		return (
			<CardBase title={title}>
				<Box display="flex" flexDirection="column" gap={0.5}>
					<Typography variant="h4" fontWeight="bold" color="text.disabled">
						{t('N/A')}
					</Typography>
					<Typography variant="caption" color="textSecondary">
						{t('Not reported by this instance')}
					</Typography>
				</Box>
			</CardBase>
		);
	}

	// The hero number carries the threshold state (normal stays neutral —
	// color is reserved for something being wrong).
	const value_color = status.level === 'critical' ? 'error.main' : status.level === 'warning' ? 'warning.main' : 'text.primary';

	return (
		<CardBase title={title}>
			<Box display="flex" flexDirection="column" gap={1.5}>
				{/* Current Value and Status */}
				<Box display="flex" justifyContent="space-between" alignItems="center">
					<Box>
						<AnimatedValue variant="h4" color={value_color} value={currentValue.toLocaleString()} />
						{description && (
							<Typography variant="caption" color="textSecondary">
								{description}
							</Typography>
						)}
					</Box>
					<Chip
						label={status.label}
						color={status.color as any}
						size="small"
						variant="outlined"
					/>
				</Box>
				
				{/* Optional Mini Graph */}
				{showGraph && metricHistory.length > 1 && (
					<Box height={60}>
						<RateLineGraph data={graphData} unit="count" />
					</Box>
				)}
				
				
			</Box>
		</CardBase>
	);
}