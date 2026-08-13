//---------------------------------------------------------
// Connection Flow Card for Connection Tracking
//---------------------------------------------------------
import {Box, Typography, Grid, Divider} from '@mui/material';
import {useLiveMetrics} from 'hooks/query/metricsHook';
import {t} from 'i18next';
import {useMemo} from 'react';
import {IInstance} from 'types/oam';
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
	const {metrics: liveMetrics, isLoading} = useLiveMetrics(instance, {keyPrefix: 'connection-flow-realtime', refetchInterval: 10000});

	// Calculate connection data
	const connectionData = useMemo(() => {
		if (!liveMetrics?.critical) {
			return {
				totalActive: 0,
				totalTracked: 0,
				tcp: 0,
				udp: 0,
				sctp: 0,
				newFlows: 0,
				utilizationPct: undefined as number | undefined
			};
		}

		const tcp = liveMetrics.critical.loxilb_active_flow_count_tcp || 0;
		const udp = liveMetrics.critical.loxilb_active_flow_count_udp || 0;
		const sctp = liveMetrics.critical.loxilb_active_flow_count_sctp || 0;
		const totalActive = tcp + udp + sctp;
		const totalTracked = liveMetrics.critical.loxilb_active_conntrack_entries || 0;
		const newFlows = liveMetrics.critical.loxilb_new_flows || 0;
		// Conntrack-table utilization (active / capacity). loxilb_conntrack_max_entries
		// is only exported by post-rename gateways — treat its absence as N/A.
		const maxTracked = liveMetrics.critical.loxilb_conntrack_max_entries || 0;
		const utilizationPct = maxTracked > 0 ? Math.round((totalTracked / maxTracked) * 100) : undefined;

		return {
			totalActive,
			totalTracked,
			tcp,
			udp,
			sctp,
			newFlows,
			utilizationPct
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
									<Typography variant="body1" fontWeight="bold" color="primary.main">
										{connectionData.newFlows.toLocaleString()}
									</Typography>
									<Typography variant="caption" color="textSecondary">
										{t('New Flows')}
									</Typography>
								</Box>
							</Grid>
							{connectionData.utilizationPct !== undefined && (
								<Grid item xs={6}>
									<Box textAlign="center">
										<Typography
											variant="body1"
											fontWeight="bold"
											color={connectionData.utilizationPct >= 80 ? 'error.main' : 'success.main'}
										>
											{connectionData.utilizationPct}%
										</Typography>
										<Typography variant="caption" color="textSecondary">
											{t('Conntrack Usage')}
										</Typography>
									</Box>
								</Grid>
							)}
						</Grid>
					</>
				)}
			</Box>
		</CardBase>
	);
}