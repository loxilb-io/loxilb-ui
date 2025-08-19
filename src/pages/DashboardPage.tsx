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
import SimpleNetworkTopologyCard from 'components/card/SimpleNetworkTopologyCard';
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
		// === ALERT MONITORING (Top Priority) ===
		{key: 'active-alerts', component: <ActiveAlertsCard instance={inst} />},
		{key: 'alert-summary', component: <AlertSummaryCard instance={inst} />},
		
		// === SYSTEM OVERVIEW ===
		{key: 'system-usage', component: <SystemUsageCard instance={inst} />},
		{key: 'ha', component: <HACard instance={inst} />},
		
		// === NETWORK TOPOLOGY VISUALIZATION ===
		{key: 'network-topology', component: <SimpleNetworkTopologyCard instance={inst} />},
		
		// === CRITICAL METRICS (Administrator Focus) ===
		{key: 'connection-flows', component: <ConnectionFlowCard title={t('Connection Tracking')} instance={inst} />},
		{key: 'health-status', component: <HealthStatusCard title={t('Endpoint Health')} instance={inst} />},
		{key: 'lb-rules', component: <CriticalMetricCard title={t('Load Balancer Rules')} instance={inst} metricField="lb_rule_count" description={t('Active LB rules')} warningThreshold={50} criticalThreshold={100} />},
		
		// {key: 'total-requests', component: <CriticalMetricCard title={t('Total Requests')} instance={inst} metricField="total_requests" description={t('Request count')} showGraph={true} />},
		// {key: 'firewall-rules', component: <CriticalMetricCard title={t('Firewall Rules')} instance={inst} metricField="firewall_rules_count" description={t('Active FW rules')} showGraph={false} />},
		
		// === REAL-TIME TRAFFIC MONITORING ===
		{key: 'total-traffic-rate', component: <RealTimeRateCard title={t('Total Traffic Rate')} instance={inst} rateField="rps_bps" unit="bps" />},
		{key: 'total-packet-rate', component: <RealTimeRateCard title={t('Total Packet Rate')} instance={inst} rateField="rps_pps" unit="pps" />},
		{key: 'total-error-rate', component: <RealTimeRateCard title={t('Total Error Rate')} instance={inst} rateField="rps_eps" unit="eps" />},
		
		// === PROTOCOL-SPECIFIC MONITORING ===
		{key: 'tcp-traffic-rate', component: <RealTimeRateCard title={t('TCP Traffic Rate')} instance={inst} rateField="rps_tcp_bps" unit="bps" />},
		{key: 'udp-traffic-rate', component: <RealTimeRateCard title={t('UDP Traffic Rate')} instance={inst} rateField="rps_udp_bps" unit="bps" />},
		{key: 'sctp-traffic-rate', component: <RealTimeRateCard title={t('SCTP Traffic Rate')} instance={inst} rateField="rps_sctp_bps" unit="bps" />},
		
		// === ADVANCED ANALYTICS ===
		// {key: 'top-consumers', component: <TopConsumersCard instance={inst} />},
		// {key: 'performance-ranking', component: <PerformanceRankingCard instance={inst} />},
		// {key: 'live-metrics', component: <LiveMetricsCard instance={inst} />},
		
		// === TRAFFIC ANALYSIS ===
		// {key: 'ep-traffic', component: <EndpointCard instance={inst} />},
		// {key: 'service-dist-traffic', component: <ServiceDistTrafficCard instance={inst} />},
		// Note: TrafficHeatmapCard requires points prop - temporarily disabled
		// {key: 'traffic-heatmap', component: <TrafficHeatmapCard title={t('Traffic Heatmap')} points={[]} instance={inst} />},
		
		// === ERROR AND SECURITY MONITORING ===
		// Note: Temporarily disabled cards with data issues
		// {key: 'error', component: <ErrorCard instance={inst} />},
		// {key: 'firewall-drop', component: <DropCountCard instance={inst} />},
		// {key: 'req-counter', component: <ReqCounterCard instance={inst} />},
		
		// === SYSTEM LOGS AND DIAGNOSTICS ===
		{key: 'system-log', component: <SystemLogCard />},
		// {key: 'cache-stats', component: <CacheStatsCard instance={inst} />},
	];

	const DEFAULT_LAYOUT: Layout[] = [
		// === ROW 1: ALERT MONITORING (Highest Priority) ===
		{i: 'active-alerts', x: 0, y: 0, w: 7, h: 2.2}, // Active alerts - highest priority
		{i: 'alert-summary', x: 7, y: 0, w: 5, h: 2.2}, // Alert statistics
		
		// === ROW 2: SYSTEM OVERVIEW ===
		{i: 'system-usage', x: 0, y: 2, w:8, h: 2}, // System usage metrics
		{i: 'ha', x: 8, y: 2, w: 4, h: 2}, // High Availability status
		
		// === ROW 3: NETWORK TOPOLOGY VISUALIZATION (Prominent) ===
		{i: 'network-topology', x: 0, y: 4, w: 12, h: 2}, // Network topology - full width, larger height
		
		// === ROW 4: CRITICAL METRICS ===
		{i: 'connection-flows', x: 0, y: 8, w: 4, h: 1.3}, // Connection tracking
		{i: 'health-status', x: 4, y: 8, w: 4, h: 1.3}, // Endpoint health
		{i: 'lb-rules', x: 8, y: 8, w: 4, h: 1.3}, // Load balancer rules
		
		// === ROW 5: REQUEST AND SECURITY METRICS ===
		// {i: 'total-requests', x: 0, y: 10, w: 6, h: 1.3}, // Total requests
		// {i: 'firewall-rules', x: 6, y: 10, w: 6, h: 1.3}, // Firewall rules
		
		// === ROW 6: REAL-TIME TRAFFIC MONITORING ===
		{i: 'total-traffic-rate', x: 0, y: 12, w: 4, h: 1}, // Total traffic rate
		{i: 'total-packet-rate', x: 4, y: 12, w: 4, h: 1}, // Total packet rate
		{i: 'total-error-rate', x: 8, y: 12, w: 4, h: 1}, // Total error rate
		
		// === ROW 7: PROTOCOL-SPECIFIC MONITORING ===
		{i: 'tcp-traffic-rate', x: 0, y: 13, w: 4, h: 1}, // TCP traffic rate
		{i: 'udp-traffic-rate', x: 4, y: 13, w: 4, h: 1}, // UDP traffic rate
		{i: 'sctp-traffic-rate', x: 8, y: 13, w: 4, h: 1}, // SCTP traffic rate
		
		// === ROW 8: ADVANCED ANALYTICS ===
		// {i: 'top-consumers', x: 0, y: 14, w: 6, h: 2}, // Top bandwidth/request consumers
		// {i: 'performance-ranking', x: 6, y: 14, w: 6, h: 2}, // Performance rankings
		
		// === ROW 9: TRAFFIC ANALYSIS ===
		// {i: 'ep-traffic', x: 0, y: 16, w: 6, h: 1}, // Endpoint traffic distribution
		// {i: 'service-dist-traffic', x: 6, y: 16, w: 6, h: 1}, // Service distribution
		
		// === ROW 10: ADVANCED MONITORING ===
		// {i: 'live-metrics', x: 0, y: 18, w: 6, h: 2}, // Live metrics
		// {i: 'cache-stats', x: 6, y: 18, w: 6, h: 2}, // Cache statistics
		
		// === ROW 11: SECURITY AND DIAGNOSTICS ===
		// {i: 'req-counter', x: 0, y: 20, w: 6, h: 1}, // Request counter
		{i: 'system-log', x: 0, y: 20, w: 12, h: 2}, // System logs
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
