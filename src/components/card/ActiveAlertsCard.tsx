//---------------------------------------------------------
// Import statements and dependencies
//---------------------------------------------------------
import {
	Box, 
	Typography, 
	Chip, 
	Grid, 
	Button, 
	IconButton,
	Stack,
	Alert,
	AlertTitle,
	Divider,
	Tooltip,
	CircularProgress
} from '@mui/material';
import {
	Warning as WarningIcon,
	Error as ErrorIcon,
	Info as InfoIcon,
	CheckCircle as CheckCircleIcon,
	Notifications as NotificationsIcon,
	NotificationImportant as NotificationImportantIcon,
	Refresh as RefreshIcon
} from '@mui/icons-material';
import {useAllAlertsMain, resolveAlert} from 'hooks/query/alertHooks';
import {t} from 'i18next';
import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {IInstance} from 'types/oam';
import {IAlert} from 'types/alerts';
import CardBase from './CardBase';

//---------------------------------------------------------
// Helper Functions
//---------------------------------------------------------
const getSeverityColor = (severity: string): 'error' | 'warning' | 'info' => {
	switch (severity.toLowerCase()) {
		case 'critical': return 'error';
		case 'warning': return 'warning';
		case 'info': return 'info';
		default: return 'info';
	}
};

const getSeverityIcon = (severity: string) => {
	switch (severity.toLowerCase()) {
		case 'critical': return <ErrorIcon />;
		case 'warning': return <WarningIcon />;
		case 'info': return <InfoIcon />;
		default: return <InfoIcon />;
	}
};

const formatTimestamp = (timestamp: number): string => {
	const now = Date.now();
	const diff = now - (timestamp * 1000); // Convert to milliseconds
	const minutes = Math.floor(diff / (1000 * 60));
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	
	if (days > 0) return `${days}d ago`;
	if (hours > 0) return `${hours}h ago`;
	if (minutes > 0) return `${minutes}m ago`;
	return 'Just now';
};

//---------------------------------------------------------
// Alert Item Component
//---------------------------------------------------------
interface AlertItemProps {
	alert: IAlert;
	instance: IInstance;
	onResolve: () => void;
}

function AlertItem({alert, instance, onResolve}: AlertItemProps) {
	const [resolving, setResolving] = useState(false);

	const handleResolve = async () => {
		setResolving(true);
		try {
			await resolveAlert(instance, {
				alert_id: alert.id,
				resolved_by: 'dashboard_user',
				reason: 'Resolved from dashboard'
			});
			onResolve();
		} catch (error) {
			console.error('Failed to resolve alert:', error);
		} finally {
			setResolving(false);
		}
	};

	return (
		<Alert 
			severity={getSeverityColor(alert.severity)} 
			sx={{ 
				mb: 1, 
				cursor: 'pointer',
				'&:hover': { bgcolor: 'action.hover' }
			}}
			action={
				<Button
					size="small"
					color="inherit"
					onClick={handleResolve}
					disabled={resolving}
					startIcon={resolving ? <CircularProgress size={12} /> : <CheckCircleIcon />}
				>
					{resolving ? t('Resolving...') : t('Resolve')}
				</Button>
			}
		>
			<AlertTitle>
				<Box display="flex" alignItems="center" gap={1}>
					<Typography variant="body2" fontWeight="bold">
						{alert.rule_name}
					</Typography>
					<Chip 
						label={alert.metric_name} 
						size="small" 
						variant="outlined" 
						color={getSeverityColor(alert.severity)}
					/>
				</Box>
			</AlertTitle>
			<Typography variant="body2" color="text.secondary">
				{alert.message}
			</Typography>
			<Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
				<Typography variant="caption" color="text.secondary">
					{t('Triggered')}: {formatTimestamp(alert.triggered_at)}
				</Typography>
				<Typography variant="caption" color="text.secondary">
					ID: {alert.id.substring(0, 8)}...
				</Typography>
			</Box>
		</Alert>
	);
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function ActiveAlertsCard(props: {instance: IInstance | null}) {
	const {instance} = props;
	const navigate = useNavigate();
	
	const {data: alertsResponse, isLoading, error, refetch} = useAllAlertsMain(instance);
	const allAlerts = alertsResponse?.data || [];
	
	// Filter for active/firing alerts only
	const alerts = allAlerts.filter(alert => alert.status === 'firing');

	// Group alerts by severity
	const criticalAlerts = alerts.filter(alert => alert.severity.toLowerCase() === 'critical');
	const warningAlerts = alerts.filter(alert => alert.severity.toLowerCase() === 'warning');
	const infoAlerts = alerts.filter(alert => alert.severity.toLowerCase() === 'info');

	const totalAlerts = alerts.length;
	const hasAlerts = totalAlerts > 0;

	const handleAlertResolved = () => {
		refetch();
	};

	// Navigation handlers
	const navigateToAlertsPage = () => {
		if (instance) {
			navigate(`/instance/traffic/alerts?name=${instance.name}`);
		}
	};

	const navigateToAlertRules = () => {
		if (instance) {
			navigate(`/instance/managers/alert?name=${instance.name}`);
		}
	};

	// Loading state
	if (isLoading) {
		return (
			<CardBase title={t('Active Alerts')}>
				<Box display="flex" justifyContent="center" alignItems="center" height="100%">
					<CircularProgress />
				</Box>
			</CardBase>
		);
	}

	// Error state
	if (error) {
		return (
			<CardBase title={t('Active Alerts')}>
				<Alert severity="error">
					<AlertTitle>{t('Failed to load alerts')}</AlertTitle>
					{t('Unable to fetch active alerts. Please check your connection.')}
				</Alert>
			</CardBase>
		);
	}

	return (
		<CardBase title={t('Active Alerts')}>
			<Box height="100%" display="flex" flexDirection="column">
				{/* Status Header with Icons and Count */}
				<Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
					<Box display="flex" alignItems="center" gap={1}>
						{hasAlerts ? (
							<NotificationImportantIcon color={criticalAlerts.length > 0 ? 'error' : 'warning'} />
						) : (
							<NotificationsIcon color="success" />
						)}
						<Typography variant="h6" fontWeight="bold">
							{hasAlerts ? t('{{count}} Active Alerts', {count: totalAlerts}) : t('All Systems Healthy')}
						</Typography>
						{totalAlerts > 0 && (
							<Chip 
								label={totalAlerts} 
								size="small" 
								color={criticalAlerts.length > 0 ? 'error' : 'warning'}
								sx={{ fontWeight: 'bold' }}
							/>
						)}
					</Box>
					<Tooltip title={t('Refresh alerts')}>
						<IconButton size="small" onClick={() => refetch()}>
							<RefreshIcon />
						</IconButton>
					</Tooltip>
				</Box>

				{/* Subtitle */}
				<Box mb={2}>
					<Typography variant="body2" color="text.secondary">
						{hasAlerts 
							? t('Requiring immediate attention and resolution')
							: t('All monitored systems are operating within normal parameters')
						}
					</Typography>
				</Box>

				{/* Alert summary chips */}
				{hasAlerts && (
					<Box mb={2}>
						<Stack direction="row" spacing={1} flexWrap="wrap">
							{criticalAlerts.length > 0 && (
								<Chip
									icon={<ErrorIcon />}
									label={t('{{count}} Critical', {count: criticalAlerts.length})}
									color="error"
									size="small"
									variant="filled"
								/>
							)}
							{warningAlerts.length > 0 && (
								<Chip
									icon={<WarningIcon />}
									label={t('{{count}} Warning', {count: warningAlerts.length})}
									color="warning"
									size="small"
									variant="filled"
								/>
							)}
							{infoAlerts.length > 0 && (
								<Chip
									icon={<InfoIcon />}
									label={t('{{count}} Info', {count: infoAlerts.length})}
									color="info"
									size="small"
									variant="filled"
								/>
							)}
						</Stack>
					</Box>
				)}

				<Divider sx={{ mb: 2 }} />

				{/* Alerts list */}
				<Box flexGrow={1} overflow="auto">
					{!hasAlerts ? (
						<Box 
							display="flex" 
							flexDirection="column" 
							alignItems="center" 
							justifyContent="center"
							height="100%"
							color="text.secondary"
						>
							<CheckCircleIcon sx={{ fontSize: 48, mb: 2, color: 'success.main' }} />
							<Typography variant="h6" color="success.main">
								{t('All Systems Operational')}
							</Typography>
							<Typography variant="body2" textAlign="center" mt={1}>
								{t('No alerts are currently active. Your LoxiLB system is running smoothly.')}
							</Typography>
						</Box>
					) : (
						<Box>
							{/* Critical alerts first */}
							{criticalAlerts.map((alert, index) => (
								<AlertItem
									key={`critical-${alert.id}-${index}`}
									alert={alert}
									instance={instance!}
									onResolve={handleAlertResolved}
								/>
							))}
							
							{/* Warning alerts */}
							{warningAlerts.map((alert, index) => (
								<AlertItem
									key={`warning-${alert.id}-${index}`}
									alert={alert}
									instance={instance!}
									onResolve={handleAlertResolved}
								/>
							))}
							
							{/* Info alerts */}
							{infoAlerts.map((alert, index) => (
								<AlertItem
									key={`info-${alert.id}-${index}`}
									alert={alert}
									instance={instance!}
									onResolve={handleAlertResolved}
								/>
							))}
						</Box>
					)}
				</Box>

				{/* Footer actions */}
				{hasAlerts && (
					<Box mt={2} pt={2} borderTop="1px solid" borderColor="divider">
						<Grid container spacing={1}>
							<Grid item xs={6}>
								<Button 
									variant="outlined" 
									color="primary" 
									size="small" 
									fullWidth
									onClick={navigateToAlertsPage}
								>
									{t('View All Alerts')}
								</Button>
							</Grid>
							<Grid item xs={6}>
								<Button 
									variant="outlined" 
									color="secondary" 
									size="small" 
									fullWidth
									onClick={navigateToAlertRules}
								>
									{t('Manage Rules')}
								</Button>
							</Grid>
						</Grid>
					</Box>
				)}
			</Box>
		</CardBase>
	);
}