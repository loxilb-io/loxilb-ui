//---------------------------------------------------------
// P/D & KV observability page (UI-MON-010)
//---------------------------------------------------------
// Prefill/decode disaggregation and KV-cache attestation telemetry. Endpoint
// display rides the STRICT info-metric join: `service + ep_idx` must match
// `loxilb_pd_ep_info` uniquely, else the row says unknown/ambiguous — an
// `ep_idx` is never presented as an address. The 8 `loxilb_pd_ctrl_*`
// families are NOT here despite the prefix: they belong to the standalone AI
// controller's scrape (excluded class in the vendored manifest), and the
// registry/parser tolerate their absence and any unregistered presence.

import {Box, Grid, Table, TableBody, TableCell, TableHead, TableRow, Typography} from '@mui/material';
import FreshnessBadge from 'components/observability/FreshnessBadge';
import ObservabilityStateFrame from 'components/observability/ObservabilityStateFrame';
import {classifyViewState} from 'components/observability/observabilityState';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {METRICS_SNAPSHOT_CADENCE_MS, useMetricsSnapshot} from 'hooks/query/observabilityHooks';
import {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {buildEpJoinIndex, joinEp} from 'observability/pdJoin';
import {selectSamples, selectScalar} from 'observability/selectors';
import {familySumRate} from 'observability/snapshotRates';
import {formatRate, PanelPaper, StatRow, useObservabilityApplicable} from './common';

export default function PdKvPage() {
	const {t} = useTranslation();
	const instance = useInstanceFromURL();
	const applicable = useObservabilityApplicable('page.pdKv');
	const {snapshot, history, isLoading, refetch} = useMetricsSnapshot(applicable ? instance : null);

	const epJoin = useMemo(() => (snapshot ? buildEpJoinIndex(snapshot) : undefined), [snapshot]);

	const kvBlocks = useMemo(() => (snapshot ? selectSamples(snapshot, 'loxilb_pd_kv_blocks') : []), [snapshot]);
	const attestStates = useMemo(
		() => (snapshot ? selectSamples(snapshot, 'loxilb_ai_kv_attest_state').filter(s => s.value > 0) : []),
		[snapshot],
	);
	const subscriberFreshness = useMemo(
		() => (snapshot ? selectSamples(snapshot, 'loxilb_kv_subscriber_last_event_timestamp_seconds') : []),
		[snapshot],
	);

	const hasData = (snapshot?.diagnostics.totalSamples ?? 0) > 0;
	const state = classifyViewState({
		applicable,
		isLoading,
		snapshot,
		hasData,
		nowMs: Date.now(),
		cadenceMs: METRICS_SNAPSHOT_CADENCE_MS,
	});

	const epCell = (service: string | undefined, epIdx: string | undefined) => {
		if (!epJoin || service === undefined || epIdx === undefined) return t('Unknown endpoint');
		const join = joinEp(epJoin, service, epIdx);
		if (join.kind === 'ok') return join.ep;
		if (join.kind === 'ambiguous') return t('Ambiguous endpoint mapping');
		return t('Unknown endpoint');
	};

	return (
		<Box sx={{p: 2}}>
			<Box display="flex" alignItems="center" gap={2} sx={{mb: 2}}>
				<Typography variant="h5">{t('P/D & KV Cache')}</Typography>
				{snapshot && !snapshot.failure && <FreshnessBadge receivedAtMs={snapshot.receivedAtMs} cadenceMs={METRICS_SNAPSHOT_CADENCE_MS} />}
			</Box>

			<ObservabilityStateFrame state={state} name={t('P/D & KV Cache')} onRetry={refetch}>
				<Grid container spacing={2}>
					<Grid item xs={12} md={4}>
						<PanelPaper title={t('Admission and sessions')}>
							<StatRow label={t('Admission queued')} value={formatRate(familySumRate(history, 'loxilb_pd_admission_queued_total'), t)} />
							<StatRow label={t('Admission shed')} value={formatRate(familySumRate(history, 'loxilb_pd_admission_shed_total'), t)} />
							<StatRow label={t('P/D sessions active')} value={snapshot ? (selectScalar(snapshot, 'loxilb_pd_sessions_active') ?? t('No data')) : t('No data')} />
							<StatRow label={t('Fallbacks to normal routing')} value={formatRate(familySumRate(history, 'loxilb_pd_fallback_to_normal_total'), t)} />
							<StatRow label={t('Connect failovers')} value={formatRate(familySumRate(history, 'loxilb_pd_connect_failover_total'), t)} />
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={8}>
						<PanelPaper title={t('KV block capacity by endpoint (strict join)')}>
							{kvBlocks.length === 0 ? (
								<Typography variant="body2" color="text.secondary">
									{t('No data')}
								</Typography>
							) : (
								<Table size="small">
									<TableHead>
										<TableRow>
											<TableCell>{t('Service')}</TableCell>
											<TableCell>{t('EP index')}</TableCell>
											<TableCell>{t('Endpoint')}</TableCell>
											<TableCell align="right">{t('KV blocks')}</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{kvBlocks.map(s => (
											<TableRow key={s.labelKey}>
												<TableCell>{s.labels.service ?? ''}</TableCell>
												<TableCell>{s.labels.ep_idx ?? ''}</TableCell>
												<TableCell>{epCell(s.labels.service, s.labels.ep_idx)}</TableCell>
												<TableCell align="right">{Number.isFinite(s.value) ? s.value : t('N/A')}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('KV attestation')}>
							{attestStates.length === 0 ? (
								<Typography variant="body2" color="text.secondary">
									{t('No data')}
								</Typography>
							) : (
								<Table size="small">
									<TableHead>
										<TableRow>
											<TableCell>{t('Rule')}</TableCell>
											<TableCell>{t('State')}</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{attestStates.map(s => (
											<TableRow key={s.labelKey}>
												<TableCell>{s.labels.rule ?? ''}</TableCell>
												<TableCell>{s.labels.state ?? t('Unknown value')}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
							<StatRow label={t('Enforcement faults')} value={snapshot ? selectSamples(snapshot, 'loxilb_ai_kv_enforcement_fault').filter(s => s.value > 0).length : 0} />
							<StatRow label={t('Attestation probe failures')} value={formatRate(familySumRate(history, 'loxilb_ai_kv_attest_probe_fail_total'), t)} />
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('KV subscriber freshness')}>
							{subscriberFreshness.length === 0 ? (
								<Typography variant="body2" color="text.secondary">
									{t('No data')}
								</Typography>
							) : (
								<Table size="small">
									<TableHead>
										<TableRow>
											<TableCell>{t('Service')}</TableCell>
											<TableCell>{t('Endpoint')}</TableCell>
											<TableCell align="right">{t('Last event')}</TableCell>
											<TableCell align="right">{t('Fresh')}</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{subscriberFreshness.map(s => {
											// This family's `ep` label IS the endpoint (no join
											// needed); `loxilb_kv_inventory_fresh` shares its label
											// pair, so the strict-match lookup stays exact.
											const fresh = snapshot
												? selectScalar(snapshot, 'loxilb_kv_inventory_fresh', {service: s.labels.service ?? '', ep: s.labels.ep ?? ''})
												: undefined;
											return (
												<TableRow key={s.labelKey}>
													<TableCell>{s.labels.service ?? ''}</TableCell>
													<TableCell>{s.labels.ep ?? ''}</TableCell>
													<TableCell align="right">
														{Number.isFinite(s.value) ? new Date(s.value * 1000).toLocaleTimeString() : t('N/A')}
													</TableCell>
													<TableCell align="right">{fresh === undefined ? t('N/A') : fresh === 1 ? t('Yes') : t('No')}</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							)}
						</PanelPaper>
					</Grid>
				</Grid>
			</ObservabilityStateFrame>
		</Box>
	);
}
