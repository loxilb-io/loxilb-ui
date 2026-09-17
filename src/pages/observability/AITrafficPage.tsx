//---------------------------------------------------------
// AI Traffic observability page (UI-MON-008)
//---------------------------------------------------------
// Rendering a sum or a ratio under a "total"/"error rate" heading is a contract
// violation unless the families actually yield one. Historically none did, so
// those panels did not exist and the page said so on its face.
//
// Gateway 27680379 supplied the missing denominator: `loxilb_ai_requests_total`
// counts gate denials too, partitioned by `outcome`, and the two values are
// mutually exclusive per request — so the unfiltered family IS offered load and
// a ratio over it is real. The totals and error-ratio panel is built on that.
//
// ⚠️ The page therefore has TWO rendering paths, decided by
// `requestOutcomes()` from the LIVE exposition rather than from the vendored
// manifest, because the instance in front of the operator may be older than the
// UI. Partitioned: the outcomes panel renders and the old notice is gone.
// Unpartitioned: the panel is absent and the original notice is still the
// honest answer — on that gateway the unfiltered sum is the completed count, so
// captioning it "total" would restate the very falsehood the notice prevents.
// The notice is CONDITIONAL, not deleted.
//
// The completed views select outcome="completed" on both shapes, so a denial is
// never counted as a served request.

import {Alert, Box, Grid, Table, TableBody, TableCell, TableHead, TableRow, Typography} from '@mui/material';
import FreshnessBadge from 'components/observability/FreshnessBadge';
import BearerAdmissionPanel from 'components/observability/BearerAdmissionPanel';
import ObservabilityStateFrame from 'components/observability/ObservabilityStateFrame';
import {classifyViewState} from 'components/observability/observabilityState';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useMetricsSnapshot} from 'hooks/query/observabilityHooks';
import {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {estimateQuantile, mergeHistogramSeries} from 'observability/histogram';
import {aggregateSum, selectSamples} from 'observability/selectors';
import {completedRequestRate, completedRequestRatesBy, requestOutcomes} from 'observability/aiRequests';
import {bearerAdmission} from 'observability/jwtAuth';
import {familySumRate, groupRates, rateMaxGapMs} from 'observability/snapshotRates';
import {CadenceSelector, ModelName, PanelPaper, StatRow, formatRate, formatRatio, useObservabilityApplicable} from './common';

export default function AITrafficPage() {
	const {t} = useTranslation();
	const instance = useInstanceFromURL();
	const applicable = useObservabilityApplicable('page.aiTraffic');
	const {snapshot, history, isLoading, cadenceMs, refetch} = useMetricsSnapshot(applicable ? instance : null);
	const maxGap = rateMaxGapMs(cadenceMs);

	// Restricted to outcome="completed" where the instance reports it: since
	// gateway 27680379 the family also carries denials, so summing it whole
	// would put denied requests under a "completed" heading.
	const completedByStatus = useMemo(() => (snapshot ? completedRequestRatesBy(history, ['status'], maxGap) : []), [snapshot, history, maxGap]);
	const completedTotal = useMemo(() => completedRequestRate(history, maxGap), [history, maxGap]);
	// Offered load / denials / error ratio, or the typed refusal to derive them
	// on a gateway that predates the outcome label. One detection feeds both the
	// panel and the notice, so they can never disagree about the exposition.
	const outcomes = useMemo(() => requestOutcomes(history, maxGap), [history, maxGap]);
	// J3 — the bearer arm's admit/deny breakdown. Traffic, so it lives here;
	// per-profile keyset health lives on the JWT Auth Profiles page instead.
	const bearer = useMemo(() => bearerAdmission(snapshot, history, maxGap), [snapshot, history, maxGap]);
	const denialRates = useMemo(
		() =>
			snapshot
				? [
						{key: t('Rate limited'), rate: familySumRate(history, 'loxilb_ai_rate_limit_hits_total', maxGap)},
						{key: t('Model not allowed'), rate: familySumRate(history, 'loxilb_ai_model_not_allowed_total', maxGap)},
						{key: t('Token quota denied'), rate: familySumRate(history, 'loxilb_ai_token_quota_denied_total', maxGap)},
					]
				: [],
		[snapshot, history, maxGap, t],
	);
	const activeStreams = useMemo(() => (snapshot ? selectSamples(snapshot, 'loxilb_ai_active_streams') : []), [snapshot]);
	const tokenRates = useMemo(
		() =>
			snapshot
				? {
						byKind: groupRates(history, 'loxilb_ai_tokens_consumed_total', ['kind'], maxGap),
						estimated: familySumRate(history, 'loxilb_ai_tokens_estimated_total', maxGap),
						missing: familySumRate(history, 'loxilb_ai_tokens_missing_total', maxGap),
					}
				: undefined,
		[snapshot, history, maxGap],
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
		cadenceMs,
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
				{snapshot && !snapshot.failure && <FreshnessBadge receivedAtMs={snapshot.receivedAtMs} cadenceMs={cadenceMs} />}
				<CadenceSelector />
			</Box>

			<Alert severity="info" sx={{mb: 2}}>
				{outcomes.kind === 'partitioned'
					? t('Total offered load and error ratio are derived from the request outcome partition. The denial events panel breaks the same denials down by reason, so each reason rate is a subset of the gate denial rate.')
					: t('Completed SSE streams and denial events are separate, partial views. The gateway does not yet expose a complete request denominator, so no total request rate or error ratio can be shown.')}
			</Alert>

			<ObservabilityStateFrame state={state} name={t('AI Traffic')} onRetry={refetch}>
				<Grid container spacing={2}>
					{/* Absent, not empty, on an unpartitioned gateway: there is no
					    offered-load denominator to render, and the notice above
					    carries that answer instead. */}
					{outcomes.kind === 'partitioned' && (
						<Grid item xs={12} md={6}>
							<PanelPaper title={t('Request outcomes (offered load)')}>
								<StatRow label={t('Total offered')} value={formatRate(outcomes.offered, t)} />
								<StatRow label={t('Completed (answered by a backend)')} value={formatRate(outcomes.completed, t)} />
								<StatRow label={t('Denied at gate')} value={formatRate(outcomes.denied, t)} />
								<StatRow label={t('Failed responses (4xx/5xx)')} value={formatRate(outcomes.failed, t)} />
								<StatRow label={t('Error ratio (denied + failed)')} value={formatRatio(outcomes.errorRatio, t)} />
							</PanelPaper>
						</Grid>
					)}

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Completed SSE streams (not total requests)')}>
							<StatRow label={t('All statuses')} value={formatRate(completedTotal, t)} />
							{completedByStatus.map(g => (
								<StatRow key={g.labels.status ?? ''} label={g.labels.status ?? t('(no status)')} value={formatRate(g.rate, t)} />
							))}
						</PanelPaper>
					</Grid>

					{/* ⚠️ Rendered on BOTH readings, because an absent family is
					    the expected one here and needs saying. These series are
					    conditional-with-proven-writer: nothing exports until a
					    rule selects the bearer arm AND a request carrying an
					    Authorization header reaches it. Printing 0/s instead
					    would assert that bearer auth is configured and idle. */}
					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Bearer token admission (JWT)')}>
							<BearerAdmissionPanel admission={bearer} />
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
							<StatRow label={t('Normal session hits')} value={formatRate(familySumRate(history, 'loxilb_ai_normal_session_hits_total', maxGap), t)} />
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
