//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Button, Paper, Typography} from '@mui/material';
import {get_local_storage, save_local_storage} from 'common';
import DropCountCard from 'components/card/DropCountCard';
import EndpointCard from 'components/card/EndpointCard';
import ErrorCard from 'components/card/ErrorCard';
import HACard from 'components/card/HACard';
import LBRuleCard from 'components/card/LBRuleCard';
import ReqCounterCard from 'components/card/ReqCounterCard';
import ServiceDistTrafficCard from 'components/card/ServiceDistTrafficCard';
import SystemLogCard from 'components/card/SystemLogCard';
import SystemUsageCard from 'components/card/SystemUsageCard';
import TrafficCard from 'components/card/TrafficCard';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useTrafficSeries} from 'hooks/query/metricsTimeSeriesHook';
import {t} from 'i18next';
import {useEffect, useState} from 'react';
import RGL, {Layout} from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {ITimeSeriesPoint} from 'types/global';
import {IProcessedTraffic} from 'types/metrics';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function DashboardPage() {
	const inst = useInstanceFromURL();

	const traffics: ITimeSeriesPoint<IProcessedTraffic>[] = useTrafficSeries(inst);

	const CARD_CONFIG = [
		{key: 'system-usage', component: <SystemUsageCard instance={inst} />},
		{key: 'system-log', component: <SystemLogCard />},
		{key: 'ha', component: <HACard instance={inst} />},
		{key: 'total-traffic', component: <TrafficCard title={t('Total Traffic Overview')} points={traffics} data_key="processed_bytes" />},
		{key: 'total-packet', component: <TrafficCard title={t('Total Packet Overview')} points={traffics} data_key="processed_packets" />},
		{key: 'tcp-traffic', component: <TrafficCard title={t('TCP Traffic Overview')} points={traffics} data_key="processed_tcp_bytes" />},
		{key: 'udp-traffic', component: <TrafficCard title={t('UDP Traffic Overview')} points={traffics} data_key="processed_udp_bytes" />},
		{key: 'sctp-traffic', component: <TrafficCard title={t('SCTP Traffic Overview')} points={traffics} data_key="processed_sctp_bytes" />},
		{key: 'ep-traffic', component: <EndpointCard instance={inst} />},
		{key: 'error', component: <ErrorCard instance={inst} />},
		{key: 'firewall-drop', component: <DropCountCard instance={inst} />},
		{key: 'lb-rules', component: <LBRuleCard instance={inst} />},
		{key: 'service-dist-traffic', component: <ServiceDistTrafficCard instance={inst} />},
		{key: 'req-counter', component: <ReqCounterCard instance={inst} />},
	];

	const DEFAULT_LAYOUT: Layout[] = [
		// System Overview (Top Row)
		{i: 'system-usage', x: 0, y: 0, w: 8, h: 2}, // Spans wider for detailed metrics
		{i: 'ha', x: 8, y: 0, w: 4, h: 1}, // High Availability status
		{i: 'system-log', x: 0, y: 2, w: 8, h: 1}, // System logs below usage

		// Traffic Summary (Right Column)
		{i: 'total-traffic', x: 8, y: 2, w: 4, h: 1}, // Traffic metrics
		{i: 'total-packet', x: 8, y: 3, w: 4, h: 1}, // Packet metrics

		// Protocol Traffic (Middle Row)
		{i: 'tcp-traffic', x: 0, y: 3, w: 4, h: 1}, // TCP traffic
		{i: 'udp-traffic', x: 4, y: 3, w: 4, h: 1}, // UDP traffic
		{i: 'sctp-traffic', x: 8, y: 4, w: 4, h: 1}, // SCTP traffic

		// Endpoint and Errors (Middle-Lower Row)
		{i: 'ep-traffic', x: 0, y: 4, w: 4, h: 1}, // Endpoint traffic
		{i: 'error', x: 4, y: 4, w: 4, h: 1}, // Error metrics
		{i: 'firewall-drop', x: 8, y: 5, w: 4, h: 1}, // Firewall drops

		// Rules and Distribution (Bottom Row)
		{i: 'lb-rules', x: 0, y: 5, w: 4, h: 1}, // Load balancer rules
		{i: 'service-dist-traffic', x: 4, y: 5, w: 4, h: 1}, // Service distribution
		{i: 'req-counter', x: 0, y: 6, w: 4, h: 1}, // Request counter
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
