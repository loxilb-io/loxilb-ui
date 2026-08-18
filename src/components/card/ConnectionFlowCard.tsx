//---------------------------------------------------------
// Connection Flow Card for Connection Tracking
//---------------------------------------------------------
import {Box, Typography, Grid, Divider} from '@mui/material';
import {useLiveMetrics} from 'hooks/query/metricsHook';
import {t} from 'i18next';
import {useMemo} from 'react';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';
import {derive_connection_flows, is_reporting} from './cardMetricsLogic';
import MetricFigure from './MetricFigure';

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

	// `available === false` means the instance served no exposition at all
	// (collection disabled, or the scrape was refused). Every figure below is
	// then unknown — a different statement from "there is no traffic", and the
	// card must not make the second one. Derivation lives in cardMetricsLogic
	// so that rule is unit-testable.
	const reporting = is_reporting(liveMetrics);
	const connectionData = useMemo(() => derive_connection_flows(liveMetrics), [liveMetrics]);

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
				{/* One explanation for the whole card beats repeating it under six
				    N/A figures — see MetricFigure. */}
				{!reporting && (
					<Typography variant="body2" color="textSecondary" textAlign="center">
						{t('Metrics collection is not enabled on this instance')}
					</Typography>
				)}

				{/* Main Metrics */}
				<Grid container spacing={2}>
					<Grid item xs={6}>
						<MetricFigure variant="h3" color="primary" value={connectionData.totalTracked} label={t('Total Tracked')} />
					</Grid>
					<Grid item xs={6}>
						<MetricFigure variant="h3" color="success.main" value={connectionData.totalActive} label={t('Active Flows')} />
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
								<MetricFigure color="info.main" value={connectionData.tcp} label="TCP" />
							</Grid>
							<Grid item xs={4}>
								<MetricFigure color="warning.main" value={connectionData.udp} label="UDP" />
							</Grid>
							<Grid item xs={4}>
								<MetricFigure color="secondary.main" value={connectionData.sctp} label="SCTP" />
							</Grid>
						</Grid>

						<Divider />
						
						{/* Additional Metrics */}
						<Grid container spacing={1}>
							<Grid item xs={6}>
								<MetricFigure variant="body1" color="primary.main" value={connectionData.newFlows} label={t('New Flows')} />
							</Grid>
							{/* Capacity is unknown on a pre-parity loxilb, so the ratio is
							    genuinely underivable — hide the view rather than show N/A
							    for a figure that is not a measurement in the first place. */}
							{connectionData.utilizationPct !== undefined && (
								<Grid item xs={6}>
									<MetricFigure
										variant="body1"
										color={connectionData.utilizationPct >= 80 ? 'error.main' : 'success.main'}
										value={connectionData.utilizationPct}
										suffix="%"
										label={t('Conntrack Usage')}
									/>
								</Grid>
							)}
						</Grid>
					</>
				)}
			</Box>
		</CardBase>
	);
}