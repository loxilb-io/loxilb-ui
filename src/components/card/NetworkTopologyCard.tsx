//---------------------------------------------------------
// Network Topology Visualization Card
//---------------------------------------------------------
import {
	Box,
	Typography,
	Grid,
	Chip,
	Stack,
	Switch,
	FormControlLabel,
	Tooltip,
	IconButton,
	useTheme,
	alpha,
	Paper
} from '@mui/material';
import {
	Hub as HubIcon,
	Router as RouterIcon,
	Computer as ComputerIcon,
	CloudQueue as CloudIcon,
	Refresh as RefreshIcon,
	ZoomIn as ZoomInIcon,
	ZoomOut as ZoomOutIcon
} from '@mui/icons-material';
import {formatRate} from 'common';
import {useTopologyMetrics} from 'hooks/query/topologyHooks';
import {t} from 'i18next';
import {useMemo, useState, useCallback} from 'react';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';

//---------------------------------------------------------
// Network Node Types and Interfaces
//---------------------------------------------------------
interface NetworkNode {
	id: string;
	label: string;
	type: 'loxilb' | 'service' | 'endpoint';
	status: 'healthy' | 'warning' | 'error';
	x: number;
	y: number;
	value: number; // Traffic rate in bps
	percentage: number;
	height?: number;
	connections?: string[];
}

interface NetworkLink {
	id: string;
	source: string;
	target: string;
	status: 'active' | 'inactive' | 'error';
	bandwidth: number;
	utilization: number;
}

//---------------------------------------------------------
// Real Data Processing (from API)
//---------------------------------------------------------
function processNetworkTopologyData(
	serviceTraffic: any[], 
	endpointTraffic: any[], 
	distributionRatios: any[]
): {nodes: NetworkNode[], links: NetworkLink[]} {
	const nodes: NetworkNode[] = [];
	const links: NetworkLink[] = [];

	if (!serviceTraffic?.length) {
		return {nodes, links};
	}

	// Calculate total traffic for percentages
	const totalTraffic = serviceTraffic.reduce((sum: number, item: any) => sum + item.value, 0);

	// LoxiLB central node
	nodes.push({
		id: 'loxilb',
		label: 'LoxiLB',
		type: 'loxilb',
		status: 'healthy',
		x: 300,
		y: 150,
		value: totalTraffic,
		percentage: 100,
		height: 60
	});

	// Service nodes positioned to the left
	serviceTraffic.forEach((service: any, index: number) => {
		const serviceId = `service-${service.labels.service}`;
		nodes.push({
			id: serviceId,
			label: service.labels.service.toUpperCase(),
			type: 'service',
			status: 'healthy',
			x: 150,
			y: 80 + (index * 80),
			value: service.value,
			percentage: (service.value / totalTraffic) * 100,
			height: 40
		});

		// Link from LoxiLB to service
		links.push({
			id: `link-loxilb-${serviceId}`,
			source: 'loxilb',
			target: serviceId,
			status: 'active',
			bandwidth: 1000,
			utilization: Math.min(100, (service.value / totalTraffic) * 100)
		});
	});

	// Endpoint nodes positioned to the right
	endpointTraffic.forEach((endpoint: any, index: number) => {
		const endpointId = `endpoint-${endpoint.labels.service}-${endpoint.labels.dip}`;
		const serviceId = `service-${endpoint.labels.service}`;
		
		nodes.push({
			id: endpointId,
			label: endpoint.labels.dip,
			type: 'endpoint',
			status: 'healthy',
			x: 450,
			y: 80 + (index * 60),
			value: endpoint.value,
			percentage: (endpoint.value / totalTraffic) * 100,
			height: 35
		});

		// Link from service to endpoint
		const serviceTotal = serviceTraffic.find((s: any) => s.labels.service === endpoint.labels.service)?.value || 1;
		links.push({
			id: `link-${serviceId}-${endpointId}`,
			source: serviceId,
			target: endpointId,
			status: 'active',
			bandwidth: 1000,
			utilization: Math.min(100, (endpoint.value / serviceTotal) * 100)
		});
	});

	return {nodes, links};
}

//---------------------------------------------------------
// Node Component
//---------------------------------------------------------
interface NodeComponentProps {
	node: NetworkNode;
	showMetrics: boolean;
	onNodeClick: (node: NetworkNode) => void;
}

function NodeComponent({node, showMetrics, onNodeClick}: NodeComponentProps) {
	const theme = useTheme();

	const getNodeIcon = () => {
		switch (node.type) {
			case 'loxilb': return <HubIcon />;
			case 'service': return <ComputerIcon />;
			case 'endpoint': return <RouterIcon />;
			default: return <HubIcon />;
		}
	};

	const getNodeColor = () => {
		switch (node.status) {
			case 'healthy': return theme.palette.success.main;
			case 'warning': return theme.palette.warning.main;
			case 'error': return theme.palette.error.main;
			default: return theme.palette.grey[400];
		}
	};

	const nodeSize = node.type === 'loxilb' ? 60 : 45;

	return (
		<g
			style={{ cursor: 'pointer' }}
			onClick={() => onNodeClick(node)}
			transform={`translate(${node.x - nodeSize/2}, ${node.y - nodeSize/2})`}
		>
			{/* Node Circle */}
			<circle
				cx={nodeSize/2}
				cy={nodeSize/2}
				r={nodeSize/2}
				fill={alpha(getNodeColor(), 0.1)}
				stroke={getNodeColor()}
				strokeWidth={node.type === 'loxilb' ? 3 : 2}
			/>
			
			{/* Node Icon */}
			<foreignObject
				x={(nodeSize/2) - 12}
				y={(nodeSize/2) - 12}
				width="24"
				height="24"
			>
				<div style={{ color: getNodeColor(), display: 'flex', justifyContent: 'center' }}>
					{getNodeIcon()}
				</div>
			</foreignObject>

			{/* Node Label */}
			<text
				x={nodeSize/2}
				y={nodeSize + 15}
				textAnchor="middle"
				fontSize="12"
				fill={theme.palette.text.primary}
				fontWeight={node.type === 'loxilb' ? 'bold' : 'normal'}
			>
				{node.label}
			</text>

			{/* Metrics Display */}
			{showMetrics && (
				<text
					x={nodeSize/2}
					y={nodeSize + 30}
					textAnchor="middle"
					fontSize="10"
					fill={theme.palette.text.secondary}
				>
					{formatRate(node.value, 'bps')}
				</text>
			)}
		</g>
	);
}

//---------------------------------------------------------
// Link Component
//---------------------------------------------------------
interface LinkComponentProps {
	link: NetworkLink;
	nodes: NetworkNode[];
	showBandwidth: boolean;
}

function LinkComponent({link, nodes, showBandwidth}: LinkComponentProps) {
	const theme = useTheme();
	const sourceNode = nodes.find(n => n.id === link.source);
	const targetNode = nodes.find(n => n.id === link.target);

	if (!sourceNode || !targetNode) return null;

	const getLinkColor = () => {
		if (link.utilization > 90) return theme.palette.error.main;
		if (link.utilization > 70) return theme.palette.warning.main;
		return theme.palette.success.main;
	};

	const strokeWidth = Math.max(2, link.utilization / 25);

	return (
		<g>
			<line
				x1={sourceNode.x}
				y1={sourceNode.y}
				x2={targetNode.x}
				y2={targetNode.y}
				stroke={getLinkColor()}
				strokeWidth={strokeWidth}
				strokeOpacity={0.7}
				strokeDasharray={link.status === 'inactive' ? '5,5' : 'none'}
			/>
			
			{/* Bandwidth Label */}
			{showBandwidth && (
				<text
					x={(sourceNode.x + targetNode.x) / 2}
					y={(sourceNode.y + targetNode.y) / 2 - 5}
					textAnchor="middle"
					fontSize="9"
					fill={theme.palette.text.secondary}
					style={{ pointerEvents: 'none' }}
				>
					{link.utilization}%
				</text>
			)}
		</g>
	);
}

//---------------------------------------------------------
// Main Network Topology Card
//---------------------------------------------------------
export default function NetworkTopologyCard(props: {instance: IInstance | null}) {
	const {instance} = props;
	const theme = useTheme();
	
	const [showMetrics, setShowMetrics] = useState(true);
	const [showBandwidth, setShowBandwidth] = useState(true);
	const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);

	// Fetch real network topology data from API
	const {
		serviceTraffic,
		endpointTraffic,
		distributionRatios,
		isLoading,
		refetch
	} = useTopologyMetrics(instance, '5m');

	// Process real data into network topology
	const networkData = useMemo(() => 
		processNetworkTopologyData(serviceTraffic, endpointTraffic, distributionRatios),
		[serviceTraffic, endpointTraffic, distributionRatios]
	);

	const handleNodeClick = useCallback((node: NetworkNode) => {
		setSelectedNode(node);
	}, []);

	// Statistics
	const totalNodes = networkData.nodes.length;
	const healthyNodes = networkData.nodes.filter(n => n.status === 'healthy').length;
	const totalThroughput = networkData.nodes.reduce((sum, n) => sum + (n.value || 0), 0);

	// Add loading state
	if (isLoading) {
		return (
			<CardBase title={t('Network Topology')}>
				<Box display="flex" justifyContent="center" alignItems="center" height={300}>
					<Typography variant="body2" color="textSecondary">
						{t('Loading topology...')}
					</Typography>
				</Box>
			</CardBase>
		);
	}

	return (
		<CardBase title={t('Network Topology')}>
			<Box height="100%" display="flex" flexDirection="column">
				{/* Controls */}
				<Box mb={2}>
					<Grid container spacing={2} alignItems="center">
						<Grid item xs={6}>
							<Stack direction="row" spacing={1}>
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
								<FormControlLabel
									control={
										<Switch 
											size="small" 
											checked={showBandwidth} 
											onChange={(e) => setShowBandwidth(e.target.checked)} 
										/>
									}
									label={<Typography variant="caption">{t('Bandwidth')}</Typography>}
								/>
							</Stack>
						</Grid>
						<Grid item xs={6}>
							<Stack direction="row" spacing={1} justifyContent="flex-end">
								<Tooltip title={t('Refresh')}>
									<IconButton size="small" onClick={() => refetch()}>
										<RefreshIcon />
									</IconButton>
								</Tooltip>
								<Tooltip title={t('Zoom In')}>
									<IconButton size="small">
										<ZoomInIcon />
									</IconButton>
								</Tooltip>
								<Tooltip title={t('Zoom Out')}>
									<IconButton size="small">
										<ZoomOutIcon />
									</IconButton>
								</Tooltip>
							</Stack>
						</Grid>
					</Grid>
				</Box>

				{/* Network Stats */}
				<Grid container spacing={2} mb={2}>
					<Grid item xs={4}>
						<Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
							<Typography variant="h6" color="primary.main">{totalNodes}</Typography>
							<Typography variant="caption" color="text.secondary">{t('Nodes')}</Typography>
						</Paper>
					</Grid>
					<Grid item xs={4}>
						<Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
							<Typography variant="h6" color="success.main">{healthyNodes}/{totalNodes}</Typography>
							<Typography variant="caption" color="text.secondary">{t('Healthy')}</Typography>
						</Paper>
					</Grid>
					<Grid item xs={4}>
						<Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
							<Typography variant="h6" color="info.main">{formatRate(totalThroughput, 'bps')}</Typography>
							<Typography variant="caption" color="text.secondary">{t('Total')}</Typography>
						</Paper>
					</Grid>
				</Grid>

				{/* Network Visualization */}
				<Box flexGrow={1} display="flex" justifyContent="center" alignItems="center">
					<svg width="600" height="300" style={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 4 }}>
						{/* Links */}
						{networkData.links.map(link => (
							<LinkComponent
								key={link.id}
								link={link}
								nodes={networkData.nodes}
								showBandwidth={showBandwidth}
							/>
						))}
						
						{/* Nodes */}
						{networkData.nodes.map(node => (
							<NodeComponent
								key={node.id}
								node={node}
								showMetrics={showMetrics}
								onNodeClick={handleNodeClick}
							/>
						))}
					</svg>
				</Box>

				{/* Selected Node Info */}
				{selectedNode && (
					<Box mt={2}>
						<Paper variant="outlined" sx={{ p: 2 }}>
							<Grid container spacing={2}>
								<Grid item xs={6}>
									<Typography variant="subtitle2" color="primary.main">
										{selectedNode.label}
									</Typography>
									<Chip 
										label={selectedNode.type.toUpperCase()} 
										size="small" 
										color="primary" 
										variant="outlined" 
									/>
									<Chip 
										label={selectedNode.status.toUpperCase()} 
										size="small" 
										color={
											selectedNode.status === 'healthy' ? 'success' : 
											selectedNode.status === 'warning' ? 'warning' : 'error'
										}
										sx={{ ml: 1 }}
									/>
								</Grid>
								<Grid item xs={6}>
									<Typography variant="caption" color="text.secondary">
										{t('Traffic Rate')}: {formatRate(selectedNode.value, 'bps')}<br/>
										{t('Percentage')}: {selectedNode.percentage.toFixed(1)}%<br/>
										{t('Type')}: {selectedNode.type.toUpperCase()}
									</Typography>
								</Grid>
							</Grid>
						</Paper>
					</Box>
				)}

				{/* Legend */}
				<Box mt={2}>
					<Typography variant="caption" color="text.secondary" display="block" mb={1}>
						{t('Legend')}:
					</Typography>
					<Stack direction="row" spacing={2} flexWrap="wrap">
						<Stack direction="row" alignItems="center" spacing={0.5}>
							<Box width={12} height={12} bgcolor="success.main" borderRadius="50%" />
							<Typography variant="caption">{t('Healthy')}</Typography>
						</Stack>
						<Stack direction="row" alignItems="center" spacing={0.5}>
							<Box width={12} height={12} bgcolor="warning.main" borderRadius="50%" />
							<Typography variant="caption">{t('Warning')}</Typography>
						</Stack>
						<Stack direction="row" alignItems="center" spacing={0.5}>
							<Box width={12} height={12} bgcolor="error.main" borderRadius="50%" />
							<Typography variant="caption">{t('Error')}</Typography>
						</Stack>
					</Stack>
				</Box>
			</Box>
		</CardBase>
	);
}