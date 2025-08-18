//---------------------------------------------------------
// Performance Ranking Analytics Card
//---------------------------------------------------------
import {
	Box,
	Typography,
	Grid,
	Chip,
	Stack,
	Avatar,
	LinearProgress,
	Tooltip,
	IconButton,
	useTheme,
	alpha,
	Paper,
	Card,
	CardContent,
	Select,
	MenuItem,
	FormControl,
	InputLabel,
	List,
	ListItem,
	ListItemAvatar,
	ListItemText,
	Divider
} from '@mui/material';
import {
	EmojiEvents as TrophyIcon,
	TrendingUp as TrendingUpIcon,
	TrendingDown as TrendingDownIcon,
	Timeline as TimelineIcon,
	Refresh as RefreshIcon,
	Speed as SpeedIcon,
	Memory as MemoryIcon,
	Storage as StorageIcon,
	NetworkCheck as NetworkIcon,
	Computer as ComputerIcon,
	Business as BusinessIcon,
	Star as StarIcon,
	Warning as WarningIcon
} from '@mui/icons-material';
import {formatBytes} from 'common';
import {t} from 'i18next';
import {useMemo, useState, useEffect} from 'react';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';

//---------------------------------------------------------
// Performance Ranking Interfaces
//---------------------------------------------------------
interface PerformanceItem {
	id: string;
	name: string;
	type: 'backend' | 'endpoint' | 'service' | 'node';
	score: number;
	metrics: {
		responseTime: number;
		throughput: number;
		availability: number;
		errorRate: number;
	};
	trend: 'up' | 'down' | 'stable';
	trendValue: number;
	status: 'excellent' | 'good' | 'warning' | 'critical';
	lastUpdated: string;
}

interface RankingCategory {
	category: 'overall' | 'speed' | 'reliability' | 'efficiency';
	label: string;
	description: string;
	icon: React.ReactNode;
	items: PerformanceItem[];
	sortBy: keyof PerformanceItem['metrics'] | 'score';
}

//---------------------------------------------------------
// Generate Mock Performance Rankings
//---------------------------------------------------------
const generatePerformanceRankings = (): RankingCategory[] => {
	const baseItems: PerformanceItem[] = [
		{
			id: 'backend-1',
			name: 'auth-service-prod',
			type: 'backend',
			score: 95,
			metrics: {
				responseTime: 85,
				throughput: 450,
				availability: 99.8,
				errorRate: 0.2
			},
			trend: 'up',
			trendValue: 2.1,
			status: 'excellent',
			lastUpdated: '30s ago'
		},
		{
			id: 'endpoint-1',
			name: '/api/v1/health',
			type: 'endpoint',
			score: 92,
			metrics: {
				responseTime: 12,
				throughput: 1200,
				availability: 99.9,
				errorRate: 0.1
			},
			trend: 'stable',
			trendValue: 0.3,
			status: 'excellent',
			lastUpdated: '45s ago'
		},
		{
			id: 'backend-2',
			name: 'data-service-v2',
			type: 'backend',
			score: 88,
			metrics: {
				responseTime: 156,
				throughput: 320,
				availability: 99.2,
				errorRate: 0.8
			},
			trend: 'up',
			trendValue: 4.2,
			status: 'good',
			lastUpdated: '1m ago'
		},
		{
			id: 'service-1',
			name: 'payment-gateway',
			type: 'service',
			score: 85,
			metrics: {
				responseTime: 245,
				throughput: 180,
				availability: 99.5,
				errorRate: 0.5
			},
			trend: 'down',
			trendValue: -1.8,
			status: 'good',
			lastUpdated: '2m ago'
		},
		{
			id: 'node-1',
			name: 'lb-node-primary',
			type: 'node',
			score: 82,
			metrics: {
				responseTime: 95,
				throughput: 680,
				availability: 98.9,
				errorRate: 1.1
			},
			trend: 'stable',
			trendValue: 0.8,
			status: 'good',
			lastUpdated: '1m ago'
		},
		{
			id: 'endpoint-2',
			name: '/api/v1/users/profile',
			type: 'endpoint',
			score: 78,
			metrics: {
				responseTime: 310,
				throughput: 95,
				availability: 98.2,
				errorRate: 1.8
			},
			trend: 'down',
			trendValue: -3.2,
			status: 'warning',
			lastUpdated: '3m ago'
		},
		{
			id: 'backend-3',
			name: 'legacy-api-service',
			type: 'backend',
			score: 65,
			metrics: {
				responseTime: 890,
				throughput: 45,
				availability: 96.8,
				errorRate: 3.2
			},
			trend: 'down',
			trendValue: -5.1,
			status: 'critical',
			lastUpdated: '5m ago'
		}
	];

	return [
		{
			category: 'overall',
			label: t('Overall Performance'),
			description: t('Comprehensive performance score based on all metrics'),
			icon: <TrophyIcon />,
			items: [...baseItems].sort((a, b) => b.score - a.score),
			sortBy: 'score'
		},
		{
			category: 'speed',
			label: t('Response Speed'),
			description: t('Ranked by average response time (lower is better)'),
			icon: <SpeedIcon />,
			items: [...baseItems].sort((a, b) => a.metrics.responseTime - b.metrics.responseTime),
			sortBy: 'responseTime'
		},
		{
			category: 'reliability',
			label: t('Reliability'),
			description: t('Ranked by availability and error rates'),
			icon: <NetworkIcon />,
			items: [...baseItems].sort((a, b) => (b.metrics.availability - a.metrics.availability) || (a.metrics.errorRate - b.metrics.errorRate)),
			sortBy: 'availability'
		},
		{
			category: 'efficiency',
			label: t('Throughput Efficiency'),
			description: t('Ranked by requests processed per second'),
			icon: <StorageIcon />,
			items: [...baseItems].sort((a, b) => b.metrics.throughput - a.metrics.throughput),
			sortBy: 'throughput'
		}
	];
};

//---------------------------------------------------------
// Performance Item Component
//---------------------------------------------------------
interface PerformanceItemProps {
	item: PerformanceItem;
	rank: number;
	category: RankingCategory;
	isCompact?: boolean;
}

function PerformanceItemComponent({item, rank, category, isCompact = false}: PerformanceItemProps) {
	const theme = useTheme();

	const getTypeIcon = () => {
		switch (item.type) {
			case 'backend': return <ComputerIcon />;
			case 'endpoint': return <NetworkIcon />;
			case 'service': return <BusinessIcon />;
			case 'node': return <StorageIcon />;
			default: return <ComputerIcon />;
		}
	};

	const getStatusColor = () => {
		switch (item.status) {
			case 'excellent': return theme.palette.success.main;
			case 'good': return theme.palette.info.main;
			case 'warning': return theme.palette.warning.main;
			case 'critical': return theme.palette.error.main;
			default: return theme.palette.grey[500];
		}
	};

	const getRankIcon = () => {
		if (rank === 1) return <TrophyIcon sx={{ color: '#FFD700' }} />;
		if (rank === 2) return <TrophyIcon sx={{ color: '#C0C0C0' }} />;
		if (rank === 3) return <TrophyIcon sx={{ color: '#cd7f32' }} />;
		return <Typography variant="body2" fontWeight="bold" color="text.secondary">#{rank}</Typography>;
	};

	const getTrendIcon = () => {
		switch (item.trend) {
			case 'up': return <TrendingUpIcon fontSize="small" color="success" />;
			case 'down': return <TrendingDownIcon fontSize="small" color="error" />;
			case 'stable': return <TimelineIcon fontSize="small" color="info" />;
		}
	};

	const getMetricValue = () => {
		switch (category.sortBy) {
			case 'responseTime': return `${item.metrics.responseTime}ms`;
			case 'throughput': return `${item.metrics.throughput}/s`;
			case 'availability': return `${item.metrics.availability}%`;
			case 'errorRate': return `${item.metrics.errorRate}%`;
			default: return item.score;
		}
	};

	if (isCompact) {
		return (
			<ListItem 
				sx={{ 
					py: 1,
					'&:hover': { bgcolor: alpha(getStatusColor(), 0.05) }
				}}
			>
				<ListItemAvatar>
					<Avatar 
						sx={{ 
							width: 32, 
							height: 32,
							bgcolor: getStatusColor(),
							fontSize: '0.75rem'
						}}
					>
						{rank <= 3 ? getRankIcon() : rank}
					</Avatar>
				</ListItemAvatar>
				<ListItemText
					primary={
						<Box display="flex" alignItems="center" justifyContent="space-between">
							<Typography variant="body2" fontWeight="medium" noWrap>
								{item.name}
							</Typography>
							<Typography variant="body2" color="primary.main" fontWeight="bold">
								{getMetricValue()}
							</Typography>
						</Box>
					}
					secondary={
						<Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
							<Chip 
								label={item.type.toUpperCase()} 
								size="small" 
								variant="outlined"
								sx={{ fontSize: '0.6rem', height: 18 }}
							/>
							<Stack direction="row" alignItems="center" spacing={0.5}>
								{getTrendIcon()}
								<Typography variant="caption" color="text.secondary">
									{item.trendValue > 0 ? '+' : ''}{item.trendValue.toFixed(1)}%
								</Typography>
							</Stack>
						</Stack>
					}
				/>
			</ListItem>
		);
	}

	return (
		<Card variant="outlined" sx={{ mb: 1 }}>
			<CardContent sx={{ p: 2 }}>
				<Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
					<Box display="flex" alignItems="center" gap={2}>
						<Box display="flex" alignItems="center" gap={1}>
							{getRankIcon()}
							{rank <= 3 && (
								<StarIcon sx={{ color: theme.palette.warning.main, fontSize: 16 }} />
							)}
						</Box>
						<Box>
							<Typography variant="body1" fontWeight="medium">
								{item.name}
							</Typography>
							<Box display="flex" alignItems="center" gap={1}>
								<Box color={getStatusColor()}>
									{getTypeIcon()}
								</Box>
								<Chip 
									label={item.type.toUpperCase()} 
									size="small" 
									variant="outlined"
									sx={{ fontSize: '0.7rem', height: 20 }}
								/>
								<Chip 
									label={item.status.toUpperCase()} 
									size="small"
									color={
										item.status === 'excellent' ? 'success' :
										item.status === 'good' ? 'info' :
										item.status === 'warning' ? 'warning' : 'error'
									}
									sx={{ fontSize: '0.7rem', height: 20 }}
								/>
							</Box>
						</Box>
					</Box>
					<Box textAlign="right">
						<Typography variant="h6" color="primary.main" fontWeight="bold">
							{getMetricValue()}
						</Typography>
						<Box display="flex" alignItems="center" gap={0.5}>
							{getTrendIcon()}
							<Typography variant="caption" color={
								item.trend === 'up' ? 'success.main' : 
								item.trend === 'down' ? 'error.main' : 'text.secondary'
							}>
								{item.trendValue > 0 ? '+' : ''}{item.trendValue.toFixed(1)}%
							</Typography>
						</Box>
					</Box>
				</Box>

				{/* Detailed Metrics */}
				<Grid container spacing={2}>
					<Grid item xs={3}>
						<Box>
							<Typography variant="caption" color="text.secondary">Response Time</Typography>
							<Typography variant="body2" fontWeight="medium">{item.metrics.responseTime}ms</Typography>
						</Box>
					</Grid>
					<Grid item xs={3}>
						<Box>
							<Typography variant="caption" color="text.secondary">Throughput</Typography>
							<Typography variant="body2" fontWeight="medium">{item.metrics.throughput}/s</Typography>
						</Box>
					</Grid>
					<Grid item xs={3}>
						<Box>
							<Typography variant="caption" color="text.secondary">Availability</Typography>
							<Typography variant="body2" fontWeight="medium" color={
								item.metrics.availability >= 99.5 ? 'success.main' : 
								item.metrics.availability >= 98 ? 'warning.main' : 'error.main'
							}>
								{item.metrics.availability}%
							</Typography>
						</Box>
					</Grid>
					<Grid item xs={3}>
						<Box>
							<Typography variant="caption" color="text.secondary">Error Rate</Typography>
							<Typography variant="body2" fontWeight="medium" color={
								item.metrics.errorRate <= 1 ? 'success.main' : 
								item.metrics.errorRate <= 3 ? 'warning.main' : 'error.main'
							}>
								{item.metrics.errorRate}%
							</Typography>
						</Box>
					</Grid>
				</Grid>

				{/* Performance Score Bar */}
				<Box mt={2}>
					<Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
						<Typography variant="caption" color="text.secondary">
							Overall Performance Score
						</Typography>
						<Typography variant="caption" fontWeight="bold">
							{item.score}/100
						</Typography>
					</Box>
					<LinearProgress 
						variant="determinate" 
						value={item.score} 
						color={
							item.score >= 90 ? 'success' :
							item.score >= 75 ? 'info' :
							item.score >= 60 ? 'warning' : 'error'
						}
						sx={{ height: 6, borderRadius: 3 }}
					/>
				</Box>

				<Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
					Last updated: {item.lastUpdated}
				</Typography>
			</CardContent>
		</Card>
	);
}

//---------------------------------------------------------
// Main Performance Ranking Card
//---------------------------------------------------------
export default function PerformanceRankingCard(props: {instance: IInstance | null}) {
	const {instance} = props;
	const theme = useTheme();
	
	const [selectedCategory, setSelectedCategory] = useState<'overall' | 'speed' | 'reliability' | 'efficiency'>('overall');
	const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('compact');
	const [rankingsData, setRankingsData] = useState<RankingCategory[]>([]);

	// Generate and update data
	useEffect(() => {
		const updateData = () => {
			setRankingsData(generatePerformanceRankings());
		};

		updateData();
		const interval = setInterval(updateData, 10000); // Update every 10 seconds
		return () => clearInterval(interval);
	}, []);

	const currentCategory = useMemo(() => {
		return rankingsData.find(cat => cat.category === selectedCategory);
	}, [rankingsData, selectedCategory]);

	const topItems = currentCategory?.items.slice(0, viewMode === 'compact' ? 8 : 5) || [];

	return (
		<CardBase title={t('Performance Rankings')}>
			<Box height="100%" display="flex" flexDirection="column">
				{/* Controls */}
				<Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
					<FormControl size="small" sx={{ minWidth: 200 }}>
						<InputLabel>{t('Ranking Category')}</InputLabel>
						<Select
							value={selectedCategory}
							label={t('Ranking Category')}
							onChange={(e) => setSelectedCategory(e.target.value as any)}
						>
							<MenuItem value="overall">{t('Overall Performance')}</MenuItem>
							<MenuItem value="speed">{t('Response Speed')}</MenuItem>
							<MenuItem value="reliability">{t('Reliability')}</MenuItem>
							<MenuItem value="efficiency">{t('Throughput')}</MenuItem>
						</Select>
					</FormControl>
					
					<Stack direction="row" spacing={1}>
						<Tooltip title={t('Toggle View Mode')}>
							<IconButton 
								size="small"
								color={viewMode === 'detailed' ? 'primary' : 'default'}
								onClick={() => setViewMode(viewMode === 'detailed' ? 'compact' : 'detailed')}
							>
								<TimelineIcon />
							</IconButton>
						</Tooltip>
						<Tooltip title={t('Refresh Rankings')}>
							<IconButton 
								size="small" 
								onClick={() => setRankingsData(generatePerformanceRankings())}
							>
								<RefreshIcon />
							</IconButton>
						</Tooltip>
					</Stack>
				</Box>

				{/* Category Info */}
				{currentCategory && (
					<Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
						<Box display="flex" alignItems="center" gap={2}>
							<Box color="primary.main">
								{currentCategory.icon}
							</Box>
							<Box flexGrow={1}>
								<Typography variant="h6" color="primary.main">
									{currentCategory.label}
								</Typography>
								<Typography variant="body2" color="text.secondary">
									{currentCategory.description}
								</Typography>
							</Box>
							<Box textAlign="right">
								<Typography variant="h5" fontWeight="bold" color="primary.main">
									{topItems.length}
								</Typography>
								<Typography variant="caption" color="text.secondary">
									{t('Items Ranked')}
								</Typography>
							</Box>
						</Box>
					</Paper>
				)}

				{/* Rankings List */}
				<Box flexGrow={1} overflow="auto">
					{viewMode === 'compact' ? (
						<List dense>
							{topItems.map((item, index) => (
								<div key={item.id}>
									<PerformanceItemComponent
										item={item}
										rank={index + 1}
										category={currentCategory!}
										isCompact={true}
									/>
									{index < topItems.length - 1 && <Divider />}
								</div>
							))}
						</List>
					) : (
						<Box>
							{topItems.map((item, index) => (
								<PerformanceItemComponent
									key={item.id}
									item={item}
									rank={index + 1}
									category={currentCategory!}
									isCompact={false}
								/>
							))}
						</Box>
					)}
				</Box>

				{/* Footer Stats */}
				{currentCategory && (
					<Box mt={2} pt={2} borderTop={`1px solid ${theme.palette.divider}`}>
						<Grid container spacing={2} textAlign="center">
							<Grid item xs={3}>
								<Typography variant="h6" color="success.main">
									{topItems.filter(item => item.status === 'excellent').length}
								</Typography>
								<Typography variant="caption" color="text.secondary">
									{t('Excellent')}
								</Typography>
							</Grid>
							<Grid item xs={3}>
								<Typography variant="h6" color="info.main">
									{topItems.filter(item => item.status === 'good').length}
								</Typography>
								<Typography variant="caption" color="text.secondary">
									{t('Good')}
								</Typography>
							</Grid>
							<Grid item xs={3}>
								<Typography variant="h6" color="warning.main">
									{topItems.filter(item => item.status === 'warning').length}
								</Typography>
								<Typography variant="caption" color="text.secondary">
									{t('Warning')}
								</Typography>
							</Grid>
							<Grid item xs={3}>
								<Typography variant="h6" color="error.main">
									{topItems.filter(item => item.status === 'critical').length}
								</Typography>
								<Typography variant="caption" color="text.secondary">
									{t('Critical')}
								</Typography>
							</Grid>
						</Grid>
					</Box>
				)}
			</Box>
		</CardBase>
	);
}