//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Button, Paper, Typography} from '@mui/material';
import {get_local_storage, save_local_storage} from 'common';
import ActiveAlertsCard from 'components/card/ActiveAlertsCard';
import AlertSummaryCard from 'components/card/AlertSummaryCard';
import CacheStatsCard from 'components/card/CacheStatsCard';
import RealTimeRateCard from 'components/card/RealTimeRateCard';
import CriticalMetricCard from 'components/card/CriticalMetricCard';
import HealthStatusCard from 'components/card/HealthStatusCard';
import ConnectionFlowCard from 'components/card/ConnectionFlowCard';
import DropCountCard from 'components/card/DropCountCard';
import EndpointCard from 'components/card/EndpointCard';
import ErrorCard from 'components/card/ErrorCard';
import HACard from 'components/card/HACard';
import LBRuleCard from 'components/card/LBRuleCard';
import LiveMetricsCard from 'components/card/LiveMetricsCard';
import ReqCounterCard from 'components/card/ReqCounterCard';
import ServiceDistTrafficCard from 'components/card/ServiceDistTrafficCard';
import SystemHealthCard from 'components/card/SystemHealthCard';
import SystemLogCard from 'components/card/SystemLogCard';
import SystemUsageCard from 'components/card/SystemUsageCard';
import TrafficCard from 'components/card/TrafficCard';
import EnhancedTrafficCard from 'components/card/EnhancedTrafficCard';
import NetworkTopologyCard from 'components/card/NetworkTopologyCard';
import TrafficHeatmapCard from 'components/card/TrafficHeatmapCard';
import PerformanceChartsCard from 'components/card/PerformanceChartsCard';
import SystemGaugesCard from 'components/card/SystemGaugesCard';
import TopConsumersCard from 'components/card/TopConsumersCard';
import PerformanceRankingCard from 'components/card/PerformanceRankingCard';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {t} from 'i18next';
import {useEffect, useState} from 'react';
import RGL, {Layout} from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function DashboardPage() {
	const inst = useInstanceFromURL();

	// RealTimeRateCard components will handle their own metrics fetching and time series accumulation

	const CARD_CONFIG = [
		// === NEW MONITORING CARDS (Phase 1) ===
		// {key: 'active-alerts', component: <ActiveAlertsCard instance={inst} />},
		// {key: 'alert-summary', component: <AlertSummaryCard instance={inst} />},
		
		// === EXISTING SYSTEM CARDS ===
		{key: 'system-usage', component: <SystemUsageCard instance={inst} />},
		// {key: 'system-log', component: <SystemLogCard />},
		// {key: 'ha', component: <HACard instance={inst} />},
		
		// === CRITICAL METRICS (Administrator Focus) ===
		{key: 'connection-flows', component: <ConnectionFlowCard title={t('Connection Tracking')} instance={inst} />},
		{key: 'health-status', component: <HealthStatusCard title={t('Endpoint Health')} instance={inst} />},
		{key: 'lb-rules', component: <CriticalMetricCard title={t('Load Balancer Rules')} instance={inst} metricField="lb_rule_count" description={t('Active LB rules')} warningThreshold={50} criticalThreshold={100} />},
		{key: 'total-requests', component: <CriticalMetricCard title={t('Total Requests')} instance={inst} metricField="total_requests" description={t('Request count')} showGraph={true} />},
		{key: 'firewall-rules', component: <CriticalMetricCard title={t('Firewall Rules')} instance={inst} metricField="firewall_rules_count" description={t('Active FW rules')} showGraph={false} />},
		
		// Enhanced Traffic Cards (cumulative values with rich visualizations)
		// {key: 'total-traffic', component: <EnhancedTrafficCard title={t('Total Traffic Overview')} points={traffics} data_key="processed_bytes" />},
		// {key: 'total-packet', component: <EnhancedTrafficCard title={t('Total Packet Overview')} points={traffics} data_key="processed_packets" />},
		
		// Real-Time Rate Cards with Moving Graphs
		{key: 'total-traffic-rate', component: <RealTimeRateCard title={t('Total Traffic Rate')} instance={inst} rateField="rps_bps" unit="bps" />},
		{key: 'total-packet-rate', component: <RealTimeRateCard title={t('Total Packet Rate')} instance={inst} rateField="rps_pps" unit="pps" />},
		{key: 'tcp-traffic-rate', component: <RealTimeRateCard title={t('TCP Traffic Rate')} instance={inst} rateField="rps_tcp_bps" unit="bps" />},
		{key: 'udp-traffic-rate', component: <RealTimeRateCard title={t('UDP Traffic Rate')} instance={inst} rateField="rps_udp_bps" unit="bps" />},
		{key: 'sctp-traffic-rate', component: <RealTimeRateCard title={t('SCTP Traffic Rate')} instance={inst} rateField="rps_sctp_bps" unit="bps" />},
		{key: 'total-error-rate', component: <RealTimeRateCard title={t('Total Error Rate')} instance={inst} rateField="rps_eps" unit="bps" />},
		
		// Enhanced Protocol Traffic (with interactive visualizations)
		// {key: 'tcp-traffic', component: <EnhancedTrafficCard title={t('TCP Traffic Overview')} points={traffics} data_key="processed_tcp_bytes" />},
		// {key: 'udp-traffic', component: <EnhancedTrafficCard title={t('UDP Traffic Overview')} points={traffics} data_key="processed_udp_bytes" />},
		// {key: 'sctp-traffic', component: <EnhancedTrafficCard title={t('SCTP Traffic Overview')} points={traffics} data_key="processed_sctp_bytes" />},
		
		// Advanced Metrics Cards
		// {key: 'live-metrics', component: <LiveMetricsCard instance={inst} />},
		// {key: 'cache-stats', component: <CacheStatsCard instance={inst} />},
		// {key: 'system-health', component: <SystemHealthCard instance={inst} />},
		
		// === INTERACTIVE VISUAL COMPONENTS (Phase 2) ===
		// {key: 'network-topology', component: <NetworkTopologyCard instance={inst} />},
		// {key: 'traffic-heatmap', component: <TrafficHeatmapCard title={t('Traffic Heatmap')} points={traffics} instance={inst} />},
		
				
		// === TOP-N ANALYTICS (Phase 2) ===
		// {key: 'top-consumers', component: <TopConsumersCard instance={inst} />},
		// {key: 'performance-ranking', component: <PerformanceRankingCard instance={inst} />},
		
		// Existing Cards
		// {key: 'ep-traffic', component: <EndpointCard instance={inst} />},
		// {key: 'service-dist-traffic', component: <ServiceDistTrafficCard instance={inst} />},
		
		
		// {key: 'error', component: <ErrorCard instance={inst} />},
		// {key: 'firewall-drop', component: <DropCountCard instance={inst} />},
		// {key: 'lb-rules', component: <LBRuleCard instance={inst} />},		
		// {key: 'req-counter', component: <ReqCounterCard instance={inst} />},
	];

	const DEFAULT_LAYOUT: Layout[] = [
		// === CRITICAL MONITORING (Top Priority) ===
		// {i: 'active-alerts', x: 0, y: 0, w: 8, h: 2}, // Active alerts - highest priority
		// {i: 'alert-summary', x: 8, y: 0, w: 4, h: 2}, // Alert statistics
		
		// === SYSTEM OVERVIEW (Second Row) - 3 cards per row (4-width each) ===
		{i: 'system-usage', x: 0, y: 2, w: 8, h: 2}, // System usage metrics
		{i: 'connection-flows', x: 8, y: 2, w: 4, h: 1}, // Connection tracking  
		{i: 'health-status', x: 8, y: 2, w: 4, h: 1}, // Endpoint health
		
		// === CRITICAL METRICS (Fifth Row) - 3 cards per row (4-width each) ===
		{i: 'lb-rules', x: 0, y: 5, w: 4, h: 2}, // Load balancer rules
		{i: 'total-requests', x: 4, y: 5, w: 4, h: 2}, // Total requests  
		{i: 'firewall-rules', x: 8, y: 5, w: 4, h: 2}, // Firewall rules
		
		// === TRAFFIC RATES (Seventh Row) - 3 cards per row (4-width each) ===
		{i: 'total-traffic-rate', x: 0, y: 7, w: 4, h: 1}, // Total traffic rate
		{i: 'total-packet-rate', x: 4, y: 7, w: 4, h: 1}, // Total packet rate
		{i: 'total-error-rate', x: 8, y: 7, w: 4, h: 1}, // Total packet rate		
		
		// {i: 'system-log', x: 9, y: 2, w: 3, h: 1}, // System logs
		// {i: 'system-health', x: 6, y: 3, w: 6, h: 1}, // System health (placeholder for future)
		// {i: 'system-usage', x: 0, y: 2, w: 6, h: 2}, // System usage metrics
		// {i: 'ha', x: 6, y: 2, w: 3, h: 1}, // High Availability status
		// {i: 'system-log', x: 9, y: 2, w: 3, h: 1}, // System logs
		// {i: 'system-health', x: 6, y: 3, w: 6, h: 1}, // System health (placeholder for future)
		
		// === ADVANCED METRICS (Third Row) ===
		// {i: 'live-metrics', x: 0, y: 4, w: 6, h: 2}, // Live metrics
		// {i: 'cache-stats', x: 6, y: 4, w: 6, h: 2}, // Cache statistics
		
		// === INTERACTIVE VISUAL COMPONENTS (Phase 2) ===
		// {i: 'network-topology', x: 0, y: 6, w: 8, h: 3}, // Network topology visualization
		// {i: 'traffic-heatmap', x: 8, y: 6, w: 4, h: 3}, // Traffic heatmap
		

		// === TOP-N ANALYTICS (Phase 2) ===
		// {i: 'top-consumers', x: 0, y: 12, w: 6, h: 3}, // Top bandwidth/request consumers
		// {i: 'performance-ranking', x: 6, y: 12, w: 6, h: 3}, // Performance rankings
		
		// === PROTOCOL RATES (Ninth Row) - 3 cards per row (4-width each) ===
		{i: 'tcp-traffic-rate', x: 0, y: 9, w: 4, h: 1}, // TCP traffic rate		
		{i: 'udp-traffic-rate', x: 4, y: 9, w: 4, h: 1}, // UDP rate
		{i: 'sctp-traffic-rate', x: 8, y: 9, w: 4, h: 1}, // SCTP rate
		// Third slot available for future protocol card
		
		
		// === ENHANCED TRAFFIC VISUALIZATION (Taller for rich charts) ===
		// {i: 'total-traffic', x: 0, y: 16, w: 6, h: 2}, // Enhanced Total traffic with charts
		// {i: 'total-packet', x: 6, y: 16, w: 6, h: 2}, // Enhanced Total packet with charts
		
		// === ENHANCED PROTOCOL TRAFFIC ===
		// {i: 'tcp-traffic', x: 0, y: 18, w: 4, h: 2}, // Enhanced TCP traffic with charts
		// {i: 'udp-traffic', x: 4, y: 18, w: 4, h: 2}, // Enhanced UDP traffic with charts
		// {i: 'sctp-traffic', x: 8, y: 18, w: 4, h: 2}, // Enhanced SCTP traffic with charts
		
		// === ENDPOINT TRAFFIC DISTRIBUTION ===
		// {i: 'ep-traffic', x: 0, y: 20, w: 6, h: 1}, // Endpoint traffic (full width)

		// === SERVICE DISTRIBUTION (Bottom) ===
		// {i: 'service-dist-traffic', x: 6, y: 20, w: 6, h: 1}, // Service distribution
		
		// === ERROR AND ANALYSIS ===
		// {i: 'error', x: 0, y: 21, w: 4, h: 1}, // Error metrics
		// {i: 'firewall-drop', x: 4, y: 21, w: 4, h: 1}, // Firewall drops
		// {i: 'lb-rules', x: 8, y: 21, w: 4, h: 1}, // Load balancer rules
		// {i: 'req-counter', x: 9, y: 21, w: 3, h: 1}, // Request counter		
		
	];

	const [layout, set_layout] = useState<Layout[] | null>(null);

	const handleLayoutChange = (newLayout: any) => {
		set_layout(newLayout);
		save_local_storage('layout', JSON.stringify(newLayout));
	};

	const handleClick = () => {
		set_layout(DEFAULT_LAYOUT);
		save_local_storage('layout', JSON.stringify(DEFAULT_LAYOUT));
	};

	useEffect(() => {
		try {
			const saved_layout = get_local_storage('layout');
			if (saved_layout) {
				const parsed_layout = JSON.parse(saved_layout);
				if (parsed_layout.length !== DEFAULT_LAYOUT.length) throw new Error('Invalid layout length');
				set_layout(parsed_layout);
			} else set_layout(DEFAULT_LAYOUT);
		} catch (error) {
			console.error('Failed to load layout:', error);
			set_layout(DEFAULT_LAYOUT);
		}
	}, []);

	return (
		<Box width="100%" height="100%">
			<Box display="flex" gap="20px" marginLeft="10px">
				<Typography variant="h5">{t('Dashboard')}</Typography>
				<Button color="secondary" variant="outlined" size="small" onClick={handleClick}>
					{t('Reset Layout')}
				</Button>
			</Box>

			{layout && (
				<RGL
					className="layout"
					layout={layout}
					cols={12}
					rowHeight={300}
					width={1200}
					onLayoutChange={handleLayoutChange}
					isDraggable={true}
					isResizable={false}
					draggableCancel=".no-drag"
				>
					{CARD_CONFIG.map(({key, component}) => (
						<Paper key={key}>{component}</Paper>
					))}
				</RGL>
			)}
		</Box>
	);
}
