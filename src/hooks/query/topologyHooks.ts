//---------------------------------------------------------
// Network Topology Data Hooks for LoxiLB
//---------------------------------------------------------
import {useQuery} from '@tanstack/react-query';
import {IInstance} from 'types/oam';
import {GET_INST} from 'connector/fetcher/fetcher_inst';

// Aggregation strategies for different metric types
type AggregationStrategy = 'latest' | 'average' | 'max' | 'sum' | 'rate' | 'delta_to_bps';

interface MetricConfig {
	strategy: AggregationStrategy;
	description: string;
}

// Metric-specific aggregation configurations
const METRIC_AGGREGATION_CONFIG: Record<string, MetricConfig> = {
	'service_traffic_bytes': { 
		strategy: 'delta_to_bps', 
		description: 'Convert delta bytes/10s to BPS' 
	},
	'endpoint_traffic_bytes': { 
		strategy: 'delta_to_bps', 
		description: 'Convert delta bytes/10s to BPS' 
	},
	'endpoint_load_dists_per_service': { 
		strategy: 'latest', 
		description: 'Use latest distribution ratio' 
	},
	'endpoint_health': { 
		strategy: 'average', 
		description: 'Average health over time period' 
	},
	'lb_rule_interaction_bytes': { 
		strategy: 'rate', 
		description: 'Calculate interaction rate' 
	},
	'total_load_dists_per_service': { 
		strategy: 'rate', 
		description: 'Calculate rate from cumulative' 
	}
};

// Aggregation functions
function aggregateTimeSeries(data: any[], strategy: AggregationStrategy): any[] {
	if (!data || data.length === 0) return [];

	// Group by labels to handle multiple series
	const groupedData = new Map();
	
	data.forEach(point => {
		const labelKey = JSON.stringify(point.labels || {});
		if (!groupedData.has(labelKey)) {
			groupedData.set(labelKey, {
				metric_name: point.metric_name,
				labels: point.labels,
				service_name: point.service_name,
				values: []
			});
		}
		groupedData.get(labelKey).values.push({
			timestamp: point.timestamp,
			value: point.value
		});
	});

	// Apply aggregation strategy to each series
	const aggregatedData: any[] = [];
	
	groupedData.forEach((series, labelKey) => {
		const sortedValues = series.values.sort((a: any, b: any) => a.timestamp - b.timestamp);
		let aggregatedValue: number;

		switch (strategy) {
			case 'latest':
				// Use the most recent value
				aggregatedValue = sortedValues[sortedValues.length - 1]?.value || 0;
				break;

			case 'average':
				// Calculate average over time period
				aggregatedValue = sortedValues.reduce((sum: number, point: any) => sum + point.value, 0) / sortedValues.length;
				break;

			case 'max':
				// Use maximum value in time period
				aggregatedValue = Math.max(...sortedValues.map((point: any) => point.value));
				break;

			case 'sum':
				// Sum all values (useful for counting metrics)
				aggregatedValue = sortedValues.reduce((sum: number, point: any) => sum + point.value, 0);
				break;

			case 'rate':
				// Calculate rate from cumulative data (bytes -> bytes/sec)
				if (sortedValues.length < 2) {
					aggregatedValue = 0;
				} else {
					// Use a more robust rate calculation over multiple points
					let totalDelta = 0;
					let totalTime = 0;
					let validDeltas = 0;
					
					for (let i = 1; i < sortedValues.length; i++) {
						const current = sortedValues[i];
						const previous = sortedValues[i - 1];
						const deltaValue = current.value - previous.value;
						const deltaTime = (current.timestamp - previous.timestamp) / 1000;
						
						// Only include positive deltas (ignore counter resets)
						if (deltaValue >= 0 && deltaTime > 0) {
							totalDelta += deltaValue;
							totalTime += deltaTime;
							validDeltas++;
						}
					}
					
					// Calculate average rate if we have valid data points
					aggregatedValue = validDeltas > 0 && totalTime > 0 ? totalDelta / totalTime : 0;
				}
				break;

			case 'delta_to_bps':
				// API provides delta bytes per 10 seconds, convert to BPS (bits per second)
				// Formula: deltaBytes * 8 / 10 = BPS
				aggregatedValue = (sortedValues[sortedValues.length - 1]?.value || 0) * 8 / 10;
				break;

			default:
				aggregatedValue = sortedValues[sortedValues.length - 1]?.value || 0;
		}

		aggregatedData.push({
			metric_name: series.metric_name,
			labels: series.labels,
			service_name: series.service_name,
			value: aggregatedValue,
			timestamp: sortedValues[sortedValues.length - 1]?.timestamp || Date.now(),
			aggregation_strategy: strategy,
			data_points: sortedValues.length
		});
	});

	return aggregatedData;
}

// Base metrics query function with aggregation
async function fetchMetricData(instance: IInstance | null, metricName: string, timeRange: string) {
	if (!instance) return null;

	const endTime = Date.now();
	
	// Use broader time windows to capture historical data, similar to our successful manual tests
	const startTimes = {
		'1m': 1, // Use very broad window like our manual tests
		'5m': 1, // Use very broad window like our manual tests  
		'15m': 1, // Use very broad window like our manual tests
		'1h': 1  // Use very broad window like our manual tests
	};

	const startTime = startTimes[timeRange as keyof typeof startTimes] || 1;

	// Use GET_INST to route through OAM proxy (same pattern as LBRulePage and nTopHooks)
	const params = {
		time_start: startTime.toString(),
		time_end: endTime.toString(),
		metrics: metricName,
		order: 'desc',
		limit: '2'
	};

	const response = await GET_INST(instance, '/api/v1/metrics/db/query', params);

	if (response.code !== 200 && response.code !== 204) {
		throw new Error(`Failed to fetch ${metricName}: ${response.message || 'Unknown error'}`);
	}

	const result = response.data;
	
	// Apply aggregation strategy
	const config = METRIC_AGGREGATION_CONFIG[metricName] || { strategy: 'latest', description: 'Default to latest value' };
	const aggregatedData = aggregateTimeSeries(result.data, config.strategy);

	return {
		...result,
		data: aggregatedData,
		aggregation_info: {
			strategy: config.strategy,
			description: config.description,
			time_range: timeRange,
			original_points: result.data?.length || 0,
			aggregated_points: aggregatedData.length
		}
	};
}

// Individual metric hooks
export function useServiceTraffic(instance: IInstance | null, timeRange: string = '5m') {
	return useQuery({
		queryKey: ['topology', 'service_traffic', instance?.name, timeRange],
		queryFn: () => fetchMetricData(instance, 'service_traffic_bytes', timeRange),
		enabled: !!instance,
		refetchInterval: 5000, // Refresh every 5 seconds
		staleTime: 4000
	});
}

export function useEndpointTraffic(instance: IInstance | null, timeRange: string = '5m') {
	return useQuery({
		queryKey: ['topology', 'endpoint_traffic', instance?.name, timeRange],
		queryFn: () => fetchMetricData(instance, 'endpoint_traffic_bytes', timeRange),
		enabled: !!instance,
		refetchInterval: 5000,
		staleTime: 4000
	});
}

export function useDistributionRatios(instance: IInstance | null, timeRange: string = '5m') {
	return useQuery({
		queryKey: ['topology', 'distribution_ratios', instance?.name, timeRange],
		queryFn: () => fetchMetricData(instance, 'endpoint_load_dists_per_service', timeRange),
		enabled: !!instance,
		refetchInterval: 5000,
		staleTime: 4000
	});
}

export function useEndpointHealth(instance: IInstance | null, timeRange: string = '5m') {
	return useQuery({
		queryKey: ['topology', 'endpoint_health', instance?.name, timeRange],
		queryFn: () => fetchMetricData(instance, 'endpoint_health', timeRange),
		enabled: !!instance,
		refetchInterval: 10000, // Health data can be refreshed less frequently
		staleTime: 8000
	});
}

export function useLBInteractions(instance: IInstance | null, timeRange: string = '5m') {
	return useQuery({
		queryKey: ['topology', 'lb_interactions', instance?.name, timeRange],
		queryFn: () => fetchMetricData(instance, 'lb_rule_interaction_bytes', timeRange),
		enabled: !!instance,
		refetchInterval: 5000,
		staleTime: 4000
	});
}

export function useTotalLoadDists(instance: IInstance | null, timeRange: string = '5m') {
	return useQuery({
		queryKey: ['topology', 'total_load_dists', instance?.name, timeRange],
		queryFn: () => fetchMetricData(instance, 'total_load_dists_per_service', timeRange),
		enabled: !!instance,
		refetchInterval: 5000,
		staleTime: 4000
	});
}

// Combined topology data hook
export function useTopologyMetrics(instance: IInstance | null, timeRange: string = '5m') {
	const serviceTraffic = useServiceTraffic(instance, timeRange);
	const endpointTraffic = useEndpointTraffic(instance, timeRange);
	const distributionRatios = useDistributionRatios(instance, timeRange);
	const endpointHealth = useEndpointHealth(instance, timeRange);
	const lbInteractions = useLBInteractions(instance, timeRange);
	const totalLoadDists = useTotalLoadDists(instance, timeRange);

	return {
		serviceTraffic: serviceTraffic.data?.data || [],
		endpointTraffic: endpointTraffic.data?.data || [],
		distributionRatios: distributionRatios.data?.data || [],
		endpointHealth: endpointHealth.data?.data || [],
		lbInteractions: lbInteractions.data?.data || [],
		totalLoadDists: totalLoadDists.data?.data || [],
		isLoading: serviceTraffic.isLoading || endpointTraffic.isLoading || distributionRatios.isLoading,
		error: serviceTraffic.error || endpointTraffic.error || distributionRatios.error,
		aggregationInfo: {
			serviceTraffic: serviceTraffic.data?.aggregation_info,
			endpointTraffic: endpointTraffic.data?.aggregation_info,
			distributionRatios: distributionRatios.data?.aggregation_info,
			endpointHealth: endpointHealth.data?.aggregation_info,
			lbInteractions: lbInteractions.data?.aggregation_info,
			totalLoadDists: totalLoadDists.data?.aggregation_info
		},
		refetch: () => {
			serviceTraffic.refetch();
			endpointTraffic.refetch();
			distributionRatios.refetch();
			endpointHealth.refetch();
			lbInteractions.refetch();
			totalLoadDists.refetch();
		}
	};
}