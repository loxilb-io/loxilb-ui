//---------------------------------------------------------
// Gateway summary dashboard cards (UI-MON-007)
//---------------------------------------------------------
// The five registry-driven gateway panels of the dashboard. Every Prometheus
// consumer here reads the SAME shared snapshot (one 10-second query), so
// their numbers agree by construction; the worker-freshness card is REST-fed
// with its own independent receive time, deliberately badged separately.
// The AI events card keeps the contract split visible: completed SSE
// streams and denial events are separate partial views, never a total.

import {Box, Link, Typography} from '@mui/material';
import {Link as RouterLink, useSearchParams} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useMemo} from 'react';
import {classifyViewState} from 'components/observability/observabilityState';
import ObservabilityStateFrame from 'components/observability/ObservabilityStateFrame';
import FreshnessBadge from 'components/observability/FreshnessBadge';
import {GPU_STATUS_CADENCE_MS, useDiagnostics, useGpuStatus} from 'hooks/query/gatewayTelemetryHooks';
import {METRICS_SNAPSHOT_CADENCE_MS, useMetricsSnapshot} from 'hooks/query/observabilityHooks';
import {fromThrownError} from 'connector/fetcher/opResultAdapter';
import {aggregateSum, selectSamples, selectScalar} from 'observability/selectors';
import {familySumRate} from 'observability/snapshotRates';
import {formatRate, StatRow} from 'pages/observability/common';
import {IInstance} from 'types/oam';
import {ObservabilityViewState} from 'types/observability';
import CardBase from './CardBase';

interface GwCardProps {
	instance: IInstance | null;
}

// Deep link that keeps the ?name= instance selection.
function ObservabilityLink({page, label}: {page: string; label: string}) {
	const [params] = useSearchParams();
	const name = params.get('name');
	return (
		<Link component={RouterLink} to={`/instance/observability/${page}${name ? `?name=${encodeURIComponent(name)}` : ''}`} variant="body2">
			{label}
		</Link>
	);
}

function useSnapshotCardState(instance: IInstance | null): ReturnType<typeof useMetricsSnapshot> & {state: ObservabilityViewState} {
	const q = useMetricsSnapshot(instance);
	const state = classifyViewState({
		applicable: true, // mounting is the registry's decision (DashboardPage)
		isLoading: q.isLoading,
		snapshot: q.snapshot,
		hasData: (q.snapshot?.diagnostics.totalSamples ?? 0) > 0,
		nowMs: Date.now(),
		cadenceMs: METRICS_SNAPSHOT_CADENCE_MS,
	});
	return {...q, state};
}

export function GwAiEventsCard({instance}: GwCardProps) {
	const {t} = useTranslation();
	const {history, state, refetch} = useSnapshotCardState(instance);

	const completed = useMemo(() => familySumRate(history, 'loxilb_ai_requests_total'), [history]);
	const denials = useMemo(
		() => [
			familySumRate(history, 'loxilb_ai_rate_limit_hits_total'),
			familySumRate(history, 'loxilb_ai_model_not_allowed_total'),
			familySumRate(history, 'loxilb_ai_token_quota_denied_total'),
		],
		[history],
	);
	// Sum only when every constituent has a real rate; a partial sum labeled
	// as "denials" would understate silently.
	const denialTotal = denials.every(d => d.kind === 'ok')
		? {kind: 'ok' as const, perSecond: denials.reduce((a, d) => a + (d.kind === 'ok' ? d.perSecond : 0), 0), intervalMs: 0}
		: denials.find(d => d.kind !== 'ok')!;

	return (
		<CardBase title={t('AI Events (partial views)')}>
			<ObservabilityStateFrame state={state} name={t('AI Events')} onRetry={refetch}>
				<StatRow label={t('Completed SSE streams')} value={formatRate(completed, t)} />
				<StatRow label={t('Denial events')} value={formatRate(denialTotal, t)} />
				<Typography variant="caption" color="text.secondary" display="block" sx={{mt: 0.5}}>
					{t('Not a total request rate — the gateway counts completed streams and denials separately.')}
				</Typography>
				<Box sx={{mt: 1}}>
					<ObservabilityLink page="ai" label={t('Open AI Traffic')} />
				</Box>
			</ObservabilityStateFrame>
		</CardBase>
	);
}

export function GwActiveStreamsCard({instance}: GwCardProps) {
	const {t} = useTranslation();
	const {snapshot, state, refetch} = useSnapshotCardState(instance);

	const streams = useMemo(() => (snapshot ? selectSamples(snapshot, 'loxilb_ai_active_streams') : []), [snapshot]);
	const total = aggregateSum(streams);

	return (
		<CardBase title={t('Active AI Streams')}>
			<ObservabilityStateFrame state={state} name={t('Active AI Streams')} onRetry={refetch}>
				<StatRow label={t('Total (sum over models)')} value={total.value ?? t('No data')} />
				<StatRow label={t('Models reporting')} value={total.finiteSamples} />
				<Box sx={{mt: 1}}>
					<ObservabilityLink page="ai" label={t('Open AI Traffic')} />
				</Box>
			</ObservabilityStateFrame>
		</CardBase>
	);
}

export function GwWorkerFreshnessCard({instance}: GwCardProps) {
	const {t} = useTranslation();
	const gpu = useGpuStatus(instance, true);

	let state: ObservabilityViewState;
	if (gpu.error) {
		const failure = fromThrownError('observability.gpu_status', gpu.error);
		state = failure.status === 'denied' ? {kind: 'denied', failure} : {kind: 'unavailable', failure};
	} else if (gpu.isLoading || !gpu.data) state = {kind: 'loading'};
	else if (gpu.data.data.enabled !== true) state = {kind: 'disabled', reasonKey: 'GPU monitoring is disabled on this instance.'};
	else state = {kind: 'ready'};

	const status = gpu.data?.data;
	return (
		<CardBase title={t('Worker Monitoring')}>
			<ObservabilityStateFrame state={state} name={t('Worker Monitoring')} onRetry={() => void gpu.refetch()}>
				<StatRow label={t('Workers tracked')} value={status?.worker_count ?? t('N/A')} />
				<StatRow label={t('Routing mode')} value={status?.routing_mode ?? t('N/A')} />
				<StatRow
					label={t('Last metrics update')}
					value={status?.last_metrics_update ? new Date(status.last_metrics_update).toLocaleTimeString() : t('N/A')}
				/>
				{gpu.data && (
					<Box sx={{mt: 1}} display="flex" gap={1} alignItems="center">
						<FreshnessBadge receivedAtMs={gpu.data.receivedAtMs} cadenceMs={GPU_STATUS_CADENCE_MS} />
						<ObservabilityLink page="workers" label={t('Open Workers')} />
					</Box>
				)}
			</ObservabilityStateFrame>
		</CardBase>
	);
}

export function GwKvExactCard({instance}: GwCardProps) {
	const {t} = useTranslation();
	const {snapshot, state, refetch} = useSnapshotCardState(instance);

	const attest = useMemo(() => (snapshot ? selectSamples(snapshot, 'loxilb_ai_kv_attest_state').filter(s => s.value > 0) : []), [snapshot]);
	const faults = useMemo(() => (snapshot ? selectSamples(snapshot, 'loxilb_ai_kv_enforcement_fault').filter(s => s.value > 0) : []), [snapshot]);
	const byState = useMemo(() => {
		const counts = new Map<string, number>();
		for (const s of attest) counts.set(s.labels.state ?? '?', (counts.get(s.labels.state ?? '?') ?? 0) + 1);
		return [...counts.entries()];
	}, [attest]);

	return (
		<CardBase title={t('KV Exact Enforcement')}>
			<ObservabilityStateFrame state={state} name={t('KV Exact Enforcement')} onRetry={refetch}>
				{byState.length === 0 ? (
					<Typography variant="body2" color="text.secondary">
						{t('No data')}
					</Typography>
				) : (
					byState.map(([attestState, count]) => <StatRow key={attestState} label={attestState} value={count} />)
				)}
				<StatRow label={t('Rules with enforcement faults')} value={faults.length} />
				<Box sx={{mt: 1}}>
					<ObservabilityLink page="pdkv" label={t('Open P/D & KV Cache')} />
				</Box>
			</ObservabilityStateFrame>
		</CardBase>
	);
}

export function GwPersistenceCard({instance}: GwCardProps) {
	const {t} = useTranslation();
	const {snapshot, history, state, refetch} = useSnapshotCardState(instance);
	// There is no last-persist timestamp metric family — that fact comes from
	// /diagnostics, an independent REST read with its own receive time (never
	// atomically consistent with the Prometheus rows above it).
	const diagnostics = useDiagnostics(instance, true);

	const dirty = snapshot ? selectScalar(snapshot, 'loxilb_config_dirty') : undefined;
	const autopersistFailures = snapshot ? selectScalar(snapshot, 'loxilb_autopersist_consecutive_failures') : undefined;
	const persistErrors = useMemo(
		() => (snapshot ? aggregateSum(selectSamples(snapshot, 'loxilb_persist_total', {result: 'error'})).value : undefined),
		[snapshot],
	);
	const persistRate = useMemo(() => familySumRate(history, 'loxilb_persist_total'), [history]);
	const lastPersistAt = diagnostics.data?.data.last_persist?.at;

	return (
		<CardBase title={t('Config Persistence')}>
			<ObservabilityStateFrame state={state} name={t('Config Persistence')} onRetry={refetch}>
				<StatRow label={t('Unsaved config changes')} value={dirty === undefined ? t('No data') : dirty > 0 ? t('Yes') : t('No')} />
				<StatRow label={t('Consecutive auto-persist failures')} value={autopersistFailures ?? t('No data')} />
				<StatRow label={t('Persist errors (cumulative)')} value={persistErrors ?? 0} />
				<StatRow label={t('Persist operations')} value={formatRate(persistRate, t)} />
				<StatRow
					label={t('Last persist')}
					value={lastPersistAt ? new Date(lastPersistAt).toLocaleTimeString() : t('No data')}
				/>
			</ObservabilityStateFrame>
		</CardBase>
	);
}
