//---------------------------------------------------------
// nTop Analysis Page - Rate-based Network Traffic Analysis
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
	Select,
	MenuItem,
	FormControl,
	InputLabel,
	List,
	ListItem,
	ListItemAvatar,
	ListItemText,
	Avatar,
	LinearProgress,
	Tabs,
	Tab,
	Paper,
	Card,
	CardContent,
	Grid
} from '@mui/material';
import {
	Refresh as RefreshIcon,
	Info as InfoIcon,
	TrendingUp as TrendingUpIcon,
	TrendingDown as TrendingDownIcon,
	TrendingFlat as TrendingFlatIcon,
	Speed as SpeedIcon,
	NetworkCheck as NetworkCheckIcon,
	Router as RouterIcon,
	Assessment as AssessmentIcon
} from '@mui/icons-material';
import {formatRate} from 'common';
import HorizontalStack from 'components/layout/HorizontalStack';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {
	useNTopData,
	NTOP_CATEGORIES,
	NTOP_TIME_WINDOWS,
	type NTopCategory,
	type NTopTimeWindow,
	type NTopItem
} from 'hooks/query/nTopHooks';
import {t} from 'i18next';
import {useState} from 'react';

//---------------------------------------------------------
// Category Icons Mapping
//---------------------------------------------------------
const CATEGORY_ICONS = {
	SERVICES: <NetworkCheckIcon />,
	ENDPOINTS: <RouterIcon />,
	CLIENTS: <AssessmentIcon />
};

//---------------------------------------------------------
// nTop Ranking List Component
//---------------------------------------------------------
function NTopRankingList({
	items,
	showMetrics,
	timeWindow
}: {
	items: NTopItem[];
	showMetrics: boolean;
	timeWindow: NTopTimeWindow;
}) {
	const theme = useTheme();

	const getTrendIcon = (trend: string) => {
		switch (trend) {
			case 'up': return <TrendingUpIcon fontSize="small" color="success" />;
			case 'down': return <TrendingDownIcon fontSize="small" color="error" />;
			default: return <TrendingFlatIcon fontSize="small" color="disabled" />;
		}
	};

	const getRankColor = (rank: number) => {
		if (rank === 1) return theme.palette.warning.main; // Gold
		if (rank === 2) return theme.palette.grey[400]; // Silver  
		if (rank === 3) return theme.palette.warning.light; // Bronze
		return theme.palette.primary.main;
	};

	if (items.length === 0) {
		return (
			<Box display="flex" justifyContent="center" alignItems="center" height={200}>
				<Typography variant="body2" color="textSecondary">
					{t('No data available for current time window')}
				</Typography>
			</Box>
		);
	}

	return (
		<List>
			{items.map((item) => (
				<ListItem key={item.id} divider>
					<ListItemAvatar>
						<Avatar 
							sx={{ 
								bgcolor: getRankColor(item.rank),
								width: 32,
								height: 32,
								fontSize: '0.875rem',
								fontWeight: 'bold'
							}}
						>
							{item.rank}
						</Avatar>
					</ListItemAvatar>
					<ListItemText
						primary={
							<Box display="flex" justifyContent="space-between" alignItems="center">
								<Typography variant="body1" fontWeight="medium">
									{item.label}
								</Typography>
								<Box display="flex" alignItems="center" gap={1}>
									{getTrendIcon(item.trend)}
									{showMetrics && (
										<Typography variant="body2" fontWeight="bold" color="primary">
											{formatRate(item.value, item.metadata.unit)}
										</Typography>
									)}
								</Box>
							</Box>
						}
						secondary={
							<>
								<Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
									<Typography variant="caption" color="textSecondary" component="span">
										{item.percentage.toFixed(1)}% of total
									</Typography>
									{item.metadata.service && (
										<Chip 
											label={item.metadata.service} 
											size="small" 
											variant="outlined"
											sx={{ fontSize: '0.6rem', height: 16 }}
										/>
									)}
								</Box>
								<LinearProgress 
									variant="determinate" 
									value={Math.min(item.percentage, 100)} 
									sx={{ height: 4, borderRadius: 2 }}
								/>
							</>
						}
					/>
				</ListItem>
			))}
		</List>
	);
}

//---------------------------------------------------------
// nTop Controls Component
//---------------------------------------------------------
function NTopControls({
	category,
	timeWindow,
	topN,
	showMetrics,
	onCategoryChange,
	onTimeWindowChange,
	onTopNChange,
	onShowMetricsChange,
	onRefresh
}: {
	category: NTopCategory;
	timeWindow: NTopTimeWindow;
	topN: number;
	showMetrics: boolean;
	onCategoryChange: (category: NTopCategory) => void;
	onTimeWindowChange: (window: NTopTimeWindow) => void;
	onTopNChange: (n: number) => void;
	onShowMetricsChange: (show: boolean) => void;
	onRefresh: () => void;
}) {
	return (
		<Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
			{/* Time Window */}
			<FormControl size="small" sx={{ minWidth: 120 }}>
				<InputLabel>{t('Time Window')}</InputLabel>
				<Select
					value={timeWindow}
					label={t('Time Window')}
					onChange={(e) => onTimeWindowChange(e.target.value as NTopTimeWindow)}
				>
					{Object.entries(NTOP_TIME_WINDOWS).map(([key, config]) => (
						<MenuItem key={key} value={key}>
							<Box>
								<Typography variant="body2">{config.label}</Typography>
								<Typography variant="caption" color="textSecondary">
									{config.description}
								</Typography>
							</Box>
						</MenuItem>
					))}
				</Select>
			</FormControl>

			{/* Top N */}
			<FormControl size="small" sx={{ minWidth: 80 }}>
				<InputLabel>{t('Top N')}</InputLabel>
				<Select
					value={topN}
					label={t('Top N')}
					onChange={(e) => onTopNChange(e.target.value as number)}
				>
					{[5, 10, 15, 20, 25, 50].map(n => (
						<MenuItem key={n} value={n}>{n}</MenuItem>
					))}
				</Select>
			</FormControl>

			{/* Show Metrics Toggle */}
			<FormControlLabel
				control={
					<Switch 
						size="small" 
						checked={showMetrics} 
						onChange={(e) => onShowMetricsChange(e.target.checked)} 
					/>
				}
				label={<Typography variant="caption">{t('Show Values')}</Typography>}
			/>

			{/* Refresh Button */}
			<Tooltip title={t('Refresh')}>
				<IconButton size="small" onClick={onRefresh}>
					<RefreshIcon fontSize="small" />
				</IconButton>
			</Tooltip>
		</Stack>
	);
}

//---------------------------------------------------------
// Main Component
//---------------------------------------------------------
export default function NTopPage() {
	const instance = useInstanceFromURL();
	const theme = useTheme();

	// State management
	const [category, setCategory] = useState<NTopCategory>('SERVICES');
	const [timeWindow, setTimeWindow] = useState<NTopTimeWindow>('5m');
	const [topN, setTopN] = useState(10);
	const [showMetrics, setShowMetrics] = useState(true);
	const [showInfo, setShowInfo] = useState(false);

	// Data fetching
	const {data, isLoading, refetch} = useNTopData(
		instance, 
		category, 
		timeWindow, 
		topN
	);

	const categoryConfig = NTOP_CATEGORIES[category];
	const items = data?.items || [];

	return (
		<SubTitlePannel 
			title="nTop - Network Traffic Analysis" 
			sub_title="Rate-based ranking and administrator analysis tools"
		>
			<HorizontalStack>

			</HorizontalStack>

			<Grid container spacing={2}>
				{/* Category Tabs */}
				<Grid item xs={12}>
					<Paper>
						<Tabs 
							value={category} 
							onChange={(_, newCategory) => setCategory(newCategory)}
							variant="fullWidth"
						>
							{Object.entries(NTOP_CATEGORIES).map(([key, config]) => (
								<Tab 
									key={key}
									value={key}
									icon={CATEGORY_ICONS[key as NTopCategory]}
									label={config.title}
									iconPosition="start"
								/>
							))}
						</Tabs>
					</Paper>
				</Grid>

				{/* Controls */}
				<Grid item xs={12}>
					<Card>
						<CardContent>
							<NTopControls
								category={category}
								timeWindow={timeWindow}
								topN={topN}
								showMetrics={showMetrics}
								onCategoryChange={setCategory}
								onTimeWindowChange={setTimeWindow}
								onTopNChange={setTopN}
								onShowMetricsChange={setShowMetrics}
								onRefresh={() => refetch()}
							/>
						</CardContent>
					</Card>
				</Grid>

				{/* Stats */}
				<Grid item xs={12}>
					<Box display="flex" gap={2} flexWrap="wrap">
						<Chip 
							label={`${items.length} / ${topN} ${t('Items')}`} 
							size="small" 
							color="primary" 
							variant="outlined" 
						/>
						{data?.totalDataPoints && (
							<Chip 
								label={`${data.totalDataPoints} ${t('Data Points')}`} 
								size="small" 
								color="info" 
								variant="outlined" 
							/>
						)}
						{data?.fetchedAt && (
							<Chip 
								label={`${t('Updated')}: ${new Date(data.fetchedAt).toLocaleTimeString()}`} 
								size="small" 
								color="success" 
								variant="outlined" 
							/>
						)}
						{data?.isMockData && (
							<Chip 
								label={t('Demo Data - No Live Traffic')} 
								size="small" 
								color="secondary" 
								variant="filled"
							/>
						)}
					</Box>
				</Grid>

				{/* Main Content */}
				<Grid item xs={12}>
					<Card>
						<CardContent>
							{/* Category Header */}
							<Box display="flex" alignItems="center" gap={1} mb={2}>
								{CATEGORY_ICONS[category]}
								<Typography variant="h6" component="h2">
									{categoryConfig.title}
								</Typography>
								<Typography variant="body2" color="textSecondary" flex={1}>
									{categoryConfig.description}
								</Typography>
								<Tooltip title={t('Info')}>
									<IconButton size="small" onClick={() => setShowInfo(!showInfo)}>
										<InfoIcon fontSize="small" />
									</IconButton>
								</Tooltip>
							</Box>

							{/* Info Panel */}
							{showInfo && (
								<Box 
									p={1.5} 
									mb={2}
									bgcolor={alpha(theme.palette.primary.main, 0.05)} 
									borderRadius={1}
									border={`1px solid ${alpha(theme.palette.primary.main, 0.2)}`}
								>
									<Typography variant="caption" fontWeight="bold" color="primary.main">
										{t('Analysis Configuration')}
									</Typography>
									<Stack spacing={0.5} mt={0.5}>
										<Typography variant="caption" color="textSecondary">
											• Time Window: {data?.windowConfig?.description}
										</Typography>
										<Typography variant="caption" color="textSecondary">
											• Metrics: Rate-based calculations from cumulative data
										</Typography>
										<Typography variant="caption" color="textSecondary">
											• Ranking: Real-time traffic rate analysis
										</Typography>

									</Stack>
								</Box>
							)}

							{/* Loading State */}
							{isLoading ? (
								<Box display="flex" justifyContent="center" alignItems="center" height={200}>
									<Typography variant="body2" color="textSecondary">
										{t('Analyzing traffic data...')}
									</Typography>
								</Box>
							) : (
								/* Ranking List */
								<NTopRankingList 
									items={items}
									showMetrics={showMetrics}
									timeWindow={timeWindow}
								/>
							)}
						</CardContent>
					</Card>
				</Grid>
			</Grid>
		</SubTitlePannel>
	);
}