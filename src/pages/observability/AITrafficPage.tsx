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
//
// Compact by rule (owner, 2026-09-29): this page carries the headline and the
// urgent signals only. Per-status, per-reason, token, latency and affinity
// breakdowns are Grafana's (dashboard `loxilb-ai`); the lifetime quantiles
// that used to sit here never showed current latency anyway.

import {Box, Grid, Typography} from '@mui/material';
import FreshnessBadge from 'components/observability/FreshnessBadge';
import {AIAdmissionPanel, ProxyOverloadPanel} from 'components/observability/AIAdmissionPanel';
import BearerAdmissionPanel from 'components/observability/BearerAdmissionPanel';
import ObservabilityStateFrame from 'components/observability/ObservabilityStateFrame';
import {classifyViewState} from 'components/observability/observabilityState';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useMetricsSnapshot} from 'hooks/query/observabilityHooks';
import {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {aggregateSum, selectSamples} from 'observability/selectors';
import {aiAdmission, proxyOverload} from 'observability/aiAdmission';
import {completedRequestRate, denialTotalRate, requestOutcomes} from 'observability/aiRequests';
import {bearerAdmission} from 'observability/jwtAuth';
import {rateMaxGapMs} from 'observability/snapshotRates';
import {CadenceSelector, PanelPaper, StatRow, formatRate, formatRatio, useAbsenceExplanation, useObservabilityApplicable} from './common';

export default function AITrafficPage() {
	const {t} = useTranslation();
	const instance = useInstanceFromURL();
	const applicable = useObservabilityApplicable('page.aiTraffic');
	const {snapshot, history, isLoading, cadenceMs, refetch} = useMetricsSnapshot(applicable ? instance : null);
	// Stage 3.5: let the no-data state say WHY, from the manifest contract.
	const absence = useAbsenceExplanation('page.aiTraffic', snapshot);
	const maxGap = rateMaxGapMs(cadenceMs);

	// Offered load / denials / error ratio, or the typed refusal to derive them
	// on a gateway that predates the outcome label. One detection feeds both
	// renderings, so they can never disagree about the exposition.
	const outcomes = useMemo(() => requestOutcomes(history, maxGap), [history, maxGap]);
	// Unpartitioned gateways only: the two partial views the dashboard card
	// also shows. outcome="completed" where reported; the denial total is
	// counted once (never a sum of the overlapping reason families).
	const completedTotal = useMemo(() => completedRequestRate(history, maxGap), [history, maxGap]);
	const denialTotal = useMemo(() => denialTotalRate(history, maxGap), [history, maxGap]);
	// J3 — the bearer arm's admit/deny breakdown. Traffic, so it lives here;
	// per-profile keyset health lives on the JWT Auth Profiles page instead.
	const bearer = useMemo(() => bearerAdmission(snapshot, history, maxGap), [snapshot, history, maxGap]);
	// Registered apart from the page: a gateway without the capacity gate (or
	// the listener counters) loses only these panels.
	const admissionApplicable = useObservabilityApplicable('panel.aiAdmission');
	const overloadApplicable = useObservabilityApplicable('panel.proxyOverload');
	const admission = useMemo(() => aiAdmission(snapshot, history, maxGap), [snapshot, history, maxGap]);
	const overload = useMemo(() => proxyOverload(snapshot, history, maxGap), [snapshot, history, maxGap]);
	// One total, the same derivation as the dashboard card; per model is Grafana's.
	const activeStreams = useMemo(() => aggregateSum(snapshot ? selectSamples(snapshot, 'loxilb_ai_active_streams') : []), [snapshot]);

	const hasData = (snapshot?.diagnostics.totalSamples ?? 0) > 0;
	const state = classifyViewState({
		applicable,
		isLoading,
		snapshot,
		hasData,
		nowMs: Date.now(),
		cadenceMs,
	});

	return (
		<Box sx={{p: 2}}>
			<Box display="flex" alignItems="center" gap={2} sx={{mb: 2}}>
				<Typography variant="h5" component="h2">{t('AI Traffic')}</Typography>
				{snapshot && !snapshot.failure && <FreshnessBadge receivedAtMs={snapshot.receivedAtMs} cadenceMs={cadenceMs} />}
				<CadenceSelector />
			</Box>

			<ObservabilityStateFrame state={state} absence={absence} name={t('AI Traffic')} onRetry={refetch}>
				<Grid container spacing={2}>
					{outcomes.kind === 'partitioned' ? (
						<Grid item xs={12} md={6}>
							<PanelPaper title={t('Request outcomes (offered load)')}>
								<StatRow label={t('Total offered')} value={formatRate(outcomes.offered, t)} />
								<StatRow label={t('Completed (answered by a backend)')} value={formatRate(outcomes.completed, t)} />
								<StatRow label={t('Denied at gate')} value={formatRate(outcomes.denied, t)} />
								<StatRow label={t('Failed responses (4xx/5xx)')} value={formatRate(outcomes.failed, t)} />
								<StatRow label={t('Error ratio (denied + failed)')} value={formatRatio(outcomes.errorRatio, t)} />
							</PanelPaper>
						</Grid>
					) : (
						// No offered-load denominator on this gateway: the unfiltered
						// sum is the completed count, so captioning it "total" would
						// restate the very falsehood the caption prevents.
						<Grid item xs={12} md={6}>
							<PanelPaper title={t('Completed requests (not total requests)')}>
								<StatRow label={t('Completed requests')} value={formatRate(completedTotal, t)} />
								<StatRow label={t('Denial events')} value={formatRate(denialTotal, t)} />
								<Typography variant="caption" color="text.secondary" display="block" sx={{mt: 0.5}}>
									{t('Completed requests and denial events are separate, partial views. The gateway does not yet expose a complete request denominator, so no total request rate or error ratio can be shown.')}
								</Typography>
							</PanelPaper>
						</Grid>
					)}

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Active AI Streams')}>
							<StatRow label={t('Total (sum over models)')} value={activeStreams.value ?? t('No data')} />
							<StatRow label={t('Models reporting')} value={activeStreams.finiteSamples} />
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

					{admissionApplicable && (
						<Grid item xs={12} md={6}>
							<PanelPaper title={t('Admission gate (capacity)')}>
								<AIAdmissionPanel report={admission} />
							</PanelPaper>
						</Grid>
					)}

					{overloadApplicable && (
						<Grid item xs={12} md={6}>
							<PanelPaper title={t('Listener overload')}>
								<ProxyOverloadPanel report={overload} />
							</PanelPaper>
						</Grid>
					)}
				</Grid>
			</ObservabilityStateFrame>
		</Box>
	);
}
