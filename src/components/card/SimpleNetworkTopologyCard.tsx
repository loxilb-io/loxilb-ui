//---------------------------------------------------------
// Simple Network Topology Card - Following Project Patterns
//---------------------------------------------------------
import {
	Box,
	Typography,
	Chip,
	Stack,
	Switch,
	FormControlLabel,
	IconButton,
	Tooltip,
	useTheme,
	alpha,
	Slider,
	ToggleButton,
	ToggleButtonGroup
} from '@mui/material';
import {
	Refresh as RefreshIcon,
	Info as InfoIcon,
	AccountTree as TreeIcon,
	Timeline as SankeyIcon
} from '@mui/icons-material';
import {formatRate} from 'common';
import {useTopologyMetrics} from 'hooks/query/topologyHooks';
import {t} from 'i18next';
import {useMemo, useState} from 'react';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';

//---------------------------------------------------------
// Types
//---------------------------------------------------------
interface TopologyNode {
	id: string;
	label: string;
	type: 'loxilb' | 'service' | 'endpoint';
	value: number;
	percentage: number;
	status: 'healthy' | 'warning' | 'error';
	x: number;
	y: number;
	height: number;
}

interface TopologyFlow {
	source: string;
	target: string;
	value: number;
	percentage: number;
	width: number;
	path: string;
}

//---------------------------------------------------------
// Simple Sankey Components
//---------------------------------------------------------
function SankeyNode({node, showMetrics}: {node: TopologyNode, showMetrics: boolean}) {
	const theme = useTheme();
	
	const getColor = () => {
		switch (node.status) {
			case 'healthy': return theme.palette.success.main;
			case 'warning': return theme.palette.warning.main;
			case 'error': return theme.palette.error.main;
			default: return theme.palette.grey[400];
		}
	};

	const nodeWidth = node.type === 'loxilb' ? 70 : 50;

	return (
		<g transform={`translate(${node.x}, ${node.y})`}>
			<rect
				width={nodeWidth}
				height={node.height}
				fill={alpha(getColor(), 0.1)}
				stroke={getColor()}
				strokeWidth={node.type === 'loxilb' ? 3 : 2}
				rx={4}
			/>
			<text
				x={nodeWidth + 8}
				y={15}
				fontSize="14"
				fill={theme.palette.text.primary}
				fontWeight={node.type === 'loxilb' ? 'bold' : 'normal'}
			>
				{node.label}
			</text>
			{showMetrics && (
				<text
					x={nodeWidth + 8}
					y={30}
					fontSize="12"
					fill={theme.palette.text.secondary}
				>
					{formatRate(node.value, 'bps')}
				</text>
			)}
		</g>
	);
}

function SankeyFlow({flow}: {flow: TopologyFlow}) {
	const theme = useTheme();
	
	const getColor = () => {
		if (flow.percentage > 80) return theme.palette.error.main;
		if (flow.percentage > 50) return theme.palette.warning.main;
		return theme.palette.primary.main;
	};

	return (
		<path
			d={flow.path}
			fill="none"
			stroke={getColor()}
			strokeWidth={flow.width}
			strokeOpacity={0.6}
		/>
	);
}

//---------------------------------------------------------
// Tree View Components
//---------------------------------------------------------
function TreeNode({node, showMetrics}: {node: TopologyNode, showMetrics: boolean}) {
	const theme = useTheme();
	
	const getColor = () => {
		switch (node.status) {
			case 'healthy': return theme.palette.success.main;
			case 'warning': return theme.palette.warning.main;
			case 'error': return theme.palette.error.main;
			default: return theme.palette.grey[400];
		}
	};

	const nodeWidth = node.type === 'loxilb' ? 80 : 60;
	const nodeHeight = 40;

	return (
		<g transform={`translate(${node.x}, ${node.y})`}>
			<rect
				width={nodeWidth}
				height={nodeHeight}
				fill={alpha(getColor(), 0.1)}
				stroke={getColor()}
				strokeWidth={node.type === 'loxilb' ? 3 : 2}
				rx={6}
			/>
			<text
				x={nodeWidth / 2}
				y={18}
				fontSize="13"
				fill={theme.palette.text.primary}
				fontWeight={node.type === 'loxilb' ? 'bold' : 'normal'}
				textAnchor="middle"
			>
				{node.label}
			</text>
			{showMetrics && (
				<text
					x={nodeWidth / 2}
					y={33}
					fontSize="11"
					fill={theme.palette.text.secondary}
					textAnchor="middle"
				>
					{formatRate(node.value, 'bps')}
				</text>
			)}
		</g>
	);
}

function TreeConnection({from, to, theme}: {from: TopologyNode, to: TopologyNode, theme: any}) {
	const fromX = from.x + (from.type === 'loxilb' ? 80 : 60) / 2;
	const fromY = from.y + 40;
	const toX = to.x + (to.type === 'loxilb' ? 80 : 60) / 2;
	const toY = to.y;

	return (
		<line
			x1={fromX}
			y1={fromY}
			x2={toX}
			y2={toY}
			stroke={theme.palette.primary.main}
			strokeWidth={2}
			strokeOpacity={0.7}
		/>
	);
}

//---------------------------------------------------------
// Main Component
//---------------------------------------------------------
export default function SimpleNetworkTopologyCard(props: {instance: IInstance | null}) {
	const {instance} = props;
	const theme = useTheme();

	// Controls
	const [showMetrics, setShowMetrics] = useState(true);
	const [showInfo, setShowInfo] = useState(false);
	const [minThreshold, setMinThreshold] = useState(5);
	const [viewMode, setViewMode] = useState<'sankey' | 'tree'>('sankey');

	// Data
	const {
		serviceTraffic,
		endpointTraffic,
		distributionRatios,
		isLoading,
		aggregationInfo
	} = useTopologyMetrics(instance, '5m');

	// Process data with layout-specific positioning
	const {nodes, flows, stats} = useMemo(() => {

		if (isLoading) {
			return {nodes: [], flows: [], stats: null};
		}

		// If no real data, show mock data for demonstration
		// if (!serviceTraffic?.length || !endpointTraffic?.length) {
		// 	const mockNodes = [
		// 		{
		// 			id: 'loxilb',
		// 			label: 'LoxiLB',
		// 			type: 'loxilb' as const,
		// 			value: 100000000,
		// 			percentage: 100,
		// 			status: 'healthy' as const,
		// 			x: 150,
		// 			y: 60,
		// 			height: 60
		// 		},
		// 		{
		// 			id: 'service-tcp1',
		// 			label: 'TCP1',
		// 			type: 'service' as const,
		// 			value: 80000000,
		// 			percentage: 80,
		// 			status: 'healthy' as const,
		// 			x: 320,
		// 			y: 40,
		// 			height: 50
		// 		},
		// 		{
		// 			id: 'service-udp1',
		// 			label: 'UDP1',
		// 			type: 'service' as const,
		// 			value: 20000000,
		// 			percentage: 20,
		// 			status: 'healthy' as const,
		// 			x: 320,
		// 			y: 120,
		// 			height: 25
		// 		},
		// 		{
		// 			id: 'endpoint-192.168.1.10',
		// 			label: '192.168.1.10',
		// 			type: 'endpoint' as const,
		// 			value: 60000000,
		// 			percentage: 75,
		// 			status: 'healthy' as const,
		// 			x: 520,
		// 			y: 30,
		// 			height: 40
		// 		},
		// 		{
		// 			id: 'endpoint-192.168.1.11',
		// 			label: '192.168.1.11',
		// 			type: 'endpoint' as const,
		// 			value: 20000000,
		// 			percentage: 25,
		// 			status: 'warning' as const,
		// 			x: 520,
		// 			y: 90,
		// 			height: 20
		// 		},
		// 		{
		// 			id: 'endpoint-192.168.1.12',
		// 			label: '192.168.1.12',
		// 			type: 'endpoint' as const,
		// 			value: 20000000,
		// 			percentage: 100,
		// 			status: 'healthy' as const,
		// 			x: 520,
		// 			y: 130,
		// 			height: 20
		// 		}
		// 	];

		// 	const mockFlows = [
		// 		{
		// 			source: 'loxilb',
		// 			target: 'service-tcp1',
		// 			value: 80000000,
		// 			percentage: 80,
		// 			width: 15,
		// 			path: 'M 220 90 C 260 90 280 65 320 65'
		// 		},
		// 		{
		// 			source: 'loxilb',
		// 			target: 'service-udp1',
		// 			value: 20000000,
		// 			percentage: 20,
		// 			width: 8,
		// 			path: 'M 220 90 C 260 90 280 132 320 132'
		// 		},
		// 		{
		// 			source: 'service-tcp1',
		// 			target: 'endpoint-192.168.1.10',
		// 			value: 60000000,
		// 			percentage: 75,
		// 			width: 12,
		// 			path: 'M 370 65 C 420 65 480 50 520 50'
		// 		},
		// 		{
		// 			source: 'service-tcp1',
		// 			target: 'endpoint-192.168.1.11',
		// 			value: 20000000,
		// 			percentage: 25,
		// 			width: 6,
		// 			path: 'M 370 65 C 420 65 480 100 520 100'
		// 		},
		// 		{
		// 			source: 'service-udp1',
		// 			target: 'endpoint-192.168.1.12',
		// 			value: 20000000,
		// 			percentage: 100,
		// 			width: 8,
		// 			path: 'M 370 132 C 420 132 480 140 520 140'
		// 		}
		// 	];

		// 	const mockStats = {
		// 		totalNodes: mockNodes.length,
		// 		healthyNodes: mockNodes.filter(n => n.status === 'healthy').length,
		// 		totalThroughput: 100000000,
		// 		activeServices: 2
		// 	};

		// 	return {nodes: mockNodes, flows: mockFlows, stats: mockStats};
		// }

		// Data from topologyHooks is already converted to BPS, use directly

		const nodes: TopologyNode[] = [];
		const flows: TopologyFlow[] = [];

		// Calculate total traffic (already in BPS from hooks)
		const totalTraffic = serviceTraffic.reduce((sum: number, item: any) => sum + item.value, 0);

		// LoxiLB central node - position based on view mode
		const loxilbX = viewMode === 'sankey' ? 150 : 300;
		const loxilbY = viewMode === 'sankey' ? 60 : 15;
		nodes.push({
			id: 'loxilb',
			label: 'LoxiLB',
			type: 'loxilb',
			value: totalTraffic,
			percentage: 100,
			status: 'healthy',
			x: loxilbX,
			y: loxilbY,
			height: viewMode === 'sankey' ? 60 : 40
		});

		// Service nodes - Dynamic positioning based on view mode
		if (viewMode === 'sankey') {
			// Sankey layout - vertical stacking
			let serviceY = 30;
			const serviceSpacing = Math.max(60, 180 / Math.max(serviceTraffic.length, 1));
			serviceTraffic.forEach((service: any) => {
				const serviceId = `service-${service.labels.service}`;
				const serviceHeight = Math.max(40, Math.min(80, (service.value / totalTraffic) * 120));
				
				nodes.push({
					id: serviceId,
					label: service.labels.service.toUpperCase(),
					type: 'service',
					value: service.value,
					percentage: (service.value / totalTraffic) * 100,
					status: 'healthy',
					x: 320,
					y: serviceY,
					height: serviceHeight
				});

				// Flow from LoxiLB to service
				const flowY = serviceY + serviceHeight / 2;
				flows.push({
					source: 'loxilb',
					target: serviceId,
					value: service.value,
					percentage: 100,
					width: Math.max(3, (service.value / totalTraffic) * 20),
					path: `M 220 100 C 260 100 280 ${flowY} 320 ${flowY}`
				});

				serviceY += serviceHeight + serviceSpacing;
			});
		} else {
			// Tree layout - horizontal distribution
			const serviceCount = serviceTraffic.length;
			const serviceSpacing = serviceCount > 1 ? 300 / (serviceCount - 1) : 0;
			const startX = serviceCount === 1 ? 230 : 80;
			
			serviceTraffic.forEach((service: any, index: number) => {
				const serviceId = `service-${service.labels.service}`;
				const serviceX = serviceCount === 1 ? startX : startX + (index * serviceSpacing);
				
				nodes.push({
					id: serviceId,
					label: service.labels.service.toUpperCase(),
					type: 'service',
					value: service.value,
					percentage: (service.value / totalTraffic) * 100,
					status: 'healthy',
					x: serviceX,
					y: 70,
					height: 40
				});
			});
		}

		// Endpoint nodes - Dynamic positioning based on view mode
		if (viewMode === 'sankey') {
			// Sankey layout - vertical stacking
			let endpointY = 30;
			const endpointSpacing = Math.max(50, 180 / Math.max(endpointTraffic.length, 1));
			endpointTraffic.forEach((endpoint: any) => {
			const endpointId = `endpoint-${endpoint.labels.service}-${endpoint.labels.dip}`;
			const serviceTotal = serviceTraffic.find((s: any) => s.labels.service === endpoint.labels.service)?.value || 1;
			const endpointHeight = Math.max(30, Math.min(70, (endpoint.value / totalTraffic) * 100));
			const distribution = distributionRatios?.find(
				(d: any) => d.labels.service === endpoint.labels.service && d.labels.dip === endpoint.labels.dip
			);

			nodes.push({
				id: endpointId,
				label: endpoint.labels.dip,
				type: 'endpoint',
				value: endpoint.value,
				percentage: (endpoint.value / serviceTotal) * 100,
				status: 'healthy',
				x: 520,
				y: endpointY,
				height: endpointHeight
			});

			// Flow from service to endpoint - Use proper center points
			const serviceNode = nodes.find(n => n.id === `service-${endpoint.labels.service}`);
			if (serviceNode) {
				const serviceFlowY = serviceNode.y + serviceNode.height / 2;
				const endpointFlowY = endpointY + endpointHeight / 2;
				flows.push({
					source: `service-${endpoint.labels.service}`,
					target: endpointId,
					value: endpoint.value,
					percentage: (distribution?.value || 0) * 100,
					width: Math.max(2, (endpoint.value / serviceTotal) * 18),
					path: `M 370 ${serviceFlowY} C 420 ${serviceFlowY} 480 ${endpointFlowY} 520 ${endpointFlowY}`
				});
			}

				endpointY += endpointHeight + endpointSpacing;
			});
		} else {
			// Tree layout - endpoints under their services
			const endpointsByService = new Map();
			endpointTraffic.forEach((endpoint: any) => {
				const service = endpoint.labels.service;
				if (!endpointsByService.has(service)) {
					endpointsByService.set(service, []);
				}
				endpointsByService.get(service).push(endpoint);
			});

			endpointsByService.forEach((endpoints, serviceName) => {
				const serviceNode = nodes.find(n => n.id === `service-${serviceName}`);
				if (serviceNode) {
					const endpointSpacing = endpoints.length > 1 ? 80 / (endpoints.length - 1) : 0;
					const startX = endpoints.length === 1 ? serviceNode.x : serviceNode.x - 40;
					
					endpoints.forEach((endpoint: any, index: number) => {
						const endpointId = `endpoint-${endpoint.labels.service}-${endpoint.labels.dip}`;
						const endpointX = endpoints.length === 1 ? startX : startX + (index * endpointSpacing);
						
						nodes.push({
							id: endpointId,
							label: endpoint.labels.dip,
							type: 'endpoint',
							value: endpoint.value,
							percentage: (endpoint.value / serviceNode.value) * 100,
							status: 'healthy',
							x: endpointX,
							y: 130,
							height: 40
						});
					});
				}
			});
		}

		const stats = {
			totalNodes: nodes.length,
			healthyNodes: nodes.filter(n => n.status === 'healthy').length,
			totalThroughput: totalTraffic,
			activeServices: serviceTraffic.length
		};

		return {nodes, flows, stats};
	}, [serviceTraffic, endpointTraffic, distributionRatios, isLoading, viewMode]);

	// Filter flows by threshold
	const filteredFlows = flows.filter(flow => flow.percentage >= minThreshold);

	if (isLoading) {
		return (
			<CardBase title={t('Network Topology')}>
				<Box display="flex" justifyContent="center" alignItems="center" height={200}>
					<Typography variant="body2" color="textSecondary">
						{t('Loading topology...')}
					</Typography>
				</Box>
			</CardBase>
		);
	}

	return (
		<CardBase title={t('Network Topology')}>
			<Stack spacing={2}>
				{/* Controls */}
				<Box display="flex" justifyContent="space-between" alignItems="center">
					<Stack direction="row" spacing={2} alignItems="center">
						<ToggleButtonGroup
							value={viewMode}
							exclusive
							onChange={(_, newViewMode) => newViewMode && setViewMode(newViewMode)}
							size="small"
						>
							<ToggleButton value="sankey" aria-label="sankey view">
								<SankeyIcon fontSize="small" />
								<Typography variant="caption" ml={0.5}>Sankey</Typography>
							</ToggleButton>
							<ToggleButton value="tree" aria-label="tree view">
								<TreeIcon fontSize="small" />
								<Typography variant="caption" ml={0.5}>Tree</Typography>
							</ToggleButton>
						</ToggleButtonGroup>
						<FormControlLabel
							control={
								<Switch 
									size="small" 
									checked={showMetrics} 
									onChange={(e) => setShowMetrics(e.target.checked)} 
								/>
							}
							label={<Typography variant="caption">{t('Metrics')}</Typography>}
						/>
						<Box minWidth={120}>
							<Typography variant="caption" color="textSecondary">
								{t('Min Flow')}: {minThreshold}%
							</Typography>
							<Slider
								value={minThreshold}
								onChange={(_, value) => setMinThreshold(value as number)}
								min={0}
								max={20}
								size="small"
							/>
						</Box>
					</Stack>
					<Stack direction="row" spacing={1}>
						<Tooltip title={t('Info')}>
							<IconButton size="small" onClick={() => setShowInfo(!showInfo)}>
								<InfoIcon fontSize="small" />
							</IconButton>
						</Tooltip>
						<Tooltip title={t('Refresh')}>
							<IconButton size="small">
								<RefreshIcon fontSize="small" />
							</IconButton>
						</Tooltip>
					</Stack>
				</Box>

				{/* Stats */}
				{stats && (
					<Box display="flex" gap={2}>
						<Chip 
							label={`${stats.totalNodes} ${t('Nodes')}`} 
							size="small" 
							color="primary" 
							variant="outlined" 
						/>
						<Chip 
							label={`${stats.healthyNodes}/${stats.totalNodes} ${t('Healthy')}`} 
							size="small" 
							color="success" 
							variant="outlined" 
						/>
						<Chip 
							label={formatRate(stats.totalThroughput, 'bps')} 
							size="small" 
							color="info" 
							variant="outlined" 
						/>
					</Box>
				)}

				{/* Info Panel */}
				{showInfo && aggregationInfo && (
					<Box 
						p={1.5} 
						bgcolor={alpha(theme.palette.primary.main, 0.05)} 
						borderRadius={1}
						border={`1px solid ${alpha(theme.palette.primary.main, 0.2)}`}
					>
						<Typography variant="caption" fontWeight="bold" color="primary.main">
							{t('Data Processing Info')}
						</Typography>
						<Stack spacing={0.5} mt={0.5}>
							<Typography variant="caption" color="textSecondary">
								• Traffic: Rate calculation from cumulative bytes
							</Typography>
							<Typography variant="caption" color="textSecondary">
								• Distribution: Latest ratios (5m window)
							</Typography>
							<Typography variant="caption" color="textSecondary">
								• Refresh: Every 5 seconds
							</Typography>
						</Stack>
					</Box>
				)}

				{/* Topology Visualization */}
				<Box display="flex" justifyContent="center">
					<svg 
						width="700" 
						height={viewMode === 'tree' ? "280" : "250"}
						style={{border: `1px solid ${theme.palette.divider}`, borderRadius: 4}}
					>
						{viewMode === 'sankey' ? (
							<>
								{/* Sankey Flows (background) */}
								{filteredFlows.map((flow, index) => (
									<SankeyFlow key={`flow-${index}`} flow={flow} />
								))}
								
								{/* Sankey Nodes (foreground) */}
								{nodes.map(node => (
									<SankeyNode 
										key={node.id} 
										node={node} 
										showMetrics={showMetrics}
									/>
								))}
							</>
						) : (
							<>
								{/* Tree Connections (background) */}
								{nodes.filter(n => n.type === 'loxilb').map(loxilbNode => 
									nodes.filter(n => n.type === 'service').map(serviceNode => (
										<TreeConnection 
											key={`${loxilbNode.id}-${serviceNode.id}`}
											from={loxilbNode} 
											to={serviceNode} 
											theme={theme} 
										/>
									))
								)}
								{nodes.filter(n => n.type === 'service').map(serviceNode => 
									nodes.filter(n => n.type === 'endpoint' && n.id.includes(serviceNode.id.split('-')[1])).map(endpointNode => (
										<TreeConnection 
											key={`${serviceNode.id}-${endpointNode.id}`}
											from={serviceNode} 
											to={endpointNode} 
											theme={theme} 
										/>
									))
								)}
								
								{/* Tree Nodes (foreground) */}
								{nodes.map(node => (
									<TreeNode 
										key={node.id} 
										node={node} 
										showMetrics={showMetrics}
									/>
								))}
							</>
						)}
					</svg>
				</Box>

				{/* Legend */}
				<Stack direction="row" spacing={2} justifyContent="center">
					<Stack direction="row" alignItems="center" spacing={0.5}>
						<Box width={10} height={10} bgcolor="success.main" borderRadius="50%" />
						<Typography variant="caption">{t('Healthy')}</Typography>
					</Stack>
					<Stack direction="row" alignItems="center" spacing={0.5}>
						<Box width={15} height={3} bgcolor="primary.main" />
						<Typography variant="caption">
							{viewMode === 'sankey' ? t('Traffic Flow') : t('Connection')}
						</Typography>
					</Stack>
				</Stack>
			</Stack>
		</CardBase>
	);
}