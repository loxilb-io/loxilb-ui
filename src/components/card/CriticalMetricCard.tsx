//---------------------------------------------------------
// Critical Metric Card with Real-time Updates
//---------------------------------------------------------
import {Box, Typography, Chip, Skeleton} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {query_get_live_metrics} from 'connector/instance/metrics';
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
	const {data: rawLiveMetrics} = useQuery({
		queryKey: ['critical-metrics-realtime', instance?.id, metricField],
		queryFn: async () => {
			if (!instance) throw new Error('Instance is not defined');
			return await query_get_live_metrics(instance, 2);
		},
		enabled: !!instance,
		refetchInterval: 10000, // 10-second polling
		refetchIntervalInBackground: false,
		staleTime: 5000,
	});
	const liveMetrics = rawLiveMetrics as ITypedLiveMetricsResponse | undefined;
	
	// State to accumulate time series data
	const [metricHistory, setMetricHistory] = useState<ITimeSeriesPoint<number>[]>([]);

	// Update metric history when new metrics arrive
	useEffect(() => {
		if (!liveMetrics?.critical) return;
		
		const currentValue = liveMetrics.critical[metricField] || 0;
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
	if (metricHistory.length === 0) {
		return (
			<CardBase title={title}>
				<Skeleton variant="rounded" width="60%" height={48} sx={{mb: 1}} />
				<Skeleton variant="rounded" width="100%" height={60} />
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