//---------------------------------------------------------
// AI Traffic observability page (UI-MON-008 — partial by contract)
//---------------------------------------------------------
// Two SEPARATE, explicitly-labeled event views and nothing pretending to be
// a total: `loxilb_ai_requests_total` counts COMPLETED SSE STREAMS only
// (non-streaming successes are counted nowhere) and denials are counted at
// the point of denial — no combination yields total request rate or a true
// error ratio, so those panels do not exist here until the gateway ships a
// complete denominator (tracked as a gateway handoff). Rendering their sum
// or ratio under a "total"/"error rate" heading is a contract violation.

import {Alert, Box, Grid, Table, TableBody, TableCell, TableHead, TableRow, Typography} from '@mui/material';
import FreshnessBadge from 'components/observability/FreshnessBadge';
import ObservabilityStateFrame from 'components/observability/ObservabilityStateFrame';
import {classifyViewState} from 'components/observability/observabilityState';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {METRICS_SNAPSHOT_CADENCE_MS, useMetricsSnapshot} from 'hooks/query/observabilityHooks';
import {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {estimateQuantile, mergeHistogramSeries} from 'observability/histogram';
import {aggregateSum, selectSamples} from 'observability/selectors';
import {familySumRate, groupRates} from 'observability/snapshotRates';
import {formatRate, ModelName, PanelPaper, StatRow, useObservabilityApplicable} from './common';

export default function AITrafficPage() {
	const {t} = useTranslation();
	const instance = useInstanceFromURL();
	const applicable = useObservabilityApplicable('page.aiTraffic');
	const {snapshot, history, isLoading, refetch} = useMetricsSnapshot(applicable ? instance : null);

	const completedByStatus = useMemo(() => (snapshot ? groupRates(history, 'loxilb_ai_requests_total', ['status']) : []), [snapshot, history]);
	const completedTotal = useMemo(() => familySumRate(history, 'loxilb_ai_requests_total'), [history]);
	const denialRates = useMemo(
		() =>
			snapshot
				? [
						{key: t('Rate limited'), rate: familySumRate(history, 'loxilb_ai_rate_limit_hits_total')},
						{key: t('Model not allowed'), rate: familySumRate(history, 'loxilb_ai_model_not_allowed_total')},
						{key: t('Token quota denied'), rate: familySumRate(history, 'loxilb_ai_token_quota_denied_total')},
					]
				: [],
		[snapshot, history, t],
	);
	const activeStreams = useMemo(() => (snapshot ? selectSamples(snapshot, 'loxilb_ai_active_streams') : []), [snapshot]);
	const tokenRates = useMemo(
		() =>
			snapshot
				? {
						byKind: groupRates(history, 'loxilb_ai_tokens_consumed_total', ['kind']),
						estimated: familySumRate(history, 'loxilb_ai_tokens_estimated_total'),
						missing: familySumRate(history, 'loxilb_ai_tokens_missing_total'),
					}
				: undefined,
		[snapshot, history],
	);
	const latency = useMemo(() => {
		const family = snapshot?.families.get('loxilb_ai_request_duration_seconds');
		if (!family || family.samples.length === 0) return undefined;
		const merged = mergeHistogramSeries(family);
		if (merged.kind !== 'ok') return {invalid: merged.reason} as const;
		const q = (p: number) => estimateQuantile(merged.series, p);
		return {p50: q(0.5), p95: q(0.95), p99: q(0.99), count: merged.series.count} as const;
	}, [snapshot]);

	const hasData = (snapshot?.diagnostics.totalSamples ?? 0) > 0;
	const state = classifyViewState({
		applicable,
		isLoading,
		snapshot,
		hasData,
		nowMs: Date.now(),
		cadenceMs: METRICS_SNAPSHOT_CADENCE_MS,
	});

	const quantileText = (r: ReturnType<typeof estimateQuantile>) => {
		if (r.kind === 'ok') return `${(r.value * 1000).toFixed(0)} ms`;
		if (r.kind === 'above-ladder') return t('Above bucket range');
		return t('N/A');
	};

	return (
		<Box sx={{p: 2}}>
			<Box display="flex" alignItems="center" gap={2} sx={{mb: 2}}>
				<Typography variant="h5">{t('AI Traffic')}</Typography>
				{snapshot && !snapshot.failure && <FreshnessBadge receivedAtMs={snapshot.receivedAtMs} cadenceMs={METRICS_SNAPSHOT_CADENCE_MS} />}
			</Box>

			<Alert severity="info" sx={{mb: 2}}>
				{t('Completed SSE streams and denial events are separate, partial views. The gateway does not yet expose a complete request denominator, so no total request rate or error ratio can be shown.')}
			</Alert>

			<ObservabilityStateFrame state={state} name={t('AI Traffic')} onRetry={refetch}>
				<Grid container spacing={2}>
					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Completed SSE streams (not total requests)')}>
							<StatRow label={t('All statuses')} value={formatRate(completedTotal, t)} />
							{completedByStatus.map(g => (
								<StatRow key={g.labels.status ?? ''} label={g.labels.status ?? t('(no status)')} value={formatRate(g.rate, t)} />
							))}
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Denial events (counted at point of denial)')}>
							{denialRates.map(d => (
								<StatRow key={d.key} label={d.key} value={formatRate(d.rate, t)} />
							))}
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Active streams by model')}>
							{activeStreams.length === 0 ? (
								<Typography variant="body2" color="text.secondary">
									{t('No data')}
								</Typography>
							) : (
								<Table size="small">
									<TableHead>
										<TableRow>
											<TableCell>{t('Model')}</TableCell>
											<TableCell align="right">{t('Active streams')}</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{activeStreams.map(s => (
											<TableRow key={s.labelKey}>
												<TableCell>
													<ModelName model={s.labels.model ?? ''} />
												</TableCell>
												<TableCell align="right">{Number.isFinite(s.value) ? s.value : t('N/A')}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Token accounting')}>
							{tokenRates && (
								<>
									{tokenRates.byKind.map(g => (
										<StatRow
											key={g.labels.kind ?? ''}
											label={t('Consumed ({{kind}})', {kind: g.labels.kind ?? t('unknown')})}
											value={formatRate(g.rate, t, t('/s'))}
										/>
									))}
									<StatRow label={t('Estimated (usage block absent)')} value={formatRate(tokenRates.estimated, t)} />
									<StatRow label={t('Missing (unaccountable)')} value={formatRate(tokenRates.missing, t)} />
								</>
							)}
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Request duration (completed streams, all models)')}>
							{latency === undefined ? (
								<Typography variant="body2" color="text.secondary">
									{t('No data')}
								</Typography>
							) : 'invalid' in latency ? (
								<Typography variant="body2" color="text.secondary">
									{t('Histogram invalid: {{reason}}', {reason: latency.invalid})}
								</Typography>
							) : (
								<>
									<StatRow label="p50" value={quantileText(latency.p50)} />
									<StatRow label="p95" value={quantileText(latency.p95)} />
									<StatRow label="p99" value={quantileText(latency.p99)} />
									<StatRow label={t('Observations')} value={latency.count} />
								</>
							)}
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Session affinity')}>
							<StatRow label={t('Normal session hits')} value={formatRate(familySumRate(history, 'loxilb_ai_normal_session_hits_total'), t)} />
							<StatRow
								label={t('Engines reporting')}
								value={snapshot ? aggregateSum(selectSamples(snapshot, 'loxilb_ai_engine_info')).finiteSamples : 0}
							/>
						</PanelPaper>
					</Grid>
				</Grid>
			</ObservabilityStateFrame>
		</Box>
	);
}
