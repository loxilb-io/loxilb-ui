//---------------------------------------------------------
// Workers observability page (UI-MON-009)
//---------------------------------------------------------
// REST-first by contract: the pushed worker/GPU telemetry has no Prometheus
// families. `/config/gpu/status`.enabled is the AUTHORITATIVE enabled signal
// — the worker-metrics GET never populates monitoring_enabled, so its
// absence is never read as disabled. The two REST reads and the Prometheus
// snapshot carry independent receive timestamps and are never presented as
// one atomic observation.
//
// The one Prometheus family here is `loxilb_ai_worker_scrape_total`: the
// gateway's own pull of each engine's /metrics for load-aware P/D
// selection. It is shown as ONE verdict line above the page frame, because
// that scraper runs for P/D rules whether or not GPU monitoring is enabled,
// and a disabled-monitoring frame must not hide it.

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
import {useMetricsSnapshot} from 'hooks/query/observabilityHooks';
import {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {formatReportedAt, reportedAtFromIso} from 'observability/reportedAt';
import {rateMaxGapMs} from 'observability/snapshotRates';
import {workerScrape} from 'observability/workerScrape';
import {ObservabilityViewState} from 'types/observability';
import {PanelPaper, StatRow, formatRatio, useObservabilityApplicable} from './common';

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

	const scrapeApplicable = useObservabilityApplicable('panel.workerScrape');
	const metrics = useMetricsSnapshot(scrapeApplicable ? instance : null);
	const scrapeMaxGap = rateMaxGapMs(metrics.cadenceMs);
	const scrape = useMemo(() => workerScrape(metrics.snapshot, metrics.history, scrapeMaxGap), [metrics.snapshot, metrics.history, scrapeMaxGap]);

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
	// Before any worker reports, the gateway still sends `last_metrics_update`
	// as Go's zero time: that is "never", not an update so old it is stalled.
	const nowMs = Date.now();
	const lastUpdate = reportedAtFromIso(status?.last_metrics_update);
	const ingestionStalled = typeof lastUpdate === 'number' && nowMs - lastUpdate > WORKER_DATA_STALE_MS;

	return (
		<Box sx={{p: 2}}>
			<Box display="flex" alignItems="center" gap={2} sx={{mb: 2}}>
				<Typography variant="h5" component="h2">{t('Workers')}</Typography>
				{gpu.data && <FreshnessBadge receivedAtMs={gpu.data.receivedAtMs} cadenceMs={GPU_STATUS_CADENCE_MS} />}
			</Box>

			{/* Silent when idle, healthy or undecided: only a failing scraper is news. */}
			{scrape.kind === 'never-ok' && (
				<Alert severity="error" sx={{mb: 2}}>
					{t('None of the {{n}} engine-metrics scrapes since the gateway started could be parsed: load-aware P/D selection is scoring every endpoint on substituted values.', {n: scrape.attempts})}
				</Alert>
			)}
			{scrape.kind === 'failing' && (
				<Alert severity="warning" sx={{mb: 2}}>
					{t('{{share}} of engine-metrics scrapes in the last window failed: load-aware P/D selection scored those endpoints on stale or substituted values.', {
						share: formatRatio({kind: 'ok', ratio: scrape.failedShare}, t),
					})}
				</Alert>
			)}

			<ObservabilityStateFrame state={state} name={t('Workers')} onRetry={() => void gpu.refetch()}>
				<Grid container spacing={2}>
					<Grid item xs={12} md={4}>
						<PanelPaper title={t('GPU monitoring status')}>
							{/* "Enabled" is the page state itself: a disabled gateway
							    renders the disabled frame instead of this panel. */}
							{/* `ebpf_map_loaded` is omitempty on the gateway: omitted IS
							    false. Shown only when it is: a loaded map is not news. */}
							{status && status.ebpf_map_loaded !== true && (
								<Alert severity="warning" sx={{mb: 1}}>
									{t('The gateway reports its worker-statistics eBPF map as not loaded, so the worker readings below may not be reaching the datapath.')}
								</Alert>
							)}
							<StatRow label={t('Routing mode')} value={status?.routing_mode ?? t('N/A')} />
							{/* `worker_count` is omitempty on the gateway: omitted IS zero. */}
							<StatRow label={t('Workers tracked')} value={status ? (status.worker_count ?? 0) : t('N/A')} />
							<StatRow
								label={t('Last metrics update')}
								value={formatReportedAt(lastUpdate, nowMs, t)}
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
											<TableCell align="right">{t('KV cache used')}</TableCell>
											<TableCell align="right">{t('Reported at')}</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{workers.data!.data.map(w => (
											<TableRow key={w.endpoint_ip}>
												<TableCell>{w.endpoint_ip}</TableCell>
												<TableCell align="right">{w.queued_requests}</TableCell>
												<TableCell align="right">{`${w.kv_cache_usage_perc}%`}</TableCell>
												<TableCell align="right">
													{formatReportedAt(reportedAtFromIso(w.timestamp), nowMs, t)}
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
