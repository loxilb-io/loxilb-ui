//---------------------------------------------------------
// System Gauges Visualization Card  
//---------------------------------------------------------
import {
	Box,
	Typography,
	Grid,
	Chip,
	Stack,
	Tooltip,
	IconButton,
	useTheme,
	alpha,
	Paper,
	Card,
	CardContent
} from '@mui/material';
import {
	Refresh as RefreshIcon,
	DeviceHub as DeviceHubIcon,
	Speed as SpeedIcon,
	Security as SecurityIcon,
	Timeline as TimelineIcon,
	TrendingUp as TrendingUpIcon,
	Warning as WarningIcon,
	CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import {
	GaugeContainer,
	GaugeValueArc,
	GaugeReferenceArc
} from '@mui/x-charts/Gauge';
import {formatBytes} from 'common';
import {t} from 'i18next';
import {useMemo, useState, useEffect} from 'react';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';

//---------------------------------------------------------
// System Gauge Interfaces
//---------------------------------------------------------
interface SystemGauge {
	id: string;
	label: string;
	value: number;
	max: number;
	unit: string;
	category: 'load_balancing' | 'connections' | 'security' | 'throughput';
	thresholds: {
		good: number;
		warning: number;
	};
	icon: React.ReactNode;
	description: string;
}

//---------------------------------------------------------
// Generate Mock System Gauge Data
//---------------------------------------------------------
const generateSystemGauges = (): SystemGauge[] => {
	return [
		{
			id: 'active_connections',
			label: t('Active Connections'),
			value: 1247 + Math.floor(Math.random() * 500),
			max: 2000,
			unit: '',
			category: 'connections',
			thresholds: { good: 1500, warning: 1800 },
			icon: <DeviceHubIcon />,
			description: t('Current active client connections')
		},
		{
			id: 'request_rate',
			label: t('Requests/sec'),
			value: 850 + Math.floor(Math.random() * 300),
			max: 1500,
			unit: '/s',
			category: 'throughput',
			thresholds: { good: 1000, warning: 1300 },
			icon: <SpeedIcon />,
			description: t('HTTP requests processed per second')
		},
		{
			id: 'load_distribution',
			label: t('Load Balance'),
			value: 75 + Math.floor(Math.random() * 20),
			max: 100,
			unit: '%',
			category: 'load_balancing',
			thresholds: { good: 85, warning: 95 },
			icon: <TimelineIcon />,
			description: t('Load distribution efficiency')
		},
		{
			id: 'response_time',
			label: t('Response Time'),
			value: 45 + Math.floor(Math.random() * 30),
			max: 200,
			unit: 'ms',
			category: 'throughput',
			thresholds: { good: 100, warning: 150 },
			icon: <TrendingUpIcon />,
			description: t('Average response time')
		},
		{
			id: 'error_rate',
			label: t('Error Rate'),
			value: 2.1 + Math.random() * 1.5,
			max: 10,
			unit: '%',
			category: 'security',
			thresholds: { good: 5, warning: 8 },
			icon: <WarningIcon />,
			description: t('HTTP error rate percentage')
		},
		{
			id: 'security_events',
			label: t('Security Score'),
			value: 88 + Math.floor(Math.random() * 10),
			max: 100,
			unit: '/100',
			category: 'security',
			thresholds: { good: 90, warning: 70 },
			icon: <SecurityIcon />,
			description: t('Overall security health score')
		}
	];
};

//---------------------------------------------------------
// Mini Gauge Component
//---------------------------------------------------------
interface MiniGaugeProps {
	gauge: SystemGauge;
	size: number;
}

function MiniGauge({gauge, size}: MiniGaugeProps) {
	const theme = useTheme();
	const [animatedValue, setAnimatedValue] = useState(0);

	// Animate gauge value
	useEffect(() => {
		const timer = setTimeout(() => {
			setAnimatedValue(gauge.value);
		}, Math.random() * 1000 + 200); // Staggered animation
		return () => clearTimeout(timer);
	}, [gauge.value]);

	const getStatus = () => {
		if (gauge.category === 'security' && gauge.id === 'error_rate') {
			// For error rate, lower is better
			if (gauge.value <= gauge.thresholds.good) return 'good';
			if (gauge.value <= gauge.thresholds.warning) return 'warning';
			return 'critical';
		}
		
		if (gauge.value >= gauge.thresholds.good) return 'good';
		if (gauge.value >= gauge.thresholds.warning) return 'warning';
		return 'critical';
	};

	const getStatusColor = () => {
		const status = getStatus();
		switch (status) {
			case 'good': return theme.palette.success.main;
			case 'warning': return theme.palette.warning.main;
			case 'critical': return theme.palette.error.main;
			default: return theme.palette.primary.main;
		}
	};

	const getCategoryColor = () => {
		switch (gauge.category) {
			case 'load_balancing': return theme.palette.primary.main;
			case 'connections': return theme.palette.info.main;
			case 'security': return theme.palette.secondary.main;
			case 'throughput': return theme.palette.success.main;
			default: return theme.palette.primary.main;
		}
	};

	return (
		<Card 
			variant="outlined" 
			sx={{ 
				height: '100%', 
				bgcolor: alpha(getCategoryColor(), 0.02),
				border: `1px solid ${alpha(getCategoryColor(), 0.2)}`,
				transition: 'all 0.3s ease',
				'&:hover': {
					bgcolor: alpha(getCategoryColor(), 0.05),
					transform: 'translateY(-2px)',
					boxShadow: 2
				}
			}}
		>
			<CardContent sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
				{/* Category Icon */}
				<Box display="flex" alignItems="center" gap={1} mb={1}>
					<Box color={getCategoryColor()}>
						{gauge.icon}
					</Box>
					<Chip 
						label={gauge.category.replace('_', ' ').toUpperCase()} 
						size="small" 
						variant="outlined"
						sx={{ 
							fontSize: '0.6rem', 
							height: 20,
							color: getCategoryColor(),
							borderColor: getCategoryColor()
						}}
					/>
				</Box>

				{/* Mini Gauge */}
				<Box position="relative" display="flex" justifyContent="center" alignItems="center" flexGrow={1}>
					<GaugeContainer
						width={size}
						height={size}
						startAngle={-90}
						endAngle={90}
						value={animatedValue}
						valueMax={gauge.max}
					>
						<GaugeReferenceArc fill={alpha(theme.palette.divider, 0.3)} />
						<GaugeValueArc fill={getStatusColor()} />
					</GaugeContainer>
					
					{/* Center Value */}
					<Box 
						position="absolute" 
						display="flex" 
						flexDirection="column" 
						alignItems="center"
						top="60%"
						left="50%"
						sx={{ transform: 'translate(-50%, -50%)' }}
					>
						<Typography variant="body2" fontWeight="bold" color={getStatusColor()}>
							{gauge.id === 'error_rate' ? animatedValue.toFixed(1) : Math.round(animatedValue)}
							{gauge.unit}
						</Typography>
					</Box>
				</Box>

				{/* Label and Status */}
				<Box textAlign="center" mt={1}>
					<Typography variant="body2" fontWeight="medium" noWrap>
						{gauge.label}
					</Typography>
					<Box display="flex" alignItems="center" justifyContent="center" gap={0.5} mt={0.5}>
						{getStatus() === 'good' ? (
							<CheckCircleIcon sx={{ fontSize: 12, color: 'success.main' }} />
						) : getStatus() === 'warning' ? (
							<WarningIcon sx={{ fontSize: 12, color: 'warning.main' }} />
						) : (
							<WarningIcon sx={{ fontSize: 12, color: 'error.main' }} />
						)}
						<Typography variant="caption" color="text.secondary">
							{getStatus().toUpperCase()}
						</Typography>
					</Box>
				</Box>

				{/* Description Tooltip */}
				<Tooltip title={gauge.description} placement="bottom">
					<Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.7rem' }}>
						{gauge.description.length > 25 ? `${gauge.description.substring(0, 25)}...` : gauge.description}
					</Typography>
				</Tooltip>
			</CardContent>
		</Card>
	);
}

//---------------------------------------------------------
// System Status Summary Component
//---------------------------------------------------------
interface SystemStatusProps {
	gauges: SystemGauge[];
}

function SystemStatusSummary({gauges}: SystemStatusProps) {
	const theme = useTheme();

	const statusCounts = useMemo(() => {
		let good = 0, warning = 0, critical = 0;
		
		gauges.forEach(gauge => {
			if (gauge.category === 'security' && gauge.id === 'error_rate') {
				if (gauge.value <= gauge.thresholds.good) good++;
				else if (gauge.value <= gauge.thresholds.warning) warning++;
				else critical++;
			} else {
				if (gauge.value >= gauge.thresholds.good) good++;
				else if (gauge.value >= gauge.thresholds.warning) warning++;
				else critical++;
			}
		});
		
		return { good, warning, critical };
	}, [gauges]);

	const overallHealth = Math.round((statusCounts.good / gauges.length) * 100);

	return (
		<Paper 
			variant="outlined" 
			sx={{ 
				p: 2, 
				height: '100%',
				background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)}, ${alpha(theme.palette.secondary.main, 0.05)})`
			}}
		>
			<Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
				<DeviceHubIcon color="primary" />
				{t('System Health')}
			</Typography>

			<Box textAlign="center" mb={2}>
				<Typography variant="h3" fontWeight="bold" color="primary.main">
					{overallHealth}%
				</Typography>
				<Typography variant="body2" color="text.secondary">
					{t('Overall System Health')}
				</Typography>
			</Box>

			<Grid container spacing={2} mb={2}>
				<Grid item xs={4}>
					<Box textAlign="center">
						<Typography variant="h5" color="success.main" fontWeight="bold">
							{statusCounts.good}
						</Typography>
						<Typography variant="caption" color="text.secondary">
							{t('Good')}
						</Typography>
					</Box>
				</Grid>
				<Grid item xs={4}>
					<Box textAlign="center">
						<Typography variant="h5" color="warning.main" fontWeight="bold">
							{statusCounts.warning}
						</Typography>
						<Typography variant="caption" color="text.secondary">
							{t('Warning')}
						</Typography>
					</Box>
				</Grid>
				<Grid item xs={4}>
					<Box textAlign="center">
						<Typography variant="h5" color="error.main" fontWeight="bold">
							{statusCounts.critical}
						</Typography>
						<Typography variant="caption" color="text.secondary">
							{t('Critical')}
						</Typography>
					</Box>
				</Grid>
			</Grid>

			<Box mt={2}>
				<Typography variant="body2" color="text.secondary" textAlign="center">
					{statusCounts.critical > 0 
						? t('Immediate attention required') 
						: statusCounts.warning > 0 
						? t('Some components need monitoring')
						: t('All systems operating normally')
					}
				</Typography>
			</Box>
		</Paper>
	);
}

//---------------------------------------------------------
// Main System Gauges Card
//---------------------------------------------------------
export default function SystemGaugesCard(props: {instance: IInstance | null}) {
	const {instance} = props;
	const [systemGauges, setSystemGauges] = useState<SystemGauge[]>([]);

	// Generate system gauges data and update periodically
	useEffect(() => {
		const updateGauges = () => {
			setSystemGauges(generateSystemGauges());
		};

		updateGauges();
		const interval = setInterval(updateGauges, 5000); // Update every 5 seconds
		return () => clearInterval(interval);
	}, []);

	return (
		<CardBase title={t('System Gauges')}>
			<Box height="100%" display="flex" flexDirection="column">
				{/* Header with Refresh */}
				<Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
					<Typography variant="body2" color="text.secondary">
						{t('Real-time system performance monitoring')}
					</Typography>
					<Tooltip title={t('Refresh Gauges')}>
						<IconButton 
							size="small" 
							onClick={() => setSystemGauges(generateSystemGauges())}
						>
							<RefreshIcon />
						</IconButton>
					</Tooltip>
				</Box>

				{/* Gauges Grid */}
				<Grid container spacing={2} flexGrow={1}>
					{/* System Status Summary */}
					<Grid item xs={4}>
						<SystemStatusSummary gauges={systemGauges} />
					</Grid>

					{/* Individual Gauges */}
					<Grid item xs={8}>
						<Grid container spacing={2} height="100%">
							{systemGauges.map((gauge) => (
								<Grid item xs={4} key={gauge.id}>
									<MiniGauge gauge={gauge} size={80} />
								</Grid>
							))}
						</Grid>
					</Grid>
				</Grid>
			</Box>
		</CardBase>
	);
}