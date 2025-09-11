//---------------------------------------------------------
// Simple Network Topology Card - Dynamic Layout System
// Automatically adjusts dimensions and positioning based on node count
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
	const labelFontSize = node.type === 'loxilb' ? '14' : '12';
	const metricsFontSize = node.type === 'loxilb' ? '11' : '10';

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
				y={Math.min(18, node.height / 2 + 2)}
				fontSize={labelFontSize}
				fill={theme.palette.text.primary}
				fontWeight={node.type === 'loxilb' ? 'bold' : 'normal'}
			>
				{node.label.length > 12 ? node.label.substring(0, 10) + '...' : node.label}
			</text>
			{showMetrics && node.height > 30 && (
				<text
					x={nodeWidth + 8}
					y={Math.min(32, node.height / 2 + 16)}
					fontSize={metricsFontSize}
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

	const nodeWidth = node.type === 'loxilb' ? 100 : node.type === 'service' ? 100 : 100;
	const nodeHeight = node.height;
	const labelFontSize = node.type === 'loxilb' ? '14' : '12';
	const metricsFontSize = node.type === 'loxilb' ? '11' : '10';

	// Better label truncation for tree view
	const maxLabelLength = node.type === 'endpoint' ? 12 : 10;
	const displayLabel = node.label.length > maxLabelLength ? 
		node.label.substring(0, maxLabelLength - 3) + '...' : node.label;

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
				y={nodeHeight / 2 + 2}
				fontSize={labelFontSize}
				fill={theme.palette.text.primary}
				fontWeight={node.type === 'loxilb' ? 'bold' : 'normal'}
				textAnchor="middle"
			>
				{displayLabel}
			</text>
			{showMetrics && nodeHeight > 30 && (
				<text
					x={nodeWidth / 2}
					y={nodeHeight / 2 + 18}
					fontSize={metricsFontSize}
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
	const nodeWidth = 100; // All nodes are now 100px wide in tree view
	const fromX = from.x + nodeWidth / 2;
	const fromY = from.y + from.height;
	const toX = to.x + nodeWidth / 2;
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

	// Dynamic layout calculation
	const {nodes, flows, stats, svgDimensions} = useMemo(() => {

		if (isLoading) {
			return {nodes: [], flows: [], stats: null, svgDimensions: {width: 700, height: 250}};
		}

		// Data from topologyHooks is already converted to BPS, use directly
		const nodes: TopologyNode[] = [];
		const flows: TopologyFlow[] = [];

		// Calculate total traffic (already in BPS from hooks)
		const totalTraffic = serviceTraffic.reduce((sum: number, item: any) => sum + item.value, 0);

		// Dynamic layout calculations
		const serviceCount = serviceTraffic.length;
		const endpointCount = endpointTraffic.length;

		// Calculate optimal dimensions and margins
		const baseMargin = 40;
		const nodeSpacing = 120;
		
		// Calculate max label length for both modes
		const maxLabelLength = Math.max(
			...serviceTraffic.map((s: any) => s.labels.service.length),
			...endpointTraffic.map((e: any) => e.labels.dip.length),
			6
		);
		
		// Define balancedSpacing for Sankey layout
		const balancedSpacing = 130;
		
		let svgWidth: number;
		let svgHeight: number;
		
		if (viewMode === 'sankey') {
			// Sankey layout - balanced spacing for better readability
			const labelSpace = Math.max(80, maxLabelLength * 6);
			const nodeWidth = 70;
			const balancedSpacing = 130; // Increased spacing for better readability
			
			// Balanced width calculation for optimal readability
			const totalNodeWidth = nodeWidth * 3; // LoxiLB + Service + Endpoint
			const totalLabelSpace = labelSpace * 2; // Only service and endpoint labels extend
			const totalSpacing = balancedSpacing * 2; // Between columns
			svgWidth = Math.max(700, baseMargin * 2 + totalNodeWidth + totalLabelSpace + totalSpacing);
			
			// Height similar to Tree view proportions
			const maxNodesInColumn = Math.max(serviceCount, endpointCount, 1);
			svgHeight = Math.max(320, baseMargin * 2 + maxNodesInColumn * 60 + (maxNodesInColumn - 1) * 25);
		} else {
			// Tree layout - hierarchical structure with proper spacing
			let maxEndpointsPerService = 1;
			if (endpointTraffic.length > 0) {
				const endpointCountByService: {[key: string]: number} = {};
				endpointTraffic.forEach((endpoint: any) => {
					const service = endpoint.labels.service;
					endpointCountByService[service] = (endpointCountByService[service] || 0) + 1;
				});
				const serviceCounts = Object.values(endpointCountByService);
				maxEndpointsPerService = serviceCounts.length > 0 ? Math.max(...serviceCounts) : 1;
			}
			
			// Tree layout dimensions with generous spacing
			const nodeWidth = 100;
			const horizontalSpacing = 160;
			const verticalSpacing = 80;
			
			// Width: accommodate services + endpoints spread horizontally
			const totalWidth = Math.max(serviceCount, maxEndpointsPerService * serviceCount) * nodeWidth + 
							   (Math.max(serviceCount, maxEndpointsPerService * serviceCount) + 1) * horizontalSpacing;
			svgWidth = Math.max(700, baseMargin * 2 + totalWidth);
			
			// Height: 3 levels (LoxiLB → Services → Endpoints) with generous spacing
			svgHeight = Math.max(320, baseMargin * 2 + 40 + verticalSpacing + 40 + verticalSpacing + 40);
		}

		// LoxiLB central node - better centered positioning
		const loxilbX = viewMode === 'sankey' ? baseMargin + 20 : svgWidth / 2 - 40;
		const loxilbY = viewMode === 'sankey' ? svgHeight / 2 - 30 : baseMargin;
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

		// Service nodes - Optimized positioning based on view mode
		if (viewMode === 'sankey') {
			// Sankey layout - services in middle column, evenly distributed
			const availableHeight = svgHeight - baseMargin * 2;
			const serviceSpacing = serviceCount > 1 ? availableHeight / serviceCount : availableHeight;
			const labelSpace = Math.max(80, maxLabelLength * 6);
			const serviceX = baseMargin + 20 + 70 + balancedSpacing;
			
			serviceTraffic.forEach((service: any, index: number) => {
				const serviceId = `service-${service.labels.service}`;
				const serviceHeight = Math.max(40, Math.min(80, (service.value / totalTraffic) * 120));
				const serviceY = baseMargin + index * serviceSpacing + (serviceSpacing - serviceHeight) / 2;
				
				nodes.push({
					id: serviceId,
					label: service.labels.service.toUpperCase(),
					type: 'service',
					value: service.value,
					percentage: (service.value / totalTraffic) * 100,
					status: 'healthy',
					x: serviceX,
					y: serviceY,
					height: serviceHeight
				});

				// Flow from LoxiLB to service
				const flowY = serviceY + serviceHeight / 2;
				const loxilbCenterY = loxilbY + 30;
				flows.push({
					source: 'loxilb',
					target: serviceId,
					value: service.value,
					percentage: 100,
					width: Math.max(4, (service.value / totalTraffic) * 20),
					path: `M ${loxilbX + 70} ${loxilbCenterY} C ${loxilbX + balancedSpacing/2} ${loxilbCenterY} ${serviceX - balancedSpacing/2} ${flowY} ${serviceX} ${flowY}`
				});
			});
		} else {
			// Tree layout - services spread horizontally with proper spacing
			const availableWidth = svgWidth - baseMargin * 2;
			const serviceSpacing = serviceCount > 1 ? availableWidth / (serviceCount + 1) : availableWidth / 2;
			const serviceY = baseMargin + 40 + 80; // LoxiLB height + vertical spacing
			
			serviceTraffic.forEach((service: any, index: number) => {
				const serviceId = `service-${service.labels.service}`;
				const serviceX = baseMargin + serviceSpacing * (index + 1) - 50; // Center the 100px wide node
				
				nodes.push({
					id: serviceId,
					label: service.labels.service.toUpperCase(),
					type: 'service',
					value: service.value,
					percentage: (service.value / totalTraffic) * 100,
					status: 'healthy',
					x: serviceX,
					y: serviceY,
					height: 40
				});
			});
		}

		// Group endpoints by service for better layout
		const endpointsByService = new Map();
		endpointTraffic.forEach((endpoint: any) => {
			const service = endpoint.labels.service;
			if (!endpointsByService.has(service)) {
				endpointsByService.set(service, []);
			}
			endpointsByService.get(service).push(endpoint);
		});

		// Endpoint nodes - Optimized positioning based on view mode
		if (viewMode === 'sankey') {
			// Sankey layout - endpoints in right column, evenly distributed
			const availableHeight = svgHeight - baseMargin * 2;
			const endpointSpacing = endpointCount > 1 ? availableHeight / endpointCount : availableHeight;
			const labelSpace = Math.max(80, maxLabelLength * 6);
			const endpointX = baseMargin + 20 + 70 + balancedSpacing + 50 + labelSpace + balancedSpacing;
			let currentEndpointIndex = 0;
			
			endpointsByService.forEach((endpoints) => {
				endpoints.forEach((endpoint: any) => {
					const endpointId = `endpoint-${endpoint.labels.service}-${endpoint.labels.dip}`;
					const serviceTotal = serviceTraffic.find((s: any) => s.labels.service === endpoint.labels.service)?.value || 1;
					const endpointHeight = Math.max(30, Math.min(60, (endpoint.value / totalTraffic) * 100));
					const endpointY = baseMargin + currentEndpointIndex * endpointSpacing + (endpointSpacing - endpointHeight) / 2;
					
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
						x: endpointX,
						y: endpointY,
						height: endpointHeight
					});

					// Flow from service to endpoint
					const serviceNode = nodes.find(n => n.id === `service-${endpoint.labels.service}`);
					if (serviceNode) {
						const serviceFlowY = serviceNode.y + serviceNode.height / 2;
						const endpointFlowY = endpointY + endpointHeight / 2;
						flows.push({
							source: `service-${endpoint.labels.service}`,
							target: endpointId,
							value: endpoint.value,
							percentage: (distribution?.value || 0) * 100,
							width: Math.max(3, (endpoint.value / serviceTotal) * 15),
							path: `M ${serviceNode.x + 50} ${serviceFlowY} C ${serviceNode.x + balancedSpacing/2} ${serviceFlowY} ${endpointX - balancedSpacing/2} ${endpointFlowY} ${endpointX} ${endpointFlowY}`
						});
					}

					currentEndpointIndex++;
				});
			});
		} else {
			// Tree layout - endpoints positioned under their respective services with proper spacing
			const endpointY = baseMargin + 40 + 80 + 40 + 80; // LoxiLB + spacing + services + spacing
			
			endpointsByService.forEach((endpoints, serviceName) => {
				const serviceNode = nodes.find(n => n.id === `service-${serviceName}`);
				if (serviceNode) {
					// Calculate spacing for endpoints under this service
					const serviceWidth = 100;
					const endpointSpacing = 120;
					const totalEndpointWidth = endpoints.length * serviceWidth + (endpoints.length - 1) * endpointSpacing;
					const startX = serviceNode.x + serviceWidth/2 - totalEndpointWidth/2;
					
					endpoints.forEach((endpoint: any, index: number) => {
						const endpointId = `endpoint-${endpoint.labels.service}-${endpoint.labels.dip}`;
						const endpointX = endpoints.length === 1 
							? serviceNode.x + serviceWidth/2 - serviceWidth/2 // Center under service
							: startX + index * (serviceWidth + endpointSpacing);
						
						nodes.push({
							id: endpointId,
							label: endpoint.labels.dip,
							type: 'endpoint',
							value: endpoint.value,
							percentage: (endpoint.value / serviceNode.value) * 100,
							status: 'healthy',
							x: endpointX,
							y: endpointY,
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

		return {
			nodes, 
			flows, 
			stats, 
			svgDimensions: {width: svgWidth, height: svgHeight}
		};
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
				<Box 
					sx={{
						width: '100%',
						overflowX: 'auto',
						display: 'flex',
						justifyContent: 'center'
					}}
				>
					<svg 
						width="100%"
						height={svgDimensions.height}
						viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
						style={{
							border: `1px solid ${theme.palette.divider}`, 
							borderRadius: 4,
							maxWidth: svgDimensions.width,
							backgroundColor: alpha(theme.palette.background.paper, 0.02)
						}}
						preserveAspectRatio="xMidYMid meet"
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