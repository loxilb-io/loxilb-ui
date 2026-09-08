//---------------------------------------------------------
// Workers observability page (UI-MON-009)
//---------------------------------------------------------
// REST-first by contract: worker/GPU telemetry has NO Prometheus families.
// `/config/gpu/status`.enabled is the AUTHORITATIVE enabled signal — the
// worker-metrics GET never populates monitoring_enabled, so its absence is
// never read as disabled. The two REST reads and the Prometheus snapshot
// carry independent receive timestamps and are never presented as one
// atomic observation.

import {Alert, Box, Grid, Table, TableBody, TableCell, TableHead, TableRow, Typography} from '@mui/material';
import FreshnessBadge from 'components/observability/FreshnessBadge';
import ObservabilityStateFrame from 'components/observability/ObservabilityStateFrame';
import {fromThrownError} from 'connector/fetcher/opResultAdapter';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {
	GPU_STATUS_CADENCE_MS,
	WORKER_METRICS_CADENCE_MS,
	useGpuStatus,
	useWorkerMetrics,
} from 'hooks/query/gatewayTelemetryHooks';
import {useTranslation} from 'react-i18next';
import {ObservabilityViewState} from 'types/observability';
import {PanelPaper, StatRow, useObservabilityApplicable} from './common';

// The gateway refuses worker-metric ingestion older than 10 s; a
// last-update lag beyond 30 s therefore means collection has stalled
// regardless of whether our REST poll succeeds.
const WORKER_DATA_STALE_MS = 30_000;

export default function WorkersPage() {
	const {t} = useTranslation();
	const instance = useInstanceFromURL();
	const applicable = useObservabilityApplicable('page.workers');

	const gpu = useGpuStatus(instance, applicable);
	const monitoringEnabled = gpu.data?.data.enabled === true;
	const workers = useWorkerMetrics(instance, applicable, monitoringEnabled);

	// Page state from the authoritative source first: gpu/status answers
	// enabled-ness; the workers list is secondary detail.
	let state: ObservabilityViewState;
	if (!applicable) state = {kind: 'not-applicable'};
	else if (gpu.error) {
		const failure = fromThrownError('observability.gpu_status', gpu.error);
		state = failure.status === 'denied' ? {kind: 'denied', failure} : {kind: 'unavailable', failure};
	} else if (gpu.isLoading || !gpu.data) state = {kind: 'loading'};
	else if (!monitoringEnabled) state = {kind: 'disabled', reasonKey: 'GPU monitoring is disabled on this instance.'};
	else state = {kind: 'ready'};

	const status = gpu.data?.data;
	const lastUpdateMs = status?.last_metrics_update ? Date.parse(status.last_metrics_update) : undefined;
	const ingestionStalled = lastUpdateMs !== undefined && Date.now() - lastUpdateMs > WORKER_DATA_STALE_MS;

	return (
		<Box sx={{p: 2}}>
			<Box display="flex" alignItems="center" gap={2} sx={{mb: 2}}>
				<Typography variant="h5">{t('Workers')}</Typography>
				{gpu.data && <FreshnessBadge receivedAtMs={gpu.data.receivedAtMs} cadenceMs={GPU_STATUS_CADENCE_MS} />}
			</Box>

			<ObservabilityStateFrame state={state} name={t('Workers')} onRetry={() => void gpu.refetch()}>
				<Grid container spacing={2}>
					<Grid item xs={12} md={4}>
						<PanelPaper title={t('GPU monitoring status')}>
							<StatRow label={t('Enabled')} value={status?.enabled === true ? t('Yes') : t('No')} />
							<StatRow label={t('Routing mode')} value={status?.routing_mode ?? t('N/A')} />
							<StatRow label={t('Workers tracked')} value={status?.worker_count ?? t('N/A')} />
							<StatRow label={t('eBPF maps loaded')} value={status?.ebpf_map_loaded === true ? t('Yes') : t('No')} />
							<StatRow
								label={t('Last metrics update')}
								value={lastUpdateMs !== undefined ? new Date(lastUpdateMs).toLocaleTimeString() : t('N/A')}
							/>
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={8}>
						<PanelPaper title={t('Worker queue and KV cache')}>
							{ingestionStalled && (
								<Alert severity="warning" sx={{mb: 1}}>
									{t('Worker ingestion is stalled: the last engine update is older than 30 seconds, so the rows below are stale even though this page is polling.')}
								</Alert>
							)}
							{workers.error ? (
								<Typography variant="body2" color="text.secondary">
									{t('Worker rows are unavailable right now; the monitoring status above is still current.')}
								</Typography>
							) : (workers.data?.data.length ?? 0) === 0 ? (
								<Typography variant="body2" color="text.secondary">
									{t('No data')}
								</Typography>
							) : (
								<Table size="small">
									<TableHead>
										<TableRow>
											<TableCell>{t('Endpoint')}</TableCell>
											<TableCell align="right">{t('Queued requests')}</TableCell>
											<TableCell align="right">{t('Preemptions (delta)')}</TableCell>
											<TableCell align="right">{t('KV cache used')}</TableCell>
											<TableCell align="right">{t('GPU blocks')}</TableCell>
											<TableCell align="right">{t('Reported at')}</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{workers.data!.data.map(w => (
											<TableRow key={w.endpoint_ip}>
												<TableCell>{w.endpoint_ip}</TableCell>
												<TableCell align="right">{w.queued_requests}</TableCell>
												<TableCell align="right">{w.swapped_requests ?? t('N/A')}</TableCell>
												<TableCell align="right">{`${w.kv_cache_usage_perc}%`}</TableCell>
												<TableCell align="right">{w.num_gpu_blocks ?? t('N/A')}</TableCell>
												<TableCell align="right">
													{w.timestamp ? new Date(w.timestamp).toLocaleTimeString() : t('N/A')}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
							{workers.data && (
								<Box sx={{mt: 1}}>
									<FreshnessBadge receivedAtMs={workers.data.receivedAtMs} cadenceMs={WORKER_METRICS_CADENCE_MS} />
								</Box>
							)}
						</PanelPaper>
					</Grid>
				</Grid>
			</ObservabilityStateFrame>
		</Box>
	);
}
