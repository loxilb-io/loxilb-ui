//---------------------------------------------------------
// Connection Flow Card for Connection Tracking
//---------------------------------------------------------
import {Box, Typography, Grid, Divider} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import {query_get_live_metrics} from 'connector/instance/metrics';
import {t} from 'i18next';
import {useMemo} from 'react';
import {IInstance} from 'types/oam';
import {ITypedLiveMetricsResponse} from 'types/metrics';
import CardBase from './CardBase';

//---------------------------------------------------------
// Component Props
//---------------------------------------------------------
interface ConnectionFlowCardProps {
	title: string;
	instance: IInstance | null;
	showBreakdown?: boolean;
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function ConnectionFlowCard(props: ConnectionFlowCardProps) {
	const {title, instance, showBreakdown = true} = props;

	// Get live metrics with polling
	const {data: rawLiveMetrics, isLoading} = useQuery({
		queryKey: ['connection-flow-realtime', instance?.id],
		queryFn: async () => {
			if (!instance) throw new Error('Instance is not defined');
			return await query_get_live_metrics(instance, 2);
		},
		enabled: !!instance,
		refetchInterval: 10000, // 10-second polling
		refetchIntervalInBackground: false,
		staleTime: 5000,
	});
	const liveMetrics = rawLiveMetrics as ITypedLiveMetricsResponse | undefined;

	// Calculate connection data
	const connectionData = useMemo(() => {
		if (!liveMetrics?.critical) {
			return {
				totalActive: 0,
				totalTracked: 0,
				tcp: 0,
				udp: 0,
				sctp: 0,
				inactive: 0,
				newFlows: 0
			};
		}

		const tcp = liveMetrics.critical.active_flow_count_tcp || 0;
		const udp = liveMetrics.critical.active_flow_count_udp || 0;
		const sctp = liveMetrics.critical.active_flow_count_sctp || 0;
		const totalActive = tcp + udp + sctp;
		const totalTracked = liveMetrics.critical.active_conntrack_count || 0;
		const inactive = liveMetrics.critical.inactive_flow_count || 0;
		const newFlows = liveMetrics.critical.new_flow_count || 0;

		return {
			totalActive,
			totalTracked,
			tcp,
			udp,
			sctp,
			inactive,
			newFlows
		};
	}, [liveMetrics]);

	if (isLoading) {
		return (
			<CardBase title={title}>
				<Box display="flex" justifyContent="center" p={3}>
					<Typography variant="body2" color="textSecondary">Loading...</Typography>
				</Box>
			</CardBase>
		);
	}

	return (
		<CardBase title={title}>
			<Box display="flex" flexDirection="column" gap={2}>
				{/* Main Metrics */}
				<Grid container spacing={2}>
					<Grid item xs={6}>
						<Box textAlign="center">
							<Typography variant="h3" fontWeight="bold" color="primary">
								{connectionData.totalTracked.toLocaleString()}
							</Typography>
							<Typography variant="caption" color="textSecondary">
								{t('Total Tracked')}
							</Typography>
						</Box>
					</Grid>
					<Grid item xs={6}>
						<Box textAlign="center">
							<Typography variant="h3" fontWeight="bold" color="success.main">
								{connectionData.totalActive.toLocaleString()}
							</Typography>
							<Typography variant="caption" color="textSecondary">
								{t('Active Flows')}
							</Typography>
						</Box>
					</Grid>
				</Grid>

				{showBreakdown && (
					<>
						<Divider />
						
						{/* Protocol Breakdown */}
						<Typography variant="subtitle2" color="textSecondary">
							{t('Protocol Breakdown')}
						</Typography>
						
						<Grid container spacing={1}>
							<Grid item xs={4}>
								<Box textAlign="center">
									<Typography variant="h4" fontWeight="bold" color="info.main">
										{connectionData.tcp.toLocaleString()}
									</Typography>
									<Typography variant="caption" color="textSecondary">
										TCP
									</Typography>
								</Box>
							</Grid>
							<Grid item xs={4}>
								<Box textAlign="center">
									<Typography variant="h4" fontWeight="bold" color="warning.main">
										{connectionData.udp.toLocaleString()}
									</Typography>
									<Typography variant="caption" color="textSecondary">
										UDP
									</Typography>
								</Box>
							</Grid>
							<Grid item xs={4}>
								<Box textAlign="center">
									<Typography variant="h4" fontWeight="bold" color="secondary.main">
										{connectionData.sctp.toLocaleString()}
									</Typography>
									<Typography variant="caption" color="textSecondary">
										SCTP
									</Typography>
								</Box>
							</Grid>
						</Grid>

						<Divider />
						
						{/* Additional Metrics */}
						<Grid container spacing={1}>
							<Grid item xs={6}>
								<Box textAlign="center">
									<Typography variant="body1" fontWeight="bold" color="error.main">
										{connectionData.inactive.toLocaleString()}
									</Typography>
									<Typography variant="caption" color="textSecondary">
										{t('Inactive')}
									</Typography>
								</Box>
							</Grid>
							<Grid item xs={6}>
								<Box textAlign="center">
									<Typography variant="body1" fontWeight="bold" color="primary.main">
										{connectionData.newFlows.toLocaleString()}
									</Typography>
									<Typography variant="caption" color="textSecondary">
										{t('New Flows')}
									</Typography>
								</Box>
							</Grid>
						</Grid>
					</>
				)}
			</Box>
		</CardBase>
	);
}