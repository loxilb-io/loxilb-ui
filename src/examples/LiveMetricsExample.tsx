/**
 * Example component demonstrating how to use the live metrics API
 * with the actual response structure and utility functions
 */

import React from 'react';
import { useLiveMetrics } from '../hooks/query/advancedMetricsHook';
import { 
	getCriticalMetric, 
	getImportantMetric, 
	formatMetricValue, 
	analyzeResponseHealth,
	extractMetricsByCategory,
	validateMetricsResponse 
} from '../utils/metricsUtils';
import { CRITICAL_METRICS, IMPORTANT_METRICS } from '../types/metricsConstants';
import { IInstance } from '../types/oam';

interface LiveMetricsDashboardProps {
	instance: IInstance | null;
	phase?: 1 | 2;
}

export default function LiveMetricsDashboard({ instance, phase = 2 }: LiveMetricsDashboardProps) {
	const { data: metrics, isLoading, error } = useLiveMetrics(instance, phase);

	if (isLoading) return <div>Loading metrics...</div>;
	if (error) return <div>Error loading metrics: {error.message}</div>;
	if (!metrics) return <div>No metrics data available</div>;

	// Analyze the response
	const health = analyzeResponseHealth(metrics);
	const validation = validateMetricsResponse(metrics);
	const categorized = extractMetricsByCategory(metrics);

	return (
		<div className="metrics-dashboard">
			{/* Response Health Overview */}
			<div className="metrics-header">
				<h2>Live Metrics Dashboard</h2>
				<div className="metrics-info">
					<span>Phase: {metrics.phase}</span>
					<span>Total Metrics: {metrics.total_metrics}</span>
					<span>Response Time: {formatMetricValue(metrics.response_time_ms, 'response_time_ms')}</span>
					<span>Source: {metrics.source}</span>
					<span>Health: {health.summary}</span>
				</div>
			</div>

			{/* Validation Status */}
			{!validation.isValid && (
				<div className="validation-warning">
					<h4>⚠️ Metrics Validation Issues</h4>
					{validation.missingCritical.length > 0 && (
						<p>Missing Critical Metrics: {validation.missingCritical.join(', ')}</p>
					)}
					{validation.unexpectedMetrics.length > 0 && (
						<p>Unexpected Metrics: {validation.unexpectedMetrics.join(', ')}</p>
					)}
				</div>
			)}

			{/* Critical Metrics Display */}
			<div className="metrics-section">
				<h3>🔴 Critical Metrics (Phase 1)</h3>
				<div className="metrics-grid">
					{/* Connection Tracking */}
					<div className="metric-category">
						<h4>Connection Tracking</h4>
						<div className="metric-item">
							<span>Active Connections:</span>
							<span>{getCriticalMetric(metrics, 'ACTIVE_CONNTRACK_COUNT').toLocaleString()}</span>
						</div>
						<div className="metric-item">
							<span>TCP Flows:</span>
							<span>{getCriticalMetric(metrics, 'ACTIVE_FLOW_COUNT_TCP').toLocaleString()}</span>
						</div>
						<div className="metric-item">
							<span>UDP Flows:</span>
							<span>{getCriticalMetric(metrics, 'ACTIVE_FLOW_COUNT_UDP').toLocaleString()}</span>
						</div>
						<div className="metric-item">
							<span>New Flows:</span>
							<span>{getCriticalMetric(metrics, 'NEW_FLOW_COUNT').toLocaleString()}</span>
						</div>
					</div>

					{/* Load Balancer */}
					<div className="metric-category">
						<h4>Load Balancer</h4>
						<div className="metric-item">
							<span>LB Rules:</span>
							<span>{getCriticalMetric(metrics, 'LB_RULE_COUNT').toLocaleString()}</span>
						</div>
						<div className="metric-item">
							<span>Total Requests:</span>
							<span>{getCriticalMetric(metrics, 'TOTAL_REQUESTS').toLocaleString()}</span>
						</div>
						<div className="metric-item">
							<span>Total Errors:</span>
							<span>{getCriticalMetric(metrics, 'TOTAL_ERRORS').toLocaleString()}</span>
						</div>
					</div>

					{/* Endpoint Health */}
					<div className="metric-category">
						<h4>Endpoint Health</h4>
						<div className="metric-item">
							<span>Healthy Endpoints:</span>
							<span>{getCriticalMetric(metrics, 'HEALTHY_ENDPOINTS_COUNT').toLocaleString()}</span>
						</div>
						<div className="metric-item">
							<span>Unhealthy Endpoints:</span>
							<span>{getCriticalMetric(metrics, 'UNHEALTHY_ENDPOINTS_COUNT').toLocaleString()}</span>
						</div>
					</div>
				</div>
			</div>

			{/* Important Metrics Display (Phase 2 only) */}
			{phase === 2 && metrics.important && (
				<div className="metrics-section">
					<h3>🟡 Important Metrics (Phase 2)</h3>
					<div className="metrics-grid">
						{/* Traffic Processing */}
						<div className="metric-category">
							<h4>Traffic Processing</h4>
							<div className="metric-item">
								<span>Total Bytes:</span>
								<span>{formatMetricValue(getImportantMetric(metrics, 'PROCESSED_BYTES_TOTAL'), 'processed_bytes_total')}</span>
							</div>
							<div className="metric-item">
								<span>Total Packets:</span>
								<span>{getImportantMetric(metrics, 'PROCESSED_PACKETS_TOTAL').toLocaleString()}</span>
							</div>
							<div className="metric-item">
								<span>TCP Bytes:</span>
								<span>{formatMetricValue(getImportantMetric(metrics, 'PROCESSED_TCP_BYTES'), 'processed_tcp_bytes')}</span>
							</div>
						</div>

						{/* RPS Calculator */}
						<div className="metric-category">
							<h4>RPS Calculator</h4>
							<div className="metric-item">
								<span>Avg RPS (1m):</span>
								<span>{formatMetricValue(getImportantMetric(metrics, 'REQUESTS_PER_SECOND_AVG_1M'), 'rps_1m_avg')}</span>
							</div>
							<div className="metric-item">
								<span>Peak RPS (1m):</span>
								<span>{formatMetricValue(getImportantMetric(metrics, 'REQUESTS_PER_SECOND_PEAK_1M'), 'rps_1m_peak')}</span>
							</div>
							<div className="metric-item">
								<span>Bytes/sec:</span>
								<span>{formatMetricValue(getImportantMetric(metrics, 'BYTES_PER_SECOND'), 'rps_bps')}</span>
							</div>
							<div className="metric-item">
								<span>Packets/sec:</span>
								<span>{formatMetricValue(getImportantMetric(metrics, 'PACKETS_PER_SECOND'), 'rps_pps')}</span>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Raw Categorized Data */}
			<div className="metrics-section">
				<h3>📊 Categorized Metrics</h3>
				<div className="categorized-metrics">
					{Object.entries(categorized).map(([category, metricData]) => (
						<div key={category} className="category-section">
							<h4>{category}</h4>
							<div className="metric-list">
								{Object.entries(metricData).map(([metricName, value]) => (
									<div key={metricName} className="metric-row">
										<span className="metric-name">{metricName}:</span>
										<span className="metric-value">{formatMetricValue(value, metricName)}</span>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Raw Response Data (for debugging) */}
			<details className="raw-data-section">
				<summary>🔍 Raw Response Data</summary>
				<pre>{JSON.stringify(metrics, null, 2)}</pre>
			</details>
		</div>
	);
}

// Example of how to use specific metrics with type safety
export function MetricsSummaryCard({ instance }: { instance: IInstance | null }) {
	const { data: metrics } = useLiveMetrics(instance, 2);

	if (!metrics) return null;

	const connectionHealth = getCriticalMetric(metrics, 'HEALTHY_ENDPOINTS_COUNT') > 0;
	const hasErrors = getCriticalMetric(metrics, 'TOTAL_ERRORS') > 0;
	const trafficVolume = getImportantMetric(metrics, 'PROCESSED_BYTES_TOTAL');

	return (
		<div className="metrics-summary-card">
			<div className="summary-item">
				<span className={`status-indicator ${connectionHealth ? 'healthy' : 'unhealthy'}`}>
					{connectionHealth ? '🟢' : '🔴'}
				</span>
				<span>Endpoint Health</span>
			</div>
			<div className="summary-item">
				<span className={`status-indicator ${!hasErrors ? 'healthy' : 'warning'}`}>
					{!hasErrors ? '🟢' : '🟡'}
				</span>
				<span>Error Status</span>
			</div>
			<div className="summary-item">
				<span>📊</span>
				<span>Traffic: {formatMetricValue(trafficVolume, 'processed_bytes_total')}</span>
			</div>
		</div>
	);
}
