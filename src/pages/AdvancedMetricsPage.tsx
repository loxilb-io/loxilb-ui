//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Button, Paper} from '@mui/material';
import {get_local_storage, save_local_storage} from 'common';
// Import card components
import CacheStatsCard from 'components/card/CacheStatsCard';
import ConnectionFlowCard from 'components/card/ConnectionFlowCard';
import CriticalMetricCard from 'components/card/CriticalMetricCard';
import HealthStatusCard from 'components/card/HealthStatusCard';
import LiveMetricsCard from 'components/card/LiveMetricsCard';
import RealTimeRateCard from 'components/card/RealTimeRateCard';
import SystemHealthCard from 'components/card/SystemHealthCard';
// Import layout components
import HorizontalStack from 'components/layout/HorizontalStack';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {t} from 'i18next';
import {useState, useEffect} from 'react';
import RGL, {Layout} from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function AdvancedMetricsPage() {
	const instance = useInstanceFromURL();

	// Simple card configuration following project patterns
	const ANALYTICS_CARDS = [
		// === CRITICAL METRICS OVERVIEW ===
		{key: 'live-metrics', component: <LiveMetricsCard instance={instance} />},
		{key: 'system-health', component: <SystemHealthCard instance={instance} />},
		{key: 'cache-stats', component: <CacheStatsCard instance={instance} />},
		
		// === PERFORMANCE ANALYTICS ===
		{key: 'connection-tracking', component: <ConnectionFlowCard title={t('Connection Analytics')} instance={instance} />},
		{key: 'health-analytics', component: <HealthStatusCard title={t('Health Analytics')} instance={instance} />},
		
		// === TRAFFIC ANALYSIS ===
		{key: 'total-traffic-analytics', component: <RealTimeRateCard title={t('Total Traffic Analytics')} instance={instance} rateField="rps_bps" unit="bps" />},
		{key: 'total-packets-analytics', component: <RealTimeRateCard title={t('Total Packets Analytics')} instance={instance} rateField="rps_pps" unit="pps" />},
		{key: 'error-rate-analytics', component: <RealTimeRateCard title={t('Error Rate Analytics')} instance={instance} rateField="rps_eps" unit="eps" />},
		
		// === PROTOCOL BREAKDOWN ===
		{key: 'tcp-analytics', component: <RealTimeRateCard title={t('TCP Analytics')} instance={instance} rateField="rps_tcp_bps" unit="bps" />},
		{key: 'udp-analytics', component: <RealTimeRateCard title={t('UDP Analytics')} instance={instance} rateField="rps_udp_bps" unit="bps" />},
		{key: 'sctp-analytics', component: <RealTimeRateCard title={t('SCTP Analytics')} instance={instance} rateField="rps_sctp_bps" unit="bps" />},
		
		// === LOAD BALANCER ANALYTICS ===
		{key: 'lb-requests', component: <CriticalMetricCard title={t('LB Request Analytics')} instance={instance} metricField="total_requests" description={t('Total LB requests processed')} showGraph={true} />},
		{key: 'lb-errors', component: <CriticalMetricCard title={t('LB Error Analytics')} instance={instance} metricField="total_errors" description={t('Total LB errors')} showGraph={true} />},
		{key: 'lb-rules', component: <CriticalMetricCard title={t('LB Rules Analytics')} instance={instance} metricField="lb_rule_count" description={t('Active LB rules')} showGraph={false} />},
		
		// === FIREWALL ANALYTICS ===
		{key: 'firewall-rules', component: <CriticalMetricCard title={t('Firewall Rules')} instance={instance} metricField="firewall_rules_count" description={t('Active firewall rules')} showGraph={false} />},
	];

	// Simple grid layout - 3 cards per row (4-width each)  
	const DEFAULT_LAYOUT: Layout[] = [
		// === OVERVIEW ROW ===
		{i: 'live-metrics', x: 0, y: 0, w: 4, h: 2},
		{i: 'system-health', x: 4, y: 0, w: 4, h: 2},
		{i: 'cache-stats', x: 8, y: 0, w: 4, h: 2},
		
		// === ANALYTICS ROW ===
		{i: 'connection-tracking', x: 0, y: 2, w: 6, h: 2},
		{i: 'health-analytics', x: 6, y: 2, w: 6, h: 2},
		
		// === TRAFFIC ANALYSIS ROW ===
		{i: 'total-traffic-analytics', x: 0, y: 4, w: 4, h: 2},
		{i: 'total-packets-analytics', x: 4, y: 4, w: 4, h: 2},
		{i: 'error-rate-analytics', x: 8, y: 4, w: 4, h: 2},
		
		// === PROTOCOL BREAKDOWN ROW ===
		{i: 'tcp-analytics', x: 0, y: 6, w: 4, h: 2},
		{i: 'udp-analytics', x: 4, y: 6, w: 4, h: 2},
		{i: 'sctp-analytics', x: 8, y: 6, w: 4, h: 2},
		
		// === LOAD BALANCER ROW ===
		{i: 'lb-requests', x: 0, y: 8, w: 4, h: 2},
		{i: 'lb-errors', x: 4, y: 8, w: 4, h: 2},
		{i: 'lb-rules', x: 8, y: 8, w: 4, h: 2},
		
		// === FIREWALL ROW ===
		{i: 'firewall-rules', x: 0, y: 10, w: 4, h: 2},
	];

	const [layout, setLayout] = useState<Layout[] | null>(null);

	const handleLayoutChange = (newLayout: any) => {
		setLayout(newLayout);
		save_local_storage('analytics-layout', JSON.stringify(newLayout));
	};

	const handleResetLayout = () => {
		setLayout(DEFAULT_LAYOUT);
		save_local_storage('analytics-layout', JSON.stringify(DEFAULT_LAYOUT));
	};

	useEffect(() => {
		try {
			const savedLayout = get_local_storage('analytics-layout');
			if (savedLayout) {
				const parsedLayout = JSON.parse(savedLayout);
				if (parsedLayout.length !== DEFAULT_LAYOUT.length) throw new Error('Invalid layout length');
				setLayout(parsedLayout);
			} else {
				setLayout(DEFAULT_LAYOUT);
			}
		} catch (error) {
			console.error('Failed to load analytics layout:', error);
			setLayout(DEFAULT_LAYOUT);
		}
	}, []);

	return (
		<SubTitlePannel title="Advanced Metrics" sub_title="Comprehensive metrics monitoring">
			<HorizontalStack>
				<Button color="secondary" variant="outlined" size="small" onClick={handleResetLayout}>
					{t('Reset Layout')}
				</Button>
			</HorizontalStack>

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
					{ANALYTICS_CARDS.map(({key, component}) => (
						<Paper key={key}>{component}</Paper>
					))}
				</RGL>
			)}
		</SubTitlePannel>
	);
}