//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {
	Box,
	Button,
	Card,
	CardContent,
	Chip,
	FormControl,
	Grid,
	InputLabel,
	MenuItem,
	Paper,
	Select,
	TextField,
	Typography,
	useTheme,
	Alert,
	LinearProgress,
	Tabs,
	Tab,
	Pagination,
	Autocomplete,
	Collapse,
	IconButton,
	Tooltip,
	Switch,
	FormControlLabel,
} from '@mui/material';
import {DateTimePicker} from '@mui/x-date-pickers/DateTimePicker';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDateFns} from '@mui/x-date-pickers/AdapterDateFns';
import {TrendingUp, TrendingDown, Timeline, BarChart, Speed, ExpandMore, ExpandLess, FilterList, ViewModule, ViewList} from '@mui/icons-material';
import {formatBytes, formatRate, formatNumberForAxis} from 'common';
import RateLineGraph from 'components/element/RateLineGraph';
import SimpleLineGraph from 'components/element/SimpleLineGraph';
import MiniLineGraph from 'components/element/MiniLineGraph';
import RateTooltip from 'components/element/RateTooltip';
import {
	useAdvancedLiveMetrics,
	useCacheStats,
	useHistoricalMetrics,
	useLiveMetrics,
	useMetricsAggregate,
	useSystemHealth,
} from 'hooks/query/advancedMetricsHook';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {t} from 'i18next';
import {useState, useMemo} from 'react';
import {IHistoricalMetricsParams, IMetricsAggregateParams} from 'types/metrics';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function AdvancedMetricsPage() {
	const instance = useInstanceFromURL();
	const theme = useTheme();
	
	// State for historical query
	const [timeStart, setTimeStart] = useState<Date>(new Date(Date.now() - 24 * 60 * 60 * 1000)); // 24h ago
	const [timeEnd, setTimeEnd] = useState<Date>(new Date());
	const [selectedMetrics, setSelectedMetrics] = useState<string>('');
	const [aggregationType, setAggregationType] = useState<'avg' | 'sum' | 'max' | 'min' | 'p95' | 'p99'>('avg');
	const [aggregationInterval, setAggregationInterval] = useState<'1h' | '1d' | '1w' | '1m'>('1h');

	// UI State for handling large datasets
	const [currentTab, setCurrentTab] = useState(0);
	const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
	const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
	const [metricsPerPage, setMetricsPerPage] = useState(6);
	const [currentPage, setCurrentPage] = useState(1);
	const [autoRefresh, setAutoRefresh] = useState(true);
	const [selectedMetricCategories, setSelectedMetricCategories] = useState<string[]>(['all']);

	// Live metrics hooks
	const liveMetrics = useLiveMetrics(instance, autoRefresh ? 2 : undefined);
	const cacheStats = useCacheStats(instance);
	const systemHealth = useSystemHealth(instance);

	// Historical query parameters
	const historicalParams: IHistoricalMetricsParams = {
		time_start: Math.floor(timeStart.getTime() / 1000),
		time_end: Math.floor(timeEnd.getTime() / 1000),
		metrics: selectedMetrics || undefined,
		limit: 100,
	};

	// Aggregation query parameters
	const aggregateParams: IMetricsAggregateParams = {
		time_start: Math.floor(timeStart.getTime() / 1000),
		time_end: Math.floor(timeEnd.getTime() / 1000),
		metrics: selectedMetrics || undefined,
		aggregation: aggregationType,
		interval: aggregationInterval,
		limit: 50,
	};

	// Historical and aggregation queries
	const historicalData = useHistoricalMetrics(instance, historicalParams);
	const aggregateData = useMetricsAggregate(instance, aggregateParams);

	// Predefined metric categories based on LoxiLB metric definitions
	const metricCategories = [
		{value: 'all', label: 'All Metrics'},
		{value: 'critical', label: 'Critical Metrics'},
		{value: 'important', label: 'Important Metrics'},
		{value: 'operational', label: 'Operational Metrics'},
		{value: 'historical', label: 'Historical Metrics'},
		{value: 'connection', label: 'Connection Tracking'},
		{value: 'loadbalancer', label: 'Load Balancer'},
		{value: 'health', label: 'Endpoint Health'},
		{value: 'firewall', label: 'Firewall & Security'},
		{value: 'traffic', label: 'Traffic Processing'},
		{value: 'lcu', label: 'LCU Metrics'},
		{value: 'protocol', label: 'Protocol-Specific'},
	];

	// LoxiLB Critical Metrics (Real-time monitoring priority)
	const criticalMetrics = [
		'active_conntrack_count',
		'active_flow_count_tcp',
		'active_flow_count_udp',
		'active_flow_count_sctp',
		'inactive_flow_count',
		'new_flow_count',
		'lb_rule_count',
		'lb_rules_count',
		'lb_rules_per_service',
		'total_requests',
		'total_requests_per_service',
		'total_errors',
		'total_errors_per_service',
		'healthy_host_count',
		'unhealthy_host_count',
		'endpoint_health',
		'healthy_endpoints_count',
		'unhealthy_endpoints_count',
		'total_fw_drops',
		'total_fw_drops_per_rule',
		'firewall_drops_total',
		'firewall_drops_by_rule',
		'firewall_rules_count',
	];

	// LoxiLB Important Metrics (Performance monitoring)
	const importantMetrics = [
		'processed_bytes',
		'processed_bytes_total',
		'processed_packets',
		'processed_packets_total',
		'total_bytes',
		'total_packets',
		'requests_per_second_avg_1m',
		'requests_per_second_peak_1m',
		'bytes_per_second',
		'packets_per_second',
		'errors_per_second',
		'requests_per_second',
	];

	// LoxiLB Operational Metrics (Protocol-specific processing)
	const operationalMetrics = [
		'processed_tcp_bytes',
		'processed_udp_bytes',
		'processed_sctp_bytes',
		'processed_tcp_packets',
		'processed_udp_packets',
		'processed_sctp_packets',
	];

	// LoxiLB Historical Metrics (Trending and analysis)
	const historicalMetrics = [
		'total_bytes_per_service',
		'bytes_per_service',
		'total_packets_per_service',
		'requests_per_second_per_service',
		'lb_rule_interaction_bytes',
		'lb_rule_interaction_packets',
		'service_traffic_bytes',
		'endpoint_traffic_bytes',
		'service_distribution_ratio',
		'total_load_dists_per_service',
		'endpoint_load_dists_per_service',
		'consumed_lcus',
		'lcu_capacity_units_total',
		'lcu_utilization_ratio',
		'lcu_flow_component',
		'lcu_rule_component',
		'lcu_byte_component',
		'lcu_new_flows',
		'lcu_active_flows',
		'lcu_rule_count',
		'lcu_processed_bytes',
		'tcp_bytes',
		'udp_bytes',
		'sctp_bytes',
		'tcp_packets',
		'udp_packets',
		'sctp_packets',
		'tcp_bps',
		'udp_bps',
		'sctp_bps',
		'tcp_pps',
		'udp_pps',
		'sctp_pps',
	];

	// Combined available metrics for autocomplete
	const availableMetrics = [
		...criticalMetrics,
		...importantMetrics,
		...operationalMetrics,
		...historicalMetrics,
	];

	// Get metric priority and color
	const getMetricPriority = (metricName: string): {level: string, color: 'error' | 'warning' | 'info' | 'success', icon: string} => {
		const name = metricName.toLowerCase();
		if (criticalMetrics.includes(name)) return {level: 'CRITICAL', color: 'error', icon: '🔴'};
		if (importantMetrics.includes(name)) return {level: 'IMPORTANT', color: 'warning', icon: '🟡'};
		if (operationalMetrics.includes(name)) return {level: 'OPERATIONAL', color: 'info', icon: '🔵'};
		if (historicalMetrics.includes(name)) return {level: 'HISTORICAL', color: 'success', icon: '🟢'};
		return {level: 'UNKNOWN', color: 'info', icon: '⚪'};
	};

	// Categorize metrics based on LoxiLB metric definitions
	const categorizeMetric = (metricName: string): string => {
		const name = metricName.toLowerCase();
		
		// Critical metrics
		if (criticalMetrics.includes(name)) {
			if (name.includes('conntrack') || name.includes('flow')) return 'connection';
			if (name.includes('lb_') || name.includes('requests') || name.includes('errors')) return 'loadbalancer';
			if (name.includes('healthy') || name.includes('unhealthy') || name.includes('endpoint')) return 'health';
			if (name.includes('fw_') || name.includes('firewall')) return 'firewall';
			return 'critical';
		}
		
		// Important metrics
		if (importantMetrics.includes(name)) {
			if (name.includes('bytes') || name.includes('packets')) return 'traffic';
			return 'important';
		}
		
		// Operational metrics
		if (operationalMetrics.includes(name)) {
			return 'operational';
		}
		
		// Historical metrics
		if (historicalMetrics.includes(name)) {
			if (name.includes('lcu_')) return 'lcu';
			if (name.includes('tcp') || name.includes('udp') || name.includes('sctp')) return 'protocol';
			return 'historical';
		}
		
		// Fallback categorization
		if (name.includes('bytes') || name.includes('packets') || name.includes('bps') || name.includes('pps')) return 'traffic';
		if (name.includes('requests') || name.includes('errors') || name.includes('lb_')) return 'loadbalancer';
		if (name.includes('healthy') || name.includes('unhealthy') || name.includes('endpoint')) return 'health';
		if (name.includes('firewall') || name.includes('fw_')) return 'firewall';
		if (name.includes('flow') || name.includes('conntrack')) return 'connection';
		
		return 'all';
	};

	// Format metric names for display
	const formatMetricName = (metricName: string): string => {
		return metricName
			.replace(/_/g, ' ')
			.replace(/\b\w/g, l => l.toUpperCase())
			.replace(/Lb /g, 'LB ')
			.replace(/Tcp/g, 'TCP')
			.replace(/Udp/g, 'UDP')
			.replace(/Sctp/g, 'SCTP')
			.replace(/Lcu/g, 'LCU')
			.replace(/Fw /g, 'Firewall ');
	};

	// Transform historical data for visualization with pagination and filtering
	const historicalChartData = useMemo(() => {
		if (!historicalData.data?.data.length) return null;
		
		const groupedByMetric = historicalData.data.data.reduce((acc, point) => {
			if (!acc[point.metric_name]) acc[point.metric_name] = [];
			acc[point.metric_name].push({
				timestamp: point.timestamp * 1000,
				data: point.value,
			});
			return acc;
		}, {} as Record<string, any[]>);

		const allSeries = Object.entries(groupedByMetric).map(([metric, values]) => ({
			label: formatMetricName(metric),
			metric_name: metric,
			values: values.sort((a, b) => a.timestamp - b.timestamp),
			category: categorizeMetric(metric),
		}));

		// Filter by selected categories
		const filteredSeries = selectedMetricCategories.includes('all') 
			? allSeries 
			: allSeries.filter(series => selectedMetricCategories.includes(series.category));

		// Pagination
		const startIndex = (currentPage - 1) * metricsPerPage;
		const endIndex = startIndex + metricsPerPage;
		
		return {
			data: filteredSeries.slice(startIndex, endIndex),
			totalCount: filteredSeries.length,
			totalPages: Math.ceil(filteredSeries.length / metricsPerPage)
		};
	}, [historicalData.data, currentPage, metricsPerPage, selectedMetricCategories]);

	// Transform aggregate data for visualization with similar structure
	const aggregateChartData = useMemo(() => {
		if (!aggregateData.data?.data.length) return null;
		
		const groupedByMetric = aggregateData.data.data.reduce((acc, point) => {
			if (!acc[point.metric_name]) acc[point.metric_name] = [];
			acc[point.metric_name].push({
				timestamp: point.timestamp * 1000,
				data: point.value,
			});
			return acc;
		}, {} as Record<string, any[]>);

		const allSeries = Object.entries(groupedByMetric).map(([metric, values]) => ({
			label: formatMetricName(metric),
			metric_name: metric,
			values: values.sort((a, b) => a.timestamp - b.timestamp),
			category: categorizeMetric(metric),
		}));

		// Filter by selected categories
		const filteredSeries = selectedMetricCategories.includes('all') 
			? allSeries 
			: allSeries.filter(series => selectedMetricCategories.includes(series.category));

		// Pagination
		const startIndex = (currentPage - 1) * metricsPerPage;
		const endIndex = startIndex + metricsPerPage;
		
		return {
			data: filteredSeries.slice(startIndex, endIndex),
			totalCount: filteredSeries.length,
			totalPages: Math.ceil(filteredSeries.length / metricsPerPage)
		};
	}, [aggregateData.data, currentPage, metricsPerPage, selectedMetricCategories]);

	// Calculate trend indicators
	const getTrendIndicator = (values: any[]) => {
		if (values.length < 2) return { direction: 'stable', percentage: 0 };
		
		const start = values[0].data;
		const end = values[values.length - 1].data;
		const change = ((end - start) / start) * 100;
		
		return {
			direction: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
			percentage: Math.abs(change),
		};
	};

	const handleQueryHistorical = () => {
		historicalData.refetch();
		aggregateData.refetch();
	};

	return (
		<LocalizationProvider dateAdapter={AdapterDateFns}>
			<Box width="100%" height="100%" p={3}>
				<Box display="flex" alignItems="center" gap={2} mb={3}>
					<Timeline sx={{fontSize: 32, color: theme.palette.primary.main}} />
					<Typography variant="h4" fontWeight="bold">
						{t('Advanced Metrics Analytics')}
					</Typography>
					<Chip 
						label={t('Real-time')} 
						color="success" 
						variant="outlined"
						icon={<Speed />}
					/>
				</Box>

				<Grid container spacing={3}>
					{/* Enhanced Control Panel */}
					<Grid item xs={12}>
						<Paper sx={{p: 2, mb: 2}}>
							<Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
								<Box display="flex" alignItems="center" gap={2}>
									<FilterList sx={{color: theme.palette.primary.main}} />
									<Typography variant="h6" fontWeight="bold">
										{t('LoxiLB Metrics Control Panel')}
									</Typography>
									<IconButton
										onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
										size="small"
									>
										{showAdvancedFilters ? <ExpandLess /> : <ExpandMore />}
									</IconButton>
								</Box>
								<Box display="flex" alignItems="center" gap={2}>
									<FormControlLabel
										control={
											<Switch
												checked={autoRefresh}
												onChange={(e) => setAutoRefresh(e.target.checked)}
												color="primary"
											/>
										}
										label={t('Auto Refresh')}
									/>
									<Tooltip title={t('Switch View Mode')}>
										<IconButton onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
											{viewMode === 'grid' ? <ViewList /> : <ViewModule />}
										</IconButton>
									</Tooltip>
								</Box>
							</Box>

							{/* Metrics Overview Summary */}
							<Box sx={{mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1}}>
								<Typography variant="subtitle2" fontWeight="bold" mb={1}>
									📊 {t('Available LoxiLB Metrics')}
								</Typography>
								<Box display="flex" gap={2} flexWrap="wrap">
									<Chip icon={<span>🔴</span>} label={`Critical: ${criticalMetrics.length}`} size="small" color="error" variant="outlined" />
									<Chip icon={<span>🟡</span>} label={`Important: ${importantMetrics.length}`} size="small" color="warning" variant="outlined" />
									<Chip icon={<span>🔵</span>} label={`Operational: ${operationalMetrics.length}`} size="small" color="info" variant="outlined" />
									<Chip icon={<span>🟢</span>} label={`Historical: ${historicalMetrics.length}`} size="small" color="success" variant="outlined" />
									<Chip label={`Total: ${availableMetrics.length} metrics`} size="small" variant="filled" color="primary" />
								</Box>
							</Box>

							<Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)} sx={{mb: 2}}>
								<Tab label={`🔴 ${t('Critical Metrics')}`} />
								<Tab label={`📊 ${t('Performance Dashboard')}`} />
								<Tab label={`📈 ${t('Historical Trends')}`} />
								<Tab label={`⚙️ ${t('Advanced Analytics')}`} />
							</Tabs>

							<Collapse in={showAdvancedFilters}>
								<Grid container spacing={2} sx={{mt: 1}}>
									<Grid item xs={12} md={3}>
										<Autocomplete
											multiple
											options={metricCategories}
											getOptionLabel={(option) => option.label}
											value={metricCategories.filter(cat => selectedMetricCategories.includes(cat.value))}
											onChange={(_, newValue) => setSelectedMetricCategories(newValue.map(v => v.value))}
											renderInput={(params) => (
												<TextField {...params} label={t('Metric Categories')} size="small" />
											)}
										/>
									</Grid>
									<Grid item xs={12} md={3}>
										<Autocomplete
											options={availableMetrics}
											getOptionLabel={(option) => formatMetricName(option)}
											value={selectedMetrics}
											onChange={(_, newValue) => setSelectedMetrics(newValue || '')}
											renderOption={(props, option) => {
												const priority = getMetricPriority(option);
												return (
													<Box component="li" {...props} display="flex" alignItems="center" gap={1}>
														<Typography variant="caption">{priority.icon}</Typography>
														<Box>
															<Typography variant="body2">
																{formatMetricName(option)}
															</Typography>
															<Typography variant="caption" color="textSecondary">
																{priority.level} • {categorizeMetric(option).toUpperCase()}
															</Typography>
														</Box>
													</Box>
												);
											}}
											renderInput={(params) => (
												<TextField {...params} label={t('Specific LoxiLB Metrics')} size="small" />
											)}
										/>
									</Grid>
									<Grid item xs={12} md={2}>
										<FormControl fullWidth size="small">
											<InputLabel>{t('Items per Page')}</InputLabel>
											<Select
												value={metricsPerPage}
												onChange={(e) => setMetricsPerPage(Number(e.target.value))}
												label={t('Items per Page')}
											>
												<MenuItem value={3}>3</MenuItem>
												<MenuItem value={6}>6</MenuItem>
												<MenuItem value={9}>9</MenuItem>
												<MenuItem value={12}>12</MenuItem>
											</Select>
										</FormControl>
									</Grid>
									<Grid item xs={12} md={4}>
										<Box display="flex" alignItems="center" gap={1}>
											<Typography variant="body2" color="textSecondary">
												{t('Total metrics')}: {historicalChartData?.totalCount || 0}
											</Typography>
											{historicalChartData?.totalPages && historicalChartData.totalPages > 1 && (
												<Pagination
													count={historicalChartData.totalPages}
													page={currentPage}
													onChange={(_, page) => setCurrentPage(page)}
													size="small"
													color="primary"
												/>
											)}
										</Box>
									</Grid>
								</Grid>
							</Collapse>
						</Paper>
					</Grid>

					{/* Critical Metrics Quick View */}
					{currentTab === 0 && (
						<Grid item xs={12}>
							<Card sx={{mb: 2, background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)', color: 'white'}}>
								<CardContent>
									<Typography variant="h6" fontWeight="bold" gutterBottom display="flex" alignItems="center" gap={1}>
										🔴 {t('Critical Metrics Monitor')} - {t('Real-time Status')}
									</Typography>
									<Grid container spacing={2}>
										{criticalMetrics.slice(0, 8).map((metric, index) => (
											<Grid item xs={6} sm={4} md={3} key={metric}>
												<Box sx={{p: 1, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 1}}>
													<Typography variant="caption" sx={{opacity: 0.9}}>
														{formatMetricName(metric)}
													</Typography>
													<Typography variant="h6" fontWeight="bold">
														{/* This would be populated with real data */}
														{Math.floor(Math.random() * 1000)}
													</Typography>
												</Box>
											</Grid>
										))}
									</Grid>
									<Alert severity="info" sx={{mt: 2, bgcolor: 'rgba(255,255,255,0.9)', color: 'rgba(0,0,0,0.8)'}}>
										💡 {t('Critical metrics require immediate attention if values exceed thresholds')}
									</Alert>
								</CardContent>
							</Card>
						</Grid>
					)}

					{/* KPI Overview Cards */}
					<Grid item xs={12}>
						<Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
							<BarChart />
							{t('Key Performance Indicators')}
						</Typography>
					</Grid>

					{/* Enhanced Live Metrics Card */}
					<Grid item xs={12} md={3}>
						<Card sx={{height: 200, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}}>
							<CardContent sx={{color: 'white', height: '100%', display: 'flex', flexDirection: 'column'}}>
								<Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
									<Typography variant="h6" fontWeight="bold">
										{t('Live Metrics')}
									</Typography>
									<Speed sx={{fontSize: 28}} />
								</Box>
								
								{liveMetrics.data ? (
									<Box flex={1} display="flex" flexDirection="column" justifyContent="space-between">
										<Box>
											<Typography variant="h4" fontWeight="bold">
												{liveMetrics.data.total_metrics}
											</Typography>
											<Typography variant="body2" sx={{opacity: 0.9}}>
												{t('Total Metrics')}
											</Typography>
										</Box>
										
										<Box>
											<Box display="flex" alignItems="center" gap={1} mb={1}>
												<Typography variant="body2">
													{t('Response Time')}: {liveMetrics.data.response_time_ms?.toFixed(2)} ms
												</Typography>
												{(liveMetrics.data.response_time_ms || 0) < 100 ? 
													<TrendingUp color="inherit" sx={{fontSize: 16}} /> : 
													<TrendingDown color="inherit" sx={{fontSize: 16}} />
												}
											</Box>
											<LinearProgress 
												variant="determinate" 
												value={Math.min((liveMetrics.data.response_time_ms || 0) / 5, 100)} 
												sx={{bgcolor: 'rgba(255,255,255,0.3)', '& .MuiLinearProgress-bar': {bgcolor: 'white'}}}
											/>
										</Box>
									</Box>
								) : (
									<Box display="flex" alignItems="center" justifyContent="center" flex={1}>
										<Typography variant="body2">Loading...</Typography>
									</Box>
								)}
							</CardContent>
						</Card>
					</Grid>

					{/* Enhanced Cache Stats Card */}
					<Grid item xs={12} md={3}>
						<Card sx={{height: 200, background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'}}>
							<CardContent sx={{color: 'white', height: '100%', display: 'flex', flexDirection: 'column'}}>
								<Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
									<Typography variant="h6" fontWeight="bold">
										{t('Cache Performance')}
									</Typography>
									<Box 
										sx={{
											width: 32, 
											height: 32, 
											borderRadius: '50%', 
											bgcolor: 'rgba(255,255,255,0.2)',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center'
										}}
									>
										📊
									</Box>
								</Box>
								
								{cacheStats.data ? (
									<Box flex={1} display="flex" flexDirection="column" justifyContent="space-between">
										<Box>
											<Typography variant="h4" fontWeight="bold">
												{(cacheStats.data.average_utilization * 100).toFixed(1)}%
											</Typography>
											<Typography variant="body2" sx={{opacity: 0.9}}>
												{t('Cache Utilization')}
											</Typography>
										</Box>
										
										<Box>
											<Typography variant="body2" mb={1}>
												{t('Memory')}: {formatBytes(cacheStats.data.total_memory_bytes)}
											</Typography>
											<Typography variant="body2">
												{t('Buffers')}: {cacheStats.data.total_buffers.toLocaleString()}
											</Typography>
										</Box>
									</Box>
								) : (
									<Box display="flex" alignItems="center" justifyContent="center" flex={1}>
										<Typography variant="body2">Loading...</Typography>
									</Box>
								)}
							</CardContent>
						</Card>
					</Grid>

					{/* Enhanced System Health Card */}
					<Grid item xs={12} md={3}>
						<Card sx={{
							height: 200, 
							background: systemHealth.data?.status === 'healthy' ? 
								'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' :
								'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
						}}>
							<CardContent sx={{color: 'white', height: '100%', display: 'flex', flexDirection: 'column'}}>
								<Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
									<Typography variant="h6" fontWeight="bold">
										{t('System Health')}
									</Typography>
									<Box 
										sx={{
											width: 32, 
											height: 32, 
											borderRadius: '50%', 
											bgcolor: 'rgba(255,255,255,0.2)',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center'
										}}
									>
										{systemHealth.data?.status === 'healthy' ? '💚' : '⚠️'}
									</Box>
								</Box>
								
								{systemHealth.data ? (
									<Box flex={1} display="flex" flexDirection="column" justifyContent="space-between">
										<Box>
											<Typography variant="h4" fontWeight="bold">
												{systemHealth.data.status.toUpperCase()}
											</Typography>
											<Typography variant="body2" sx={{opacity: 0.9}}>
												{t('System Status')}
											</Typography>
										</Box>
										
										<Box>
											<Typography variant="body2" mb={1}>
												{t('Memory')}: {systemHealth.data.memory_usage_mb.toFixed(1)} MB
											</Typography>
											<Typography variant="body2">
												{t('Utilization')}: {(systemHealth.data.average_utilization * 100).toFixed(1)}%
											</Typography>
										</Box>
									</Box>
								) : (
									<Box display="flex" alignItems="center" justifyContent="center" flex={1}>
										<Typography variant="body2">Loading...</Typography>
									</Box>
								)}
							</CardContent>
						</Card>
					</Grid>

					{/* Query Performance Card */}
					<Grid item xs={12} md={3}>
						<Card sx={{height: 200, background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'}}>
							<CardContent sx={{color: 'rgba(0,0,0,0.8)', height: '100%', display: 'flex', flexDirection: 'column'}}>
								<Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
									<Typography variant="h6" fontWeight="bold">
										{t('Query Performance')}
									</Typography>
									<Timeline sx={{fontSize: 28}} />
								</Box>
								
								<Box flex={1} display="flex" flexDirection="column" justifyContent="space-between">
									<Box>
										<Typography variant="h4" fontWeight="bold">
											{historicalData.data?.query_time || '0ms'}
										</Typography>
										<Typography variant="body2" sx={{opacity: 0.8}}>
											{t('Last Query Time')}
										</Typography>
									</Box>
									
									<Box>
										<Typography variant="body2" mb={1}>
											{t('Historical')}: {historicalData.data?.data.length || 0} records
										</Typography>
										<Typography variant="body2">
											{t('Aggregated')}: {aggregateData.data?.data.length || 0} points
										</Typography>
									</Box>
								</Box>
							</CardContent>
						</Card>
					</Grid>

					{/* Historical Query Section */}
					<Grid item xs={12} sx={{mt: 2}}>
						<Box display="flex" alignItems="center" gap={2} mb={2}>
							<Timeline sx={{color: theme.palette.primary.main}} />
							<Typography variant="h6" fontWeight="bold">
								{t('Historical Analytics & Trends')}
							</Typography>
						</Box>
					</Grid>

					{/* Query Parameters */}
					<Grid item xs={12}>
						<Paper sx={{p: 3}}>
							<Grid container spacing={2} alignItems="center">
								<Grid item xs={12} md={2}>
									<DateTimePicker
										label={t('Start Time')}
										value={timeStart}
										onChange={(newValue) => newValue && setTimeStart(newValue)}
										slotProps={{
											textField: {
												fullWidth: true,
												size: 'small'
											}
										}}
									/>
								</Grid>
								<Grid item xs={12} md={2}>
									<DateTimePicker
										label={t('End Time')}
										value={timeEnd}
										onChange={(newValue) => newValue && setTimeEnd(newValue)}
										slotProps={{
											textField: {
												fullWidth: true,
												size: 'small'
											}
										}}
									/>
								</Grid>
								<Grid item xs={12} md={2}>
									<TextField
										label={t('Metrics Filter')}
										value={selectedMetrics}
										onChange={(e) => setSelectedMetrics(e.target.value)}
										placeholder="metric1,metric2"
										fullWidth
										size="small"
									/>
								</Grid>
								<Grid item xs={12} md={2}>
									<FormControl fullWidth size="small">
										<InputLabel>{t('Aggregation')}</InputLabel>
										<Select
											value={aggregationType}
											onChange={(e) => setAggregationType(e.target.value as any)}
											label={t('Aggregation')}
										>
											<MenuItem value="avg">{t('Average')}</MenuItem>
											<MenuItem value="sum">{t('Sum')}</MenuItem>
											<MenuItem value="max">{t('Maximum')}</MenuItem>
											<MenuItem value="min">{t('Minimum')}</MenuItem>
											<MenuItem value="p95">{t('95th Percentile')}</MenuItem>
											<MenuItem value="p99">{t('99th Percentile')}</MenuItem>
										</Select>
									</FormControl>
								</Grid>
								<Grid item xs={12} md={2}>
									<FormControl fullWidth size="small">
										<InputLabel>{t('Interval')}</InputLabel>
										<Select
											value={aggregationInterval}
											onChange={(e) => setAggregationInterval(e.target.value as any)}
											label={t('Interval')}
										>
											<MenuItem value="1h">{t('1 Hour')}</MenuItem>
											<MenuItem value="1d">{t('1 Day')}</MenuItem>
											<MenuItem value="1w">{t('1 Week')}</MenuItem>
											<MenuItem value="1m">{t('1 Month')}</MenuItem>
										</Select>
									</FormControl>
								</Grid>
								<Grid item xs={12} md={2}>
									<Button
										variant="contained"
										onClick={handleQueryHistorical}
										fullWidth
										disabled={historicalData.isLoading || aggregateData.isLoading}
									>
										{t('Query')}
									</Button>
								</Grid>
							</Grid>
						</Paper>
					</Grid>

					{/* Enhanced Historical Results with Charts */}
					<Grid item xs={12} md={6}>
						<Card sx={{height: 400}}>
							<CardContent>
								<Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
									<Typography variant="h6" fontWeight="bold">
										{t('Historical Trends')}
									</Typography>
									{historicalData.isLoading && <LinearProgress sx={{width: 100}} />}
								</Box>
								
								{historicalChartData && historicalChartData.data.length > 0 ? (
									<Box sx={{height: 300}}>
										{historicalChartData.data.map((series: any, index: number) => {
											const trend = getTrendIndicator(series.values);
											const priority = getMetricPriority(series.metric_name);
											return (
												<Box key={index} mb={3}>
													<Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
														<Box display="flex" alignItems="center" gap={1}>
															<Typography variant="subtitle2" fontWeight="bold">
																{series.label}
															</Typography>
															<Typography variant="caption">
																{priority.icon}
															</Typography>
														</Box>
														<Box display="flex" alignItems="center" gap={1}>
															<Chip 
																label={priority.level}
																size="small"
																variant="filled"
																color={priority.color}
															/>
															<Chip 
																label={series.category.toUpperCase()}
																size="small"
																variant="outlined"
																color="primary"
															/>
															{trend.direction === 'up' && <TrendingUp color="success" />}
															{trend.direction === 'down' && <TrendingDown color="error" />}
															<Typography variant="caption" color={
																trend.direction === 'up' ? 'success.main' : 
																trend.direction === 'down' ? 'error.main' : 'text.secondary'
															}>
																{trend.percentage.toFixed(1)}%
															</Typography>
														</Box>
													</Box>
													<Box sx={{height: viewMode === 'grid' ? 80 : 120}}>
														{viewMode === 'grid' ? (
															<MiniLineGraph data={series} />
														) : (
															<SimpleLineGraph data={series} />
														)}
													</Box>
												</Box>
											);
										})}
									</Box>
								) : (
									<Box display="flex" alignItems="center" justifyContent="center" sx={{height: 300}}>
										{historicalData.isLoading ? (
											<Typography variant="body2" color="textSecondary">
												{t('Loading historical data...')}
											</Typography>
										) : (
											<Typography variant="body2" color="textSecondary">
												{t('No historical data available. Try adjusting your query parameters.')}
											</Typography>
										)}
									</Box>
								)}
								
								{historicalData.data && (
									<Alert severity="info" sx={{mt: 2}}>
										{t('Query returned')} {historicalData.data.data.length} {t('records in')} {historicalData.data.query_time}
									</Alert>
								)}
							</CardContent>
						</Card>
					</Grid>

					{/* Enhanced Aggregated Results with Charts */}
					<Grid item xs={12} md={6}>
						<Card sx={{height: 400}}>
							<CardContent>
								<Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
									<Typography variant="h6" fontWeight="bold">
										{t('Aggregated Analytics')} ({aggregationType.toUpperCase()})
									</Typography>
									{aggregateData.isLoading && <LinearProgress sx={{width: 100}} />}
								</Box>
								
								{aggregateChartData && aggregateChartData.data.length > 0 ? (
									<Box sx={{height: 300}}>
										{aggregateChartData.data.map((series: any, index: number) => {
											const trend = getTrendIndicator(series.values);
											const priority = getMetricPriority(series.metric_name);
											const isRateMetric = series.label.toLowerCase().includes('rate') || 
															   series.label.toLowerCase().includes('bps') ||
															   series.label.toLowerCase().includes('pps') ||
															   series.metric_name.includes('_per_second');
											return (
												<Box key={index} mb={3}>
													<Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
														<Box display="flex" alignItems="center" gap={1}>
															<Typography variant="subtitle2" fontWeight="bold">
																{series.label}
															</Typography>
															<Typography variant="caption">
																{priority.icon}
															</Typography>
														</Box>
														<Box display="flex" alignItems="center" gap={1}>
															<Chip 
																label={`${aggregationInterval} ${aggregationType}`}
																size="small"
																variant="outlined"
															/>
															<Chip 
																label={priority.level}
																size="small"
																variant="filled"
																color={priority.color}
															/>
															<Chip 
																label={series.category.toUpperCase()}
																size="small"
																variant="filled"
																color="secondary"
															/>
															{trend.direction === 'up' && <TrendingUp color="success" />}
															{trend.direction === 'down' && <TrendingDown color="error" />}
														</Box>
													</Box>
													<Box sx={{height: viewMode === 'grid' ? 80 : 120}}>
														{isRateMetric ? (
															<RateLineGraph 
																data={series} 
																unit={series.label.toLowerCase().includes('packet') || series.metric_name.includes('pps') ? 'pps' : 'bps'}
																width={viewMode === 'grid' ? 300 : 400}
																height={viewMode === 'grid' ? 80 : 120}
															/>
														) : viewMode === 'grid' ? (
															<MiniLineGraph data={series} />
														) : (
															<SimpleLineGraph data={series} />
														)}
													</Box>
												</Box>
											);
										})}
									</Box>
								) : (
									<Box display="flex" alignItems="center" justifyContent="center" sx={{height: 300}}>
										{aggregateData.isLoading ? (
											<Typography variant="body2" color="textSecondary">
												{t('Loading aggregated data...')}
											</Typography>
										) : (
											<Typography variant="body2" color="textSecondary">
												{t('No aggregated data available. Try adjusting your query parameters.')}
											</Typography>
										)}
									</Box>
								)}
								
								{aggregateData.data && (
									<Alert severity="success" sx={{mt: 2}}>
										{t('Aggregation returned')} {aggregateData.data.data.length} {t('data points in')} {aggregateData.data.query_time}
									</Alert>
								)}
							</CardContent>
						</Card>
					</Grid>

					{/* Enhanced Performance Summary Dashboard */}
					<Grid item xs={12}>
						<Card sx={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white'}}>
							<CardContent>
								<Typography variant="h6" fontWeight="bold" gutterBottom display="flex" alignItems="center" gap={1}>
									<Speed />
									{t('Performance Summary Dashboard')}
								</Typography>
								<Grid container spacing={3} sx={{mt: 1}}>
									<Grid item xs={6} md={3}>
										<Box textAlign="center">
											<Typography variant="h4" fontWeight="bold">
												{liveMetrics.data?.response_time_ms?.toFixed(0) || '0'}
											</Typography>
											<Typography variant="body2" sx={{opacity: 0.9}}>
												{t('Response Time (ms)')}
											</Typography>
											<LinearProgress 
												variant="determinate" 
												value={Math.min((liveMetrics.data?.response_time_ms || 0) / 10, 100)} 
												sx={{
													mt: 1,
													bgcolor: 'rgba(255,255,255,0.3)', 
													'& .MuiLinearProgress-bar': {bgcolor: 'white'}
												}}
											/>
										</Box>
									</Grid>
									<Grid item xs={6} md={3}>
										<Box textAlign="center">
											<Typography variant="h4" fontWeight="bold">
												{cacheStats.data ? (cacheStats.data.average_utilization * 100).toFixed(0) : '0'}%
											</Typography>
											<Typography variant="body2" sx={{opacity: 0.9}}>
												{t('Cache Utilization')}
											</Typography>
											<LinearProgress 
												variant="determinate" 
												value={cacheStats.data ? cacheStats.data.average_utilization * 100 : 0} 
												sx={{
													mt: 1,
													bgcolor: 'rgba(255,255,255,0.3)', 
													'& .MuiLinearProgress-bar': {bgcolor: 'white'}
												}}
											/>
										</Box>
									</Grid>
									<Grid item xs={6} md={3}>
										<Box textAlign="center">
											<Typography variant="h4" fontWeight="bold" 
												color={systemHealth.data?.status === 'healthy' ? 'inherit' : '#ffeb3b'}>
												{systemHealth.data?.status?.toUpperCase() || 'UNKNOWN'}
											</Typography>
											<Typography variant="body2" sx={{opacity: 0.9}}>
												{t('System Status')}
											</Typography>
											<Box display="flex" justifyContent="center" mt={1}>
												{systemHealth.data?.status === 'healthy' ? '✅' : '⚠️'}
											</Box>
										</Box>
									</Grid>
									<Grid item xs={6} md={3}>
										<Box textAlign="center">
											<Typography variant="h4" fontWeight="bold">
												{liveMetrics.data?.total_metrics?.toLocaleString() || '0'}
											</Typography>
											<Typography variant="body2" sx={{opacity: 0.9}}>
												{t('Active Metrics')}
											</Typography>
											<Typography variant="caption" sx={{opacity: 0.7, display: 'block', mt: 1}}>
												{t('Real-time monitoring')}
											</Typography>
										</Box>
									</Grid>
								</Grid>
							</CardContent>
						</Card>
					</Grid>
				</Grid>
			</Box>
		</LocalizationProvider>
	);
}
