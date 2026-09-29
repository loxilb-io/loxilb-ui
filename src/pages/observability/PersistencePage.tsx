//---------------------------------------------------------
// Persistence observability page (UI-MON-014)
//---------------------------------------------------------
// Urgent persistence state only: unsaved changes, auto-persist failing,
// quarantined snapshots and how this process booted. Persist/restore
// breakdowns, snapshot triggers and restore durations are in Grafana's
// overview "Persistence" row.
//
// There is NO last-persist timestamp metric family — the last persist and
// restore times come from GET /diagnostics, a separate REST read with its
// own cadence and receive time. The Prometheus snapshot and the diagnostics
// read are never presented as one atomic observation: each carries its own
// freshness badge and neither's staleness is inferred from the other.

import {Alert, Box, Grid, Typography} from '@mui/material';
import FreshnessBadge from 'components/observability/FreshnessBadge';
import ObservabilityStateFrame from 'components/observability/ObservabilityStateFrame';
import {classifyViewState} from 'components/observability/observabilityState';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {DIAGNOSTICS_CADENCE_MS, useDiagnostics} from 'hooks/query/gatewayTelemetryHooks';
import {useMetricsSnapshot} from 'hooks/query/observabilityHooks';
import {useTranslation} from 'react-i18next';
import {bootVerdict} from 'observability/bootVerdict';
import {formatReportedAt, reportedAtFromIso} from 'observability/reportedAt';
import {selectScalar} from 'observability/selectors';
import {CadenceSelector, PanelPaper, StatRow, useAbsenceExplanation, useObservabilityApplicable} from './common';

export default function PersistencePage() {
	const {t} = useTranslation();
	const instance = useInstanceFromURL();
	const applicable = useObservabilityApplicable('page.persistence');
	const {snapshot, isLoading, cadenceMs, refetch} = useMetricsSnapshot(applicable ? instance : null);
	// Stage 3.5: let the no-data state say WHY, from the manifest contract.
	const absence = useAbsenceExplanation('page.persistence', snapshot);
	const diagnostics = useDiagnostics(instance, applicable);

	const hasData = (snapshot?.diagnostics.totalSamples ?? 0) > 0;
	const state = classifyViewState({
		applicable,
		isLoading,
		snapshot,
		hasData,
		nowMs: Date.now(),
		cadenceMs,
	});

	const scalar = (family: string) => (snapshot ? selectScalar(snapshot, family) : undefined);
	const configDirty = scalar('loxilb_config_dirty');
	const autopersistFailures = scalar('loxilb_autopersist_consecutive_failures');
	const quarantined = scalar('loxilb_snapshot_quarantine_total');

	const nowMs = Date.now();
	// Both records are omitempty and nil until the first SUCCESSFUL persist or
	// restore of this process: an omitted record is "none since start".
	const opText = (rec: {at?: string} | undefined) =>
		rec ? formatReportedAt(reportedAtFromIso(rec.at), nowMs, t) : t('None since start');

	const diag = diagnostics.data?.data;
	const boot = bootVerdict(diag?.boot, scalar('loxilb_boot_config_conflict_total'));

	return (
		<Box sx={{p: 2}}>
			<Box display="flex" alignItems="center" gap={2} sx={{mb: 2}}>
				<Typography variant="h5" component="h2">{t('Persistence')}</Typography>
				{snapshot && !snapshot.failure && <FreshnessBadge receivedAtMs={snapshot.receivedAtMs} cadenceMs={cadenceMs} />}
				<CadenceSelector />
			</Box>

			<ObservabilityStateFrame state={state} absence={absence} name={t('Persistence')} onRetry={refetch}>
				<Grid container spacing={2}>
					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Configuration state')}>
							{autopersistFailures !== undefined && autopersistFailures > 0 && (
								<Alert severity="warning" sx={{mb: 1}}>
									{t('Auto-persist has failed {{n}} times in a row: configuration changes are not being saved to disk.', {n: autopersistFailures})}
								</Alert>
							)}
							{quarantined !== undefined && quarantined > 0 && (
								<Alert severity="warning" sx={{mb: 1}}>
									{t('{{n}} saved snapshots were quarantined after a failed boot restore.', {n: quarantined})}
								</Alert>
							)}
							<StatRow
								label={t('Unsaved config changes')}
								value={configDirty === undefined ? t('No data') : configDirty === 0 ? t('No') : t('Yes')}
							/>
							<StatRow label={t('Consecutive auto-persist failures')} value={autopersistFailures ?? t('No data')} />
							<StatRow label={t('Quarantined snapshots')} value={quarantined ?? t('No data')} />
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Boot')}>
							{boot.kind === 'degraded' && (
								<Alert severity="error">
									{boot.legacyFallback
										? t('Running degraded: the boot snapshot did not apply, and the gateway replayed its older legacy *.txt configuration instead.')
										: t('Running degraded: the boot snapshot did not apply, and no configuration replaced it.')}
									{boot.quarantinePath && ' ' + t('The snapshot was kept at {{path}} for recovery.', {path: boot.quarantinePath})}
								</Alert>
							)}
							{boot.kind === 'conflict' && (
								<Alert severity="warning">
									{t('This boot found both snapshot.json and legacy *.txt configuration and had to choose one. Remove the stale set.')}
								</Alert>
							)}
							{boot.kind === 'restored' && (
								<Alert severity="success">
									{boot.profile
										? t('Booted from the saved snapshot ({{profile}} profile).', {profile: boot.profile})
										: t('Booted from the saved snapshot.')}
								</Alert>
							)}
							{boot.kind === 'not-restored' && (
								<Alert severity="info">
									{boot.profile
										? t('Booted under the {{profile}} profile; no saved snapshot was applied.', {profile: boot.profile})
										: t('Booted; no saved snapshot was applied.')}
								</Alert>
							)}
							{boot.kind === 'unknown' && (
								<Typography variant="body2" color="text.secondary">
									{t('No data')}
								</Typography>
							)}
						</PanelPaper>
					</Grid>

					<Grid item xs={12}>
						<PanelPaper title={t('Last persist and restore (from diagnostics)')}>
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
									<StatRow label={t('Last persist')} value={opText(diag.last_persist)} />
									<StatRow label={t('Last restore')} value={opText(diag.last_restore)} />
									{/* The gateway sends `auto_persist` only while failures > 0. */}
									{diag.auto_persist && (
										<StatRow label={t('Auto-persist last error')} value={diag.auto_persist.last_error ?? t('N/A')} />
									)}
								</>
							)}
						</PanelPaper>
					</Grid>
				</Grid>
			</ObservabilityStateFrame>
		</Box>
	);
}
