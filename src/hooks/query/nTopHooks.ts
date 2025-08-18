//---------------------------------------------------------
// nTop Hooks - Rate-based Network Traffic Analysis
//---------------------------------------------------------
import {useQuery} from '@tanstack/react-query';
import {IInstance} from 'types/oam';

// Rate-based metrics for live network analysis
const RATE_METRICS = {
	// Primary rate metrics (real-time rates)
	BYTES_PER_SECOND: 'rps_bps',
	PACKETS_PER_SECOND: 'rps_pps', 
	REQUESTS_PER_SECOND: 'rps_requests',
	ERRORS_PER_SECOND: 'rps_eps',
	
	// Protocol-specific rates
	TCP_BYTES_PER_SECOND: 'rps_tcp_bps',
	UDP_BYTES_PER_SECOND: 'rps_udp_bps',
	SCTP_BYTES_PER_SECOND: 'rps_sctp_bps',
	TCP_PACKETS_PER_SECOND: 'rps_tcp_pps',
	UDP_PACKETS_PER_SECOND: 'rps_udp_pps',
	SCTP_PACKETS_PER_SECOND: 'rps_sctp_pps',
	
	// LB-specific rates
	LB_INTERACTION_BYTES_PER_SECOND: 'rps_lb_interaction_bps',
	LB_INTERACTION_PACKETS_PER_SECOND: 'rps_lb_interaction_pps',
} as const;

// Time window configurations for analysis
export const NTOP_TIME_WINDOWS = {
	'1m': { label: '1 Minute', duration: 60, description: 'Real-time analysis' },
	'5m': { label: '5 Minutes', duration: 300, description: 'Short-term trends' },
	'15m': { label: '15 Minutes', duration: 900, description: 'Medium-term analysis' },
	'1h': { label: '1 Hour', duration: 3600, description: 'Long-term patterns' },
	'4h': { label: '4 Hours', duration: 14400, description: 'Extended analysis' },
	'12h': { label: '12 Hours', duration: 43200, description: 'Daily patterns' },
	'24h': { label: '24 Hours', duration: 86400, description: 'Daily overview' },
	'7d': { label: '7 Days', duration: 604800, description: 'Weekly patterns' }
} as const;

export type NTopTimeWindow = keyof typeof NTOP_TIME_WINDOWS;

// Analysis contexts for different administrator use cases
export const ANALYSIS_CONTEXTS = {
	REALTIME: {
		title: 'Real-time Monitoring',
		description: 'Live traffic analysis for immediate issues',
		recommended_windows: ['1m', '5m'],
		refresh_interval: 2000 // 2 seconds
	},
	TROUBLESHOOTING: {
		title: 'Troubleshooting',
		description: 'Identify performance bottlenecks and issues',
		recommended_windows: ['5m', '15m', '1h'],
		refresh_interval: 5000 // 5 seconds
	},
	CAPACITY_PLANNING: {
		title: 'Capacity Planning',
		description: 'Long-term trend analysis for resource planning',
		recommended_windows: ['4h', '12h', '24h', '7d'],
		refresh_interval: 30000 // 30 seconds
	},
	PERFORMANCE_ANALYSIS: {
		title: 'Performance Analysis',
		description: 'Deep dive into traffic patterns and optimization',
		recommended_windows: ['15m', '1h', '4h'],
		refresh_interval: 10000 // 10 seconds
	}
} as const;

export type AnalysisContext = keyof typeof ANALYSIS_CONTEXTS;

// nTop categories with rate-based metrics
export const NTOP_CATEGORIES = {
	SERVICES: {
		title: 'Top Services',
		description: 'Services ranked by traffic rate',
		metrics: ['service_traffic_bytes'], // Will be converted to rates
		icon: 'service',
		primary_metric: 'service_traffic_bytes'
	},
	ENDPOINTS: {
		title: 'Top Endpoints',
		description: 'Endpoints ranked by traffic rate', 
		metrics: ['endpoint_traffic_bytes'], // Will be converted to rates
		icon: 'endpoint',
		primary_metric: 'endpoint_traffic_bytes'
	},
	CLIENTS: {
		title: 'Top Clients',
		description: 'Clients ranked by packet rate',
		metrics: ['client_traffic_packets'], // Will be converted to PPS
		icon: 'client',
		primary_metric: 'client_traffic_packets'
	}
} as const;

export type NTopCategory = keyof typeof NTOP_CATEGORIES;

// nTop item interface
export interface NTopItem {
	id: string;
	label: string;
	value: number; // Current rate value
	percentage: number; // Percentage of total
	trend: 'up' | 'down' | 'stable';
	change: number; // Rate of change
	rank: number;
	metadata: {
		protocol?: string;
		service?: string;
		endpoint?: string;
		client?: string;
		unit: 'bps' | 'pps' | 'eps' | 'fps'; // Valid formatRate units
	};
}

// Convert delta bytes per 10 seconds to BPS (bits per second)
function convertDeltaToBps(data: any[]): any[] {
	if (!data || data.length === 0) return [];
	
	return data.map(point => ({
		...point,
		value: (point.value || 0) * 8 / 10, // deltaBytes * 8 / 10 = BPS
		original_value: point.value
	}));
}

// Fetch metric data and convert to rates with configurable time windows
async function fetchRateMetricData(
	instance: IInstance | null, 
	metricName: string, 
	timeWindow: NTopTimeWindow,
	analysisContext?: AnalysisContext
) {
	if (!instance) return null;

	const endTime = Date.now();
	const windowConfig = NTOP_TIME_WINDOWS[timeWindow];
	
	// Calculate start time based on selected window duration
	const startTime = endTime - (windowConfig.duration * 1000); // Convert seconds to milliseconds
	
	console.log(`nTop: Fetching ${metricName} for ${windowConfig.label} (${windowConfig.description})`, {
		timeWindow,
		duration: windowConfig.duration,
		startTime: new Date(startTime).toISOString(),
		endTime: new Date(endTime).toISOString(),
		url: `${instance.api_endpoint}/api/v1/metrics/db/query?time_start=${startTime}&time_end=${endTime}&metrics=${metricName}&limit=100`
	});
	
	const response = await fetch(
		`${instance.api_endpoint}/api/v1/metrics/db/query?time_start=${startTime}&time_end=${endTime}&metrics=${metricName}&order=desc&limit=1`
	);

	if (!response.ok) {
		throw new Error(`Failed to fetch ${metricName}: ${response.statusText}`);
	}

	const result = await response.json();
	
	console.log(`nTop: API Response for ${metricName}:`, {
		status: response.status,
		dataLength: result.data?.length || 0,
		hasData: !!result.data,
		firstDataPoint: result.data?.[0],
		result: result
	});
	
	// For delta bytes metrics, convert to BPS
	if (metricName.includes('bytes') && !metricName.includes('rps_')) {
		const bpsData = convertDeltaToBps(result.data || []);
		console.log(`nTop: BPS conversion for ${metricName}:`, {
			originalLength: result.data?.length || 0,
			bpsLength: bpsData.length,
			firstBps: bpsData[0]
		});
		return {
			...result,
			data: bpsData,
			is_rate: true
		};
	}
	
	// For delta packets metrics, convert to PPS (packets per second)
	if (metricName.includes('packets')) {
		const ppsData = (result.data || []).map((point: any) => ({
			...point,
			value: (point.value || 0) / 10, // deltaPackets / 10 = PPS
			original_value: point.value
		}));
		console.log(`nTop: PPS conversion for ${metricName}:`, {
			originalLength: result.data?.length || 0,
			ppsLength: ppsData.length,
			firstPps: ppsData[0]
		});
		return {
			...result,
			data: ppsData,
			is_rate: true
		};
	}
	
	// For rps_ metrics (bytes per second), convert to bits per second
	if (metricName.includes('rps_')) {
		const bpsData = (result.data || []).map((point: any) => ({
			...point,
			value: (point.value || 0) * 8, // bytes/sec * 8 = bits/sec
			original_value: point.value
		}));
		console.log(`nTop: Bytes to Bits conversion for ${metricName}:`, {
			originalLength: result.data?.length || 0,
			bpsLength: bpsData.length,
			firstBps: bpsData[0]
		});
		return {
			...result,
			data: bpsData,
			is_rate: true
		};
	}
	
	// For other already rate-based metrics, use directly
	return {
		...result,
		data: result.data || [],
		is_rate: true
	};
}

// Helper function to get appropriate unit for category
function getUnitForCategory(category: NTopCategory): 'bps' | 'pps' | 'eps' | 'fps' {
	switch (category) {
		case 'SERVICES':
		case 'ENDPOINTS':
		case 'CLIENTS':
			return 'pps'; // Packets per second for client metrics
		default:
			return 'bps';
	}
}

// Process data into ranked nTop items
function processNTopData(
	data: any[], 
	category: NTopCategory, 
	topN: number,
	previousData?: any[]
): NTopItem[] {
	if (!data || data.length === 0) return [];
	
	// Aggregate by labels to get current rates
	const aggregated = new Map();
	
	data.forEach(point => {
		const labels = point.labels || {};
		let key = '';
		let label = '';
		
		// Generate key and label based on category
		switch (category) {
			case 'SERVICES':
				key = labels.service || 'unknown';
				label = labels.service || 'Unknown Service';
				break;
			case 'ENDPOINTS':
				key = `${labels.service || 'unknown'}-${labels.dip || 'unknown'}`;
				label = labels.dip || 'Unknown Endpoint';
				break;
			case 'CLIENTS':
				key = `${labels.service || 'unknown'}-${labels.sip || 'unknown'}`;
				label = labels.sip || 'Unknown Client';
				break;
		}
		
		if (!aggregated.has(key)) {
			aggregated.set(key, {
				id: key,
				label,
				value: 0,
				count: 0,
				metadata: {
					protocol: labels.protocol,
					service: labels.service,
					endpoint: labels.dip,
					client: labels.sip,
					unit: getUnitForCategory(category)
				}
			});
		}
		
		const item = aggregated.get(key);
		item.value += point.value || 0;
		item.count += 1;
	});
	
	// Convert to array and calculate averages
	const items = Array.from(aggregated.values()).map(item => ({
		...item,
		value: item.count > 0 ? item.value / item.count : 0 // Average rate
	}));
	
	// Calculate total for percentages
	const total = items.reduce((sum, item) => sum + item.value, 0);
	
	// Sort by value and take top N
	const sorted = items
		.filter(item => item.value > 0)
		.sort((a, b) => b.value - a.value)
		.slice(0, topN);
	
	// Add ranking and percentage info
	return sorted.map((item, index) => ({
		id: item.id,
		label: item.label,
		value: item.value,
		percentage: total > 0 ? (item.value / total) * 100 : 0,
		rank: index + 1,
		trend: 'stable' as const, // TODO: Calculate trend from previousData
		change: 0, // TODO: Calculate change from previousData
		metadata: item.metadata
	}));
}


// Enhanced nTop data hook with analysis context support
export function useNTopData(
	instance: IInstance | null, 
	category: NTopCategory, 
	timeWindow: NTopTimeWindow = '5m',
	topN: number = 10,
	analysisContext?: AnalysisContext
) {
	// Determine refresh interval based on analysis context
	const contextConfig = analysisContext ? ANALYSIS_CONTEXTS[analysisContext] : null;
	const refreshInterval = contextConfig?.refresh_interval || 5000;

	return useQuery({
		queryKey: ['ntop', category, instance?.name, timeWindow, topN, analysisContext],
		queryFn: async () => {
			if (!instance) return { 
				items: [], 
				timeWindow,
				analysisContext,
				windowConfig: NTOP_TIME_WINDOWS[timeWindow]
			};
			
			const categoryConfig = NTOP_CATEGORIES[category];
			let allData: any[] = [];
			let totalDataPoints = 0;

			// For other categories, use primary metric
			const primaryMetric = categoryConfig.primary_metric;
			const data = await fetchRateMetricData(instance, primaryMetric, timeWindow, analysisContext);
			allData = data?.data || [];
			totalDataPoints = data?.data?.length || 0;

			// Process into ranked items
			const items = processNTopData(allData, category, topN);
			
			return {
				items,
				timeWindow,
				analysisContext,
				windowConfig: NTOP_TIME_WINDOWS[timeWindow],
				totalDataPoints,
				fetchedAt: new Date().toISOString(),
				isMockData: false
			};
		},
		enabled: !!instance,
		refetchInterval: refreshInterval,
		staleTime: Math.max(refreshInterval - 1000, 1000) // Slightly less than refresh interval
	});
}

// Individual category hooks for easier usage with analysis context support
export function useNTopServices(
	instance: IInstance | null, 
	timeWindow: NTopTimeWindow = '5m', 
	topN: number = 10,
	analysisContext?: AnalysisContext
) {
	return useNTopData(instance, 'SERVICES', timeWindow, topN, analysisContext);
}

export function useNTopEndpoints(
	instance: IInstance | null, 
	timeWindow: NTopTimeWindow = '5m', 
	topN: number = 10,
	analysisContext?: AnalysisContext
) {
	return useNTopData(instance, 'ENDPOINTS', timeWindow, topN, analysisContext);
}

// Convenience hook for administrator analysis with recommended settings
export function useNTopAnalysis(
	instance: IInstance | null,
	analysisContext: AnalysisContext,
	category: NTopCategory = 'SERVICES',
	topN: number = 10
) {
	const contextConfig = ANALYSIS_CONTEXTS[analysisContext];
	const recommendedWindow = contextConfig.recommended_windows[0] as NTopTimeWindow;
	
	return useNTopData(instance, category, recommendedWindow, topN, analysisContext);
}