//---------------------------------------------------------
// Top Consumers Analytics Card
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
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Card,
	CardContent,
	Select,
	MenuItem,
	FormControl,
	InputLabel
} from '@mui/material';
import {
	TrendingUp as TrendingUpIcon,
	TrendingDown as TrendingDownIcon,
	Timeline as TimelineIcon,
	Refresh as RefreshIcon,
	Computer as ComputerIcon,
	Language as LanguageIcon,
	Storage as StorageIcon,
	Speed as SpeedIcon,
	Person as PersonIcon,
	Business as BusinessIcon
} from '@mui/icons-material';
import {formatBytes} from 'common';
import {t} from 'i18next';
import {useMemo, useState, useEffect} from 'react';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';

//---------------------------------------------------------
// Top Consumer Interfaces
//---------------------------------------------------------
interface TopConsumer {
	id: string;
	name: string;
	type: 'client' | 'endpoint' | 'service' | 'user';
	value: number;
	percentage: number;
	trend: 'up' | 'down' | 'stable';
	trendValue: number;
	requests: number;
	responseTime: number;
	errorRate: number;
	lastActive: string;
	location?: string;
}

interface TopConsumerCategory {
	category: 'bandwidth' | 'requests' | 'connections' | 'errors';
	label: string;
	unit: string;
	icon: React.ReactNode;
	consumers: TopConsumer[];
}

//---------------------------------------------------------
// Generate Mock Top Consumers Data
//---------------------------------------------------------
const generateTopConsumers = (): TopConsumerCategory[] => {
	const categories: TopConsumerCategory[] = [
		{
			category: 'bandwidth',
			label: t('Top Bandwidth Consumers'),
			unit: 'GB/h',
			icon: <StorageIcon />,
			consumers: [
				{
					id: 'client-1',
					name: 'api.example.com',
					type: 'client',
					value: 45.2 + Math.random() * 10,
					percentage: 32.1,
					trend: 'up',
					trendValue: 8.2,
					requests: 15420,
					responseTime: 245,
					errorRate: 1.2,
					lastActive: '2m ago',
					location: 'US-East'
				},
				{
					id: 'client-2',
					name: 'web.dashboard.local',
					type: 'client',
					value: 38.7 + Math.random() * 8,
					percentage: 27.3,
					trend: 'stable',
					trendValue: 0.5,
					requests: 12890,
					responseTime: 189,
					errorRate: 0.8,
					lastActive: '1m ago',
					location: 'EU-West'
				},
				{
					id: 'service-1',
					name: 'auth-service',
					type: 'service',
					value: 28.1 + Math.random() * 6,
					percentage: 19.8,
					trend: 'down',
					trendValue: -2.1,
					requests: 9876,
					responseTime: 156,
					errorRate: 2.1,
					lastActive: '30s ago',
					location: 'Internal'
				},
				{
					id: 'endpoint-1',
					name: '/api/v1/users',
					type: 'endpoint',
					value: 21.4 + Math.random() * 4,
					percentage: 15.1,
					trend: 'up',
					trendValue: 4.7,
					requests: 8234,
					responseTime: 312,
					errorRate: 3.2,
					lastActive: '45s ago'
				},
				{
					id: 'client-3',
					name: 'mobile.app.client',
					type: 'client',
					value: 16.8 + Math.random() * 3,
					percentage: 11.9,
					trend: 'stable',
					trendValue: 1.1,
					requests: 6789,
					responseTime: 98,
					errorRate: 0.5,
					lastActive: '3m ago',
					location: 'Asia-Pacific'
				}
			]
		},
		{
			category: 'requests',
			label: t('Top Request Generators'),
			unit: 'req/min',
			icon: <SpeedIcon />,
			consumers: [
				{
					id: 'user-1',
					name: 'bot-crawler-01',
					type: 'user',
					value: 2840 + Math.random() * 200,
					percentage: 41.2,
					trend: 'up',
					trendValue: 12.5,
					requests: 2840,
					responseTime: 45,
					errorRate: 0.2,
					lastActive: '10s ago'
				},
				{
					id: 'service-2',
					name: 'data-sync-service',
					type: 'service',
					value: 1650 + Math.random() * 150,
					percentage: 23.9,
					trend: 'stable',
					trendValue: 2.1,
					requests: 1650,
					responseTime: 89,
					errorRate: 1.1,
					lastActive: '20s ago'
				},
				{
					id: 'client-4',
					name: 'dashboard-frontend',
					type: 'client',
					value: 980 + Math.random() * 80,
					percentage: 14.2,
					trend: 'down',
					trendValue: -3.4,
					requests: 980,
					responseTime: 156,
					errorRate: 0.8,
					lastActive: '1m ago'
				},
				{
					id: 'endpoint-2',
					name: '/health/check',
					type: 'endpoint',
					value: 720 + Math.random() * 60,
					percentage: 10.4,
					trend: 'stable',
					trendValue: 0.9,
					requests: 720,
					responseTime: 12,
					errorRate: 0.1,
					lastActive: '5s ago'
				},
				{
					id: 'user-2',
					name: 'admin-panel-user',
					type: 'user',
					value: 456 + Math.random() * 40,
					percentage: 6.6,
					trend: 'up',
					trendValue: 5.2,
					requests: 456,
					responseTime: 234,
					errorRate: 1.5,
					lastActive: '2m ago'
				}
			]
		}
	];

	return categories;
};

//---------------------------------------------------------
// Consumer Item Component
//---------------------------------------------------------
interface ConsumerItemProps {
	consumer: TopConsumer;
	rank: number;
	category: TopConsumerCategory;
	showDetails: boolean;
}

function ConsumerItem({consumer, rank, category, showDetails}: ConsumerItemProps) {
	const theme = useTheme();

	const getTypeIcon = () => {
		switch (consumer.type) {
			case 'client': return <ComputerIcon />;
			case 'endpoint': return <LanguageIcon />;
			case 'service': return <BusinessIcon />;
			case 'user': return <PersonIcon />;
			default: return <ComputerIcon />;
		}
	};

	const getTypeColor = () => {
		switch (consumer.type) {
			case 'client': return theme.palette.primary.main;
			case 'endpoint': return theme.palette.secondary.main;
			case 'service': return theme.palette.info.main;
			case 'user': return theme.palette.success.main;
			default: return theme.palette.grey[500];
		}
	};

	const getTrendIcon = () => {
		switch (consumer.trend) {
			case 'up': return <TrendingUpIcon fontSize="small" color="success" />;
			case 'down': return <TrendingDownIcon fontSize="small" color="error" />;
			case 'stable': return <TimelineIcon fontSize="small" color="info" />;
		}
	};

	const getRankColor = () => {
		if (rank === 1) return theme.palette.warning.main; // Gold
		if (rank === 2) return theme.palette.grey[400]; // Silver
		if (rank === 3) return '#cd7f32'; // Bronze
		return theme.palette.text.secondary;
	};

	return (
		<TableRow hover sx={{ '&:hover': { bgcolor: alpha(getTypeColor(), 0.05) } }}>
			{/* Rank */}
			<TableCell>
				<Box display="flex" alignItems="center" gap={1}>
					<Avatar 
						sx={{ 
							width: 32, 
							height: 32, 
							bgcolor: getRankColor(),
							color: 'white',
							fontSize: '0.875rem',
							fontWeight: 'bold'
						}}
					>
						#{rank}
					</Avatar>
				</Box>
			</TableCell>

			{/* Consumer Info */}
			<TableCell>
				<Box display="flex" alignItems="center" gap={2}>
					<Box color={getTypeColor()}>
						{getTypeIcon()}
					</Box>
					<Box>
						<Typography variant="body2" fontWeight="medium" noWrap>
							{consumer.name}
						</Typography>
						<Box display="flex" alignItems="center" gap={1}>
							<Chip 
								label={consumer.type.toUpperCase()} 
								size="small" 
								variant="outlined"
								sx={{ 
									fontSize: '0.7rem', 
									height: 20,
									color: getTypeColor(),
									borderColor: getTypeColor()
								}}
							/>
							{consumer.location && (
								<Typography variant="caption" color="text.secondary">
									{consumer.location}
								</Typography>
							)}
						</Box>
					</Box>
				</Box>
			</TableCell>

			{/* Value and Progress */}
			<TableCell>
				<Box>
					<Box display="flex" alignItems="center" gap={1} mb={0.5}>
						<Typography variant="body2" fontWeight="bold">
							{category.category === 'bandwidth' 
								? formatBytes(consumer.value * 1024 * 1024 * 1024)
								: consumer.value.toFixed(0)
							}
							<Typography component="span" variant="caption" color="text.secondary">
								{category.unit}
							</Typography>
						</Typography>
						<Box display="flex" alignItems="center" gap={0.5}>
							{getTrendIcon()}
							<Typography variant="caption" color={
								consumer.trend === 'up' ? 'success.main' : 
								consumer.trend === 'down' ? 'error.main' : 'text.secondary'
							}>
								{consumer.trendValue > 0 ? '+' : ''}{consumer.trendValue.toFixed(1)}%
							</Typography>
						</Box>
					</Box>
					<LinearProgress 
						variant="determinate" 
						value={consumer.percentage} 
						color={
							consumer.percentage > 30 ? 'error' : 
							consumer.percentage > 20 ? 'warning' : 'success'
						}
						sx={{ height: 4, borderRadius: 2 }}
					/>
					<Typography variant="caption" color="text.secondary">
						{consumer.percentage.toFixed(1)}% of total
					</Typography>
				</Box>
			</TableCell>

			{/* Details */}
			{showDetails && (
				<TableCell>
					<Box>
						<Typography variant="caption" color="text.secondary" display="block">
							{t('Requests')}: {consumer.requests.toLocaleString()}
						</Typography>
						<Typography variant="caption" color="text.secondary" display="block">
							{t('Avg Response')}: {consumer.responseTime}ms
						</Typography>
						<Typography variant="caption" color={
							consumer.errorRate > 3 ? 'error.main' : 
							consumer.errorRate > 1 ? 'warning.main' : 'success.main'
						} display="block">
							{t('Error Rate')}: {consumer.errorRate.toFixed(1)}%
						</Typography>
						<Typography variant="caption" color="text.secondary">
							{t('Last Active')}: {consumer.lastActive}
						</Typography>
					</Box>
				</TableCell>
			)}
		</TableRow>
	);
}

//---------------------------------------------------------
// Main Top Consumers Card
//---------------------------------------------------------
export default function TopConsumersCard(props: {instance: IInstance | null}) {
	const {instance} = props;
	const theme = useTheme();
	
	const [selectedCategory, setSelectedCategory] = useState<'bandwidth' | 'requests'>('bandwidth');
	const [showDetails, setShowDetails] = useState(true);
	const [consumersData, setConsumersData] = useState<TopConsumerCategory[]>([]);

	// Generate and update data
	useEffect(() => {
		const updateData = () => {
			setConsumersData(generateTopConsumers());
		};

		updateData();
		const interval = setInterval(updateData, 8000); // Update every 8 seconds
		return () => clearInterval(interval);
	}, []);

	const currentCategory = useMemo(() => {
		return consumersData.find(cat => cat.category === selectedCategory);
	}, [consumersData, selectedCategory]);

	const topConsumers = currentCategory?.consumers.slice(0, 5) || [];

	return (
		<CardBase title={t('Top Consumers Analysis')}>
			<Box height="100%" display="flex" flexDirection="column">
				{/* Controls */}
				<Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
					<FormControl size="small" sx={{ minWidth: 200 }}>
						<InputLabel>{t('Analysis Type')}</InputLabel>
						<Select
							value={selectedCategory}
							label={t('Analysis Type')}
							onChange={(e) => setSelectedCategory(e.target.value as 'bandwidth' | 'requests')}
						>
							<MenuItem value="bandwidth">{t('Bandwidth Usage')}</MenuItem>
							<MenuItem value="requests">{t('Request Volume')}</MenuItem>
						</Select>
					</FormControl>
					
					<Stack direction="row" spacing={1}>
						<Tooltip title={t('Toggle Details')}>
							<IconButton 
								size="small"
								color={showDetails ? 'primary' : 'default'}
								onClick={() => setShowDetails(!showDetails)}
							>
								<TimelineIcon />
							</IconButton>
						</Tooltip>
						<Tooltip title={t('Refresh Data')}>
							<IconButton 
								size="small" 
								onClick={() => setConsumersData(generateTopConsumers())}
							>
								<RefreshIcon />
							</IconButton>
						</Tooltip>
					</Stack>
				</Box>

				{/* Summary Stats */}
				{currentCategory && (
					<Grid container spacing={2} mb={2}>
						<Grid item xs={3}>
							<Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
								<Box color="primary.main" display="flex" justifyContent="center" mb={0.5}>
									{currentCategory.icon}
								</Box>
								<Typography variant="h6" color="primary.main">
									{topConsumers.length}
								</Typography>
								<Typography variant="caption" color="text.secondary">
									{t('Top Consumers')}
								</Typography>
							</Paper>
						</Grid>
						<Grid item xs={3}>
							<Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
								<Typography variant="h6" color="success.main">
									{topConsumers.reduce((sum, c) => sum + c.percentage, 0).toFixed(1)}%
								</Typography>
								<Typography variant="caption" color="text.secondary">
									{t('Total Share')}
								</Typography>
							</Paper>
						</Grid>
						<Grid item xs={3}>
							<Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
								<Typography variant="h6" color="warning.main">
									{topConsumers.filter(c => c.trend === 'up').length}
								</Typography>
								<Typography variant="caption" color="text.secondary">
									{t('Trending Up')}
								</Typography>
							</Paper>
						</Grid>
						<Grid item xs={3}>
							<Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
								<Typography variant="h6" color="error.main">
									{topConsumers.reduce((sum, c) => sum + c.errorRate, 0).toFixed(1)}%
								</Typography>
								<Typography variant="caption" color="text.secondary">
									{t('Avg Error Rate')}
								</Typography>
							</Paper>
						</Grid>
					</Grid>
				)}

				{/* Top Consumers Table */}
				<Box flexGrow={1} overflow="auto">
					<TableContainer component={Paper} variant="outlined">
						<Table size="small" stickyHeader>
							<TableHead>
								<TableRow>
									<TableCell width="80px">{t('Rank')}</TableCell>
									<TableCell>{t('Consumer')}</TableCell>
									<TableCell width="200px">{t('Usage')}</TableCell>
									{showDetails && <TableCell width="150px">{t('Details')}</TableCell>}
								</TableRow>
							</TableHead>
							<TableBody>
								{topConsumers.map((consumer, index) => (
									<ConsumerItem
										key={consumer.id}
										consumer={consumer}
										rank={index + 1}
										category={currentCategory!}
										showDetails={showDetails}
									/>
								))}
							</TableBody>
						</Table>
					</TableContainer>
				</Box>

				{/* Footer Summary */}
				<Box mt={2} pt={2} borderTop={`1px solid ${theme.palette.divider}`}>
					<Typography variant="caption" color="text.secondary" textAlign="center">
						{t('Showing top 5 consumers by {{type}}. Data refreshes every 8 seconds.', {
							type: selectedCategory
						})}
					</Typography>
				</Box>
			</Box>
		</CardBase>
	);
}