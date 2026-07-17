//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Button, Paper, Typography} from '@mui/material';
import {get_local_storage, save_local_storage} from 'common';
import RealTimeRateCard from 'components/card/RealTimeRateCard';
import CriticalMetricCard from 'components/card/CriticalMetricCard';
import HealthStatusCard from 'components/card/HealthStatusCard';
import ConnectionFlowCard from 'components/card/ConnectionFlowCard';
import HACard from 'components/card/HACard';
import SystemLogCard from 'components/card/SystemLogCard';
import SystemUsageCard from 'components/card/SystemUsageCard';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useInstanceHealth} from 'hooks/query/healthHook';
import {t} from 'i18next';
import {useEffect, useState, useMemo} from 'react';
import RGL, {Layout} from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {Alert, AlertTitle, CircularProgress} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function DashboardPage() {
	const inst = useInstanceFromURL();
	
	// Check instance health to prevent polling down instances (only on page load, no automatic polling)
	const {health, isLoading: healthLoading, refetch: refreshHealth} = useInstanceHealth(inst, true);
	const isInstanceDown = health?.isHealthy === false;

	// RealTimeRateCard components will handle their own metrics fetching and time series accumulation

	const CARD_CONFIG = [
		// === SYSTEM OVERVIEW ===
		{key: 'system-usage', component: <SystemUsageCard instance={inst} />},
		{key: 'ha', component: <HACard instance={inst} />},

		// === CRITICAL METRICS (Administrator Focus) ===
		{key: 'connection-flows', component: <ConnectionFlowCard title={t('Connection Tracking')} instance={inst} />},
		{key: 'health-status', component: <HealthStatusCard title={t('Endpoint Health')} instance={inst} />},
		{key: 'lb-rules', component: <CriticalMetricCard title={t('Load Balancer Rules')} instance={inst} metricField="lb_rule_count" description={t('Active LB rules')} warningThreshold={50} criticalThreshold={100} />},

		// === REAL-TIME TRAFFIC MONITORING ===
		{key: 'total-traffic-rate', component: <RealTimeRateCard title={t('Total Traffic Rate')} instance={inst} rateField="rps_bps" unit="bps" />},
		{key: 'total-packet-rate', component: <RealTimeRateCard title={t('Total Packet Rate')} instance={inst} rateField="rps_pps" unit="pps" />},
		{key: 'total-error-rate', component: <RealTimeRateCard title={t('Total Error Rate')} instance={inst} rateField="rps_eps" unit="eps" />},
		
		// === PROTOCOL-SPECIFIC MONITORING ===
		{key: 'tcp-traffic-rate', component: <RealTimeRateCard title={t('TCP Traffic Rate')} instance={inst} rateField="rps_tcp_bps" unit="bps" />},
		{key: 'udp-traffic-rate', component: <RealTimeRateCard title={t('UDP Traffic Rate')} instance={inst} rateField="rps_udp_bps" unit="bps" />},
		{key: 'sctp-traffic-rate', component: <RealTimeRateCard title={t('SCTP Traffic Rate')} instance={inst} rateField="rps_sctp_bps" unit="bps" />},

		// === SYSTEM LOGS AND DIAGNOSTICS ===
		{key: 'system-log', component: <SystemLogCard />},
	];

	const DEFAULT_LAYOUT: Layout[] = [
		// === ROW 1: SYSTEM OVERVIEW ===
		{i: 'system-usage', x: 0, y: 0, w: 8, h: 2}, // System usage metrics
		{i: 'ha', x: 8, y: 0, w: 4, h: 2}, // High Availability status

		// === ROW 2: CRITICAL METRICS ===
		{i: 'connection-flows', x: 0, y: 2, w: 4, h: 1.3}, // Connection tracking
		{i: 'health-status', x: 4, y: 2, w: 4, h: 1.3}, // Endpoint health
		{i: 'lb-rules', x: 8, y: 2, w: 4, h: 1.3}, // Load balancer rules

		// === ROW 3: REAL-TIME TRAFFIC MONITORING ===
		{i: 'total-traffic-rate', x: 0, y: 4, w: 4, h: 1}, // Total traffic rate
		{i: 'total-packet-rate', x: 4, y: 4, w: 4, h: 1}, // Total packet rate
		{i: 'total-error-rate', x: 8, y: 4, w: 4, h: 1}, // Total error rate

		// === ROW 4: PROTOCOL-SPECIFIC MONITORING ===
		{i: 'tcp-traffic-rate', x: 0, y: 5, w: 4, h: 1}, // TCP traffic rate
		{i: 'udp-traffic-rate', x: 4, y: 5, w: 4, h: 1}, // UDP traffic rate
		{i: 'sctp-traffic-rate', x: 8, y: 5, w: 4, h: 1}, // SCTP traffic rate

		// === ROW 5: SYSTEM LOGS AND DIAGNOSTICS ===
		{i: 'system-log', x: 0, y: 6, w: 12, h: 2}, // System logs
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

	// Show error state if instance is down
	if (isInstanceDown) {
		return (
			<Box width="100%" height="100%" display="flex" flexDirection="column" alignItems="center" justifyContent="center" padding="40px">
				<Alert severity="error" sx={{ width: '100%', maxWidth: '600px', mb: 3 }}>
					<AlertTitle>{t('Instance Unavailable')}</AlertTitle>
					{t('The instance "{{name}}" is currently down or unreachable. Dashboard metrics cannot be loaded.', { name: inst?.name || 'Unknown' })}
				</Alert>
				<Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
					{t('Please check the instance status and return to the dashboard once the instance is healthy.')}
				</Typography>
				<Button
					variant="outlined"
					onClick={() => refreshHealth()}
					disabled={healthLoading}
					startIcon={healthLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
				>
					{healthLoading ? t('Checking...') : t('Recheck Health')}
				</Button>
			</Box>
		);
	}

	// Show loading state while checking health
	if (inst && health === null && healthLoading) {
		return (
			<Box width="100%" height="100%" display="flex" flexDirection="column" alignItems="center" justifyContent="center" padding="40px">
				<CircularProgress size={48} sx={{ mb: 3 }} />
				<Typography variant="h6" gutterBottom>
					{t('Checking Instance Status...')}
				</Typography>
				<Typography variant="body2" color="text.secondary" textAlign="center">
					{t('Verifying that "{{name}}" is accessible before loading dashboard.', { name: inst?.name || 'Unknown' })}
				</Typography>
			</Box>
		);
	}

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
