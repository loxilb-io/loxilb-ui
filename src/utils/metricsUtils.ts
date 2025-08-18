/**
 * Utility functions for working with live metrics data
 * Provides type-safe access and validation for metrics responses
 */

import { ILiveMetricsResponse, ITypedLiveMetricsResponse } from '../types/metrics';
import { CRITICAL_METRICS, IMPORTANT_METRICS, METRIC_CATEGORIES } from '../types/metricsConstants';

//---------------------------------------------------------
// Type Guards
//---------------------------------------------------------

/**
 * Checks if a metric name is a critical metric
 */
export function isCriticalMetric(metricName: string): boolean {
	return METRIC_CATEGORIES.CRITICAL.includes(metricName as any);
}

/**
 * Checks if a metric name is an important metric
 */
export function isImportantMetric(metricName: string): boolean {
	return METRIC_CATEGORIES.IMPORTANT.includes(metricName as any);
}

/**
 * Checks if the response contains important metrics (phase 2)
 */
export function hasImportantMetrics(response: ILiveMetricsResponse): boolean {
	return response.phase === 2 && !!response.important;
}

//---------------------------------------------------------
// Metric Access Utilities
//---------------------------------------------------------

/**
 * Safely get a critical metric value with fallback
 */
export function getCriticalMetric(response: ILiveMetricsResponse, metricName: keyof typeof CRITICAL_METRICS, fallback: number = 0): number {
	const metricKey = CRITICAL_METRICS[metricName];
	return response.critical[metricKey] ?? fallback;
}

/**
 * Safely get an important metric value with fallback
 */
export function getImportantMetric(response: ILiveMetricsResponse, metricName: keyof typeof IMPORTANT_METRICS, fallback: number = 0): number {
	if (!response.important) return fallback;
	const metricKey = IMPORTANT_METRICS[metricName];
	return response.important[metricKey] ?? fallback;
}

/**
 * Get all available metric names from the response
 */
export function getAvailableMetrics(response: ILiveMetricsResponse): {
	critical: string[];
	important: string[];
	total: number;
} {
	const critical = Object.keys(response.critical);
	const important = response.important ? Object.keys(response.important) : [];
	
	return {
		critical,
		important,
		total: critical.length + important.length
	};
}

/**
 * Validate that response contains expected metrics
 */
export function validateMetricsResponse(response: ILiveMetricsResponse): {
	isValid: boolean;
	missingCritical: string[];
	unexpectedMetrics: string[];
} {
	const availableMetrics = getAvailableMetrics(response);
	const expectedCritical = METRIC_CATEGORIES.CRITICAL;
	
	const missingCritical = expectedCritical.filter((metric: string) => 
		!availableMetrics.critical.includes(metric)
	);
	
	const allExpected = response.phase === 2 
		? [...METRIC_CATEGORIES.CRITICAL, ...METRIC_CATEGORIES.IMPORTANT]
		: METRIC_CATEGORIES.CRITICAL;
	
	const allReceived = [...availableMetrics.critical, ...availableMetrics.important];
	const unexpectedMetrics = allReceived.filter((metric: string) => 
		!allExpected.includes(metric as any)
	);
	
	return {
		isValid: missingCritical.length === 0,
		missingCritical,
		unexpectedMetrics
	};
}

//---------------------------------------------------------
// Data Transformation Utilities
//---------------------------------------------------------

/**
 * Convert loose response to strongly typed response
 */
export function toTypedResponse(response: ILiveMetricsResponse): ITypedLiveMetricsResponse {
	return response as ITypedLiveMetricsResponse;
}

/**
 * Extract metrics by category
 */
export function extractMetricsByCategory(response: ILiveMetricsResponse): {
	connectionTracking: Record<string, number>;
	loadBalancer: Record<string, number>;
	endpointHealth: Record<string, number>;
	firewall: Record<string, number>;
	trafficProcessing: Record<string, number>;
	rpsCalculator: Record<string, number>;
} {
	const result: {
		connectionTracking: Record<string, number>;
		loadBalancer: Record<string, number>;
		endpointHealth: Record<string, number>;
		firewall: Record<string, number>;
		trafficProcessing: Record<string, number>;
		rpsCalculator: Record<string, number>;
	} = {
		connectionTracking: {},
		loadBalancer: {},
		endpointHealth: {},
		firewall: {},
		trafficProcessing: {},
		rpsCalculator: {}
	};

	// Extract connection tracking metrics
	Object.entries(response.critical).forEach(([key, value]) => {
		if (key.includes('conntrack') || key.includes('flow')) {
			result.connectionTracking[key] = value;
		} else if (key.includes('lb_') || key.includes('requests') || key.includes('errors')) {
			result.loadBalancer[key] = value;
		} else if (key.includes('endpoint') || key.includes('host') || key.includes('health')) {
			result.endpointHealth[key] = value;
		} else if (key.includes('fw_') || key.includes('firewall')) {
			result.firewall[key] = value;
		}
	});

	// Extract important metrics
	if (response.important) {
		Object.entries(response.important).forEach(([key, value]) => {
			if (key.includes('processed_')) {
				result.trafficProcessing[key] = value;
			} else if (key.includes('rps_')) {
				result.rpsCalculator[key] = value;
			}
		});
	}

	return result;
}

/**
 * Format metric value for display
 */
export function formatMetricValue(value: number, metricName: string): string {
	// Bytes metrics
	if (metricName.includes('bytes')) {
		return formatBytes(value);
	}
	
	// Rate metrics (per second)
	if (metricName.includes('rps_') || metricName.includes('_per_second')) {
		return `${value.toFixed(2)}/s`;
	}
	
	// Percentage metrics
	if (metricName.includes('ratio') || metricName.includes('utilization')) {
		return `${(value * 100).toFixed(1)}%`;
	}
	
	// Count metrics
	if (metricName.includes('count') || metricName.includes('_total')) {
		return value.toLocaleString();
	}
	
	// Response time
	if (metricName.includes('response_time')) {
		return `${value.toFixed(3)}ms`;
	}
	
	// Default formatting
	return value.toString();
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

//---------------------------------------------------------
// Response Analysis Utilities
//---------------------------------------------------------

/**
 * Analyze response performance and health
 */
export function analyzeResponseHealth(response: ILiveMetricsResponse): {
	cachePerformance: 'excellent' | 'good' | 'poor';
	dataCompleteness: 'complete' | 'partial' | 'incomplete';
	responseQuality: 'high' | 'medium' | 'low';
	summary: string;
} {
	const validation = validateMetricsResponse(response);
	
	// Cache performance analysis
	let cachePerformance: 'excellent' | 'good' | 'poor' = 'poor';
	if (response.response_time_ms < 1) cachePerformance = 'excellent';
	else if (response.response_time_ms < 10) cachePerformance = 'good';
	
	// Data completeness analysis
	let dataCompleteness: 'complete' | 'partial' | 'incomplete' = 'incomplete';
	if (validation.isValid && response.total_metrics > 30) dataCompleteness = 'complete';
	else if (validation.missingCritical.length < 3) dataCompleteness = 'partial';
	
	// Overall quality
	let responseQuality: 'high' | 'medium' | 'low' = 'low';
	if (cachePerformance === 'excellent' && dataCompleteness === 'complete') {
		responseQuality = 'high';
	} else if (cachePerformance !== 'poor' && dataCompleteness !== 'incomplete') {
		responseQuality = 'medium';
	}
	
	const summary = `Cache: ${cachePerformance}, Data: ${dataCompleteness}, Quality: ${responseQuality}`;
	
	return {
		cachePerformance,
		dataCompleteness,
		responseQuality,
		summary
	};
}
