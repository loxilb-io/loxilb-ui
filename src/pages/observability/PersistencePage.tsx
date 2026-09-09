//---------------------------------------------------------
// Persistence observability page (UI-MON-014)
//---------------------------------------------------------
// Snapshot/restore/persist telemetry. There is NO last-persist timestamp
// metric family — the persist identity (generation, mode, time) comes from
// GET /diagnostics → last_persist, a separate REST read with its own cadence
// and receive time. The Prometheus snapshot and the diagnostics read are
// never presented as one atomic observation: each carries its own freshness
// badge and neither's staleness is inferred from the other.

import {Box, Grid, Table, TableBody, TableCell, TableHead, TableRow, Typography} from '@mui/material';
import FreshnessBadge from 'components/observability/FreshnessBadge';
import ObservabilityStateFrame from 'components/observability/ObservabilityStateFrame';
import {classifyViewState} from 'components/observability/observabilityState';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {DIAGNOSTICS_CADENCE_MS, useDiagnostics} from 'hooks/query/gatewayTelemetryHooks';
import {useMetricsSnapshot} from 'hooks/query/observabilityHooks';
import {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {estimateQuantile, mergeHistogramSeries} from 'observability/histogram';
import {selectSamples, selectScalar} from 'observability/selectors';
import {familySumRate, rateMaxGapMs} from 'observability/snapshotRates';
import {CadenceSelector, PanelPaper, StatRow, formatRate, useObservabilityApplicable} from './common';

export default function PersistencePage() {
	const {t} = useTranslation();
	const instance = useInstanceFromURL();
	const applicable = useObservabilityApplicable('page.persistence');
	const {snapshot, history, isLoading, cadenceMs, refetch} = useMetricsSnapshot(applicable ? instance : null);
	const maxGap = rateMaxGapMs(cadenceMs);
	const diagnostics = useDiagnostics(instance, applicable);

	const snapshotsByTrigger = useMemo(() => (snapshot ? selectSamples(snapshot, 'loxilb_snapshot_total') : []), [snapshot]);
	const restoresByModeResult = useMemo(() => (snapshot ? selectSamples(snapshot, 'loxilb_restore_total') : []), [snapshot]);
	const persistByResult = useMemo(() => (snapshot ? selectSamples(snapshot, 'loxilb_persist_total') : []), [snapshot]);

	const restoreDuration = useMemo(() => {
		const family = snapshot?.families.get('loxilb_restore_duration_seconds');
		if (!family || family.samples.length === 0) return undefined;
		const merged = mergeHistogramSeries(family);
		if (merged.kind !== 'ok') return {invalid: merged.reason} as const;
		const q = (p: number) => estimateQuantile(merged.series, p);
		return {p50: q(0.5), p95: q(0.95), count: merged.series.count} as const;
	}, [snapshot]);

	const hasData = (snapshot?.diagnostics.totalSamples ?? 0) > 0;
	const state = classifyViewState({
		applicable,
		isLoading,
		snapshot,
		hasData,
		nowMs: Date.now(),
		cadenceMs,
	});

	const gauge = (family: string) => {
		const v = snapshot ? selectScalar(snapshot, family) : undefined;
		return v === undefined ? t('No data') : v;
	};

	const quantileText = (r: ReturnType<typeof estimateQuantile>) => {
		if (r.kind === 'ok') return `${(r.value * 1000).toFixed(0)} ms`;
		if (r.kind === 'above-ladder') return t('Above bucket range');
		return t('N/A');
	};

	const timeText = (iso: string | undefined) => {
		if (!iso) return t('N/A');
		const ms = Date.parse(iso);
		return Number.isFinite(ms) ? new Date(ms).toLocaleString() : t('N/A');
	};

	const configDirty = snapshot ? selectScalar(snapshot, 'loxilb_config_dirty') : undefined;
	const lastRestoreTs = snapshot ? selectScalar(snapshot, 'loxilb_last_restore_timestamp_seconds') : undefined;

	const diag = diagnostics.data?.data;

	return (
		<Box sx={{p: 2}}>
			<Box display="flex" alignItems="center" gap={2} sx={{mb: 2}}>
				<Typography variant="h5">{t('Persistence')}</Typography>
				{snapshot && !snapshot.failure && <FreshnessBadge receivedAtMs={snapshot.receivedAtMs} cadenceMs={cadenceMs} />}
				<CadenceSelector />
			</Box>

			<ObservabilityStateFrame state={state} name={t('Persistence')} onRetry={refetch}>
				<Grid container spacing={2}>
					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Configuration state')}>
							<StatRow
								label={t('Unsaved config changes')}
								value={configDirty === undefined ? t('No data') : configDirty === 0 ? t('No') : t('Yes')}
							/>
							<StatRow label={t('Consecutive auto-persist failures')} value={gauge('loxilb_autopersist_consecutive_failures')} />
							<StatRow label={t('Persist attempts')} value={formatRate(familySumRate(history, 'loxilb_persist_total', maxGap), t)} />
							{persistByResult.map(s => (
								<StatRow
									key={s.labelKey}
									label={`${t('Persists')} (${s.labels.result ?? t('Unknown value')})`}
									value={Number.isFinite(s.value) ? s.value : t('N/A')}
								/>
							))}
							<StatRow label={t('Quarantined snapshots')} value={gauge('loxilb_snapshot_quarantine_total')} />
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Snapshots by trigger')}>
							{snapshotsByTrigger.length === 0 ? (
								<Typography variant="body2" color="text.secondary">
									{t('No data')}
								</Typography>
							) : (
								snapshotsByTrigger.map(s => (
									<StatRow
										key={s.labelKey}
										label={s.labels.trigger ?? t('Unknown value')}
										value={Number.isFinite(s.value) ? s.value : t('N/A')}
									/>
								))
							)}
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Restores')}>
							{restoresByModeResult.length === 0 ? (
								<Typography variant="body2" color="text.secondary">
									{t('No data')}
								</Typography>
							) : (
								<Table size="small">
									<TableHead>
										<TableRow>
											<TableCell>{t('Mode')}</TableCell>
											<TableCell>{t('Result')}</TableCell>
											<TableCell align="right">{t('Count')}</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{restoresByModeResult.map(s => (
											<TableRow key={s.labelKey}>
												<TableCell>{s.labels.mode ?? t('Unknown value')}</TableCell>
												<TableCell>{s.labels.result ?? t('Unknown value')}</TableCell>
												<TableCell align="right">{Number.isFinite(s.value) ? s.value : t('N/A')}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
							<StatRow
								label={t('Last restore finished')}
								value={
									lastRestoreTs !== undefined && Number.isFinite(lastRestoreTs) && lastRestoreTs > 0
										? new Date(lastRestoreTs * 1000).toLocaleString()
										: t('N/A')
								}
							/>
							{restoreDuration && !('invalid' in restoreDuration) && (
								<>
									<StatRow label={t('Restore duration p50')} value={quantileText(restoreDuration.p50)} />
									<StatRow label={t('Restore duration p95')} value={quantileText(restoreDuration.p95)} />
								</>
							)}
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Boot')}>
							<StatRow label={t('Boot config conflicts')} value={gauge('loxilb_boot_config_conflict_total')} />
							<StatRow label={t('Legacy boot fallbacks')} value={gauge('loxilb_boot_legacy_fallback_total')} />
							{diag?.boot && (
								<>
									<StatRow label={t('Boot profile')} value={diag.boot.profile ?? t('N/A')} />
									<StatRow label={t('Boot snapshot found')} value={diag.boot.snapshot_found ? t('Yes') : t('No')} />
									<StatRow label={t('Boot restore succeeded')} value={diag.boot.succeeded ? t('Yes') : t('No')} />
									<StatRow label={t('Running degraded')} value={diag.boot.degraded ? t('Yes') : t('No')} />
								</>
							)}
						</PanelPaper>
					</Grid>

					<Grid item xs={12}>
						<PanelPaper title={t('Persist and restore identity (from diagnostics)')}>
							{diagnostics.error ? (
								<Typography variant="body2" color="text.secondary">
									{t('Diagnostics are unavailable right now; the metric panels above are still current.')}
								</Typography>
							) : !diag ? (
								<Typography variant="body2" color="text.secondary">
									{t('No data')}
								</Typography>
							) : (
								<>
									<Box display="flex" alignItems="center" gap={1} sx={{mb: 1}}>
										{diagnostics.data && (
											<FreshnessBadge receivedAtMs={diagnostics.data.receivedAtMs} cadenceMs={DIAGNOSTICS_CADENCE_MS} />
										)}
										<Typography variant="caption" color="text.secondary">
											{t('This REST read has its own timing and is not synchronized with the metric snapshot above.')}
										</Typography>
									</Box>
									<Grid container spacing={2}>
										<Grid item xs={12} md={4}>
											<StatRow label={t('Last persist at')} value={timeText(diag.last_persist?.at)} />
											<StatRow label={t('Last persist generation')} value={diag.last_persist?.generation ?? t('N/A')} />
											<StatRow label={t('Last persist trigger')} value={diag.last_persist?.mode ?? t('N/A')} />
										</Grid>
										<Grid item xs={12} md={4}>
											<StatRow label={t('Last restore at')} value={timeText(diag.last_restore?.at)} />
											<StatRow label={t('Last restore generation')} value={diag.last_restore?.generation ?? t('N/A')} />
											<StatRow label={t('Last restore mode')} value={diag.last_restore?.mode ?? t('N/A')} />
										</Grid>
										<Grid item xs={12} md={4}>
											<StatRow label={t('Auto-persist failures (reported)')} value={diag.auto_persist?.consecutive_failures ?? t('N/A')} />
											<StatRow label={t('Auto-persist last attempt')} value={timeText(diag.auto_persist?.last_attempt)} />
											<StatRow label={t('Auto-persist last error')} value={diag.auto_persist?.last_error ?? t('None')} />
										</Grid>
									</Grid>
								</>
							)}
						</PanelPaper>
					</Grid>
				</Grid>
			</ObservabilityStateFrame>
		</Box>
	);
}
