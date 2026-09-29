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
//
// Compact by design (owner rule, 2026-09-29): each panel is a verdict plus
// what is urgent. The breakdowns — tiers by model, admission by valve, KV
// blocks by endpoint, the attestation ladder by rule, event times by
// subscriber — are in Grafana's `loxilb-ai` dashboard.

import {Alert, Box, Grid, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography} from '@mui/material';
import FreshnessBadge from 'components/observability/FreshnessBadge';
import ObservabilityStateFrame from 'components/observability/ObservabilityStateFrame';
import {classifyViewState} from 'components/observability/observabilityState';
import PDAdmissionPanel from 'components/observability/PDAdmissionPanel';
import PDTierMixPanel from 'components/observability/PDTierMixPanel';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useMetricsSnapshot} from 'hooks/query/observabilityHooks';
import {useLoadBalancerConfig} from 'hooks/query/queryHooks';
import {useCallback, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {kvAttestation, kvSubscribers} from 'observability/kvHealth';
import {buildEpJoinIndex, joinEp} from 'observability/pdJoin';
import {pdAdmission} from 'observability/pdAdmission';
import {pdTierGates, pdTierMix} from 'observability/pdTiers';
import {formatReportedAt, reportedAtFromSeconds} from 'observability/reportedAt';
import {selectScalar} from 'observability/selectors';
import {familySumRate, rateMaxGapMs} from 'observability/snapshotRates';
import {CadenceSelector, PanelPaper, StatRow, formatRate, useAbsenceExplanation, useObservabilityApplicable} from './common';

export default function PdKvPage() {
	const {t} = useTranslation();
	const instance = useInstanceFromURL();
	const applicable = useObservabilityApplicable('page.pdKv');
	const {snapshot, history, isLoading, cadenceMs, refetch} = useMetricsSnapshot(applicable ? instance : null);
	// Stage 3.5: let the no-data state say WHY, from the manifest contract.
	const absence = useAbsenceExplanation('page.pdKv', snapshot);
	const maxGap = rateMaxGapMs(cadenceMs);

	// Which routing tiers this gateway's rules can reach. Read defensively:
	// a rule-list failure must never break the metric panels, and
	// `pdTierGates(undefined)` answers "configuration unknown" rather than
	// "nothing configured" — the tier mix then withholds its verdict instead
	// of calling a correct zero a fault.
	const {data: lbData, refetch: refetchLb} = useLoadBalancerConfig(applicable ? instance : null);
	const gates = useMemo(() => pdTierGates(Array.isArray(lbData) ? lbData : undefined), [lbData]);

	// ⚠️ Refresh must refetch EVERY query the page reads, not just the one it
	// is named after. The sibling defect on the JWT Auth Profiles page (found
	// live, fixed in J3) was exactly this: a second query left out of the
	// retry handler made a stale cell permanent, with no operator action able
	// to correct it.
	const refetchAll = useCallback(() => {
		refetch();
		refetchLb();
	}, [refetch, refetchLb]);

	const epJoin = useMemo(() => (snapshot ? buildEpJoinIndex(snapshot) : undefined), [snapshot]);
	const nowMs = Date.now();

	// The snapshot and the history are passed APART on purpose: the retention
	// ring is filled in an effect, so this page holds a snapshot while
	// `history` is still empty, and reading the current values off the history
	// tail would render "N/A" — "the scrape did not answer" — on a gateway
	// that had just answered.
	const tierMix = useMemo(() => pdTierMix(snapshot, history, maxGap, gates), [snapshot, history, maxGap, gates]);
	const admission = useMemo(() => pdAdmission(snapshot), [snapshot]);
	const attestation = useMemo(() => kvAttestation(snapshot), [snapshot]);
	const subscribers = useMemo(() => kvSubscribers(snapshot), [snapshot]);

	const hasData = (snapshot?.diagnostics.totalSamples ?? 0) > 0;
	const state = classifyViewState({
		applicable,
		isLoading,
		snapshot,
		hasData,
		nowMs: Date.now(),
		cadenceMs,
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
				<Typography variant="h5" component="h2">{t('P/D & KV Cache')}</Typography>
				{snapshot && !snapshot.failure && <FreshnessBadge receivedAtMs={snapshot.receivedAtMs} cadenceMs={cadenceMs} />}
				<CadenceSelector />
			</Box>

			<ObservabilityStateFrame state={state} absence={absence} name={t('P/D & KV Cache')} onRetry={refetchAll}>
				<Grid container spacing={2}>
					<Grid item xs={12}>
						<PanelPaper title={t('Prefill routing tier mix')}>
							<PDTierMixPanel report={tierMix} gates={gates} />
						</PanelPaper>
					</Grid>

					<Grid item xs={12}>
						<PanelPaper title={t('Admission pressure')}>
							{/* ⚠️ Drops read as ONE lifetime quantity across
							    both valves: the plain-shed counter alone is
							    pinned at zero whenever queueing is enabled. */}
							<PDAdmissionPanel report={admission} />
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={4}>
						<PanelPaper title={t('Sessions and routing')}>
							<StatRow label={t('P/D sessions active')} value={snapshot ? (selectScalar(snapshot, 'loxilb_pd_sessions_active') ?? t('No data')) : t('No data')} />
							<StatRow label={t('Fallbacks to normal routing')} value={formatRate(familySumRate(history, 'loxilb_pd_fallback_to_normal_total', maxGap), t)} />
							<StatRow label={t('Connect failovers')} value={formatRate(familySumRate(history, 'loxilb_pd_connect_failover_total', maxGap), t)} />
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={4}>
						<PanelPaper title={t('KV attestation')}>
							{attestation.kind === 'unavailable' && (
								<Typography variant="body2" color="text.secondary">
									{t('No data')}
								</Typography>
							)}
							{attestation.kind === 'not-running' && (
								<Typography variant="body2" color="text.secondary">
									{t('No rule reports a KV attestation state: none is configured for strict KV-exact attestation, or its data-plane contract has not installed yet.')}
								</Typography>
							)}
							{attestation.kind === 'ok' && (
								<Stack spacing={1}>
									{attestation.faulted === undefined ? (
										// Absent is not zero: the fault state is unreported, so
										// "none faulted" would be a claim nothing measured.
										<Alert severity="info">
											{t('{{n}} rules under strict KV attestation. The enforcement-fault state is not reported.', {n: attestation.rules})}
										</Alert>
									) : attestation.faulted > 0 ? (
										<Alert severity="error">
											{t('{{m}} of {{n}} rules under strict KV attestation report an enforcement fault.', {m: attestation.faulted, n: attestation.rules})}
										</Alert>
									) : (
										<Alert severity="success">
											{t('{{n}} rules under strict KV attestation, none with an enforcement fault.', {n: attestation.rules})}
										</Alert>
									)}
									{/* Shown only when above zero: a clean ladder run
									    creates no reason child, so there is nothing to
									    print on a healthy gateway. */}
									{(attestation.probeFailures ?? 0) > 0 && (
										<Alert severity="warning">
											{t('{{n}} attestation probe failures since the gateway started.', {n: attestation.probeFailures})}
										</Alert>
									)}
								</Stack>
							)}
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={4}>
						<PanelPaper title={t('KV subscriber freshness')}>
							{subscribers.kind === 'unavailable' && (
								<Typography variant="body2" color="text.secondary">
									{t('No data')}
								</Typography>
							)}
							{subscribers.kind === 'none' && (
								<Typography variant="body2" color="text.secondary">
									{t('No KV subscriber is running: no KV-exact rule has started one.')}
								</Typography>
							)}
							{subscribers.kind === 'ok' && (
								<Stack spacing={1}>
									<Alert severity={subscribers.notFresh.length === 0 ? 'success' : 'warning'}>
										{t('{{fresh}} of {{total}} KV subscribers fresh.', {fresh: subscribers.fresh, total: subscribers.total})}
									</Alert>
									{/* Only the ones that are not fresh: a healthy
									    subscriber needs no row. */}
									{subscribers.notFresh.length > 0 && (
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
												{subscribers.notFresh.map(row => (
													<TableRow key={`${row.service}/${row.epIdx}`}>
														<TableCell>{row.service}</TableCell>
														{/* The `ep` label is the ep_idx; the address comes
														    from the strict loxilb_pd_ep_info join. */}
														<TableCell>{epCell(row.service, row.epIdx)}</TableCell>
														<TableCell align="right">
															{row.lastEventSec === undefined ? t('None reported') : formatReportedAt(reportedAtFromSeconds(row.lastEventSec), nowMs, t)}
														</TableCell>
														<TableCell align="right">{row.fresh === undefined ? t('N/A') : t('No')}</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									)}
								</Stack>
							)}
						</PanelPaper>
					</Grid>
				</Grid>
			</ObservabilityStateFrame>
		</Box>
	);
}
