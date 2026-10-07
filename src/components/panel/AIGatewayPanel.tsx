import {Alert, Grid2, Stack, Typography} from '@mui/material';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import KvExactStatusPanel from 'components/panel/KvExactStatusPanel';
import {t} from 'i18next';
import {CHWBL_TUNING_FIELDS, effectiveAIHash, isAIService, isChwblSelector, resolveAIEngine, resolveAITopology} from 'types/ai_gateway';
import {IFcEffective, IServiceArguments} from 'types/load_balancer';

function isSet(value: unknown): boolean {
	return value !== undefined && value !== null && value !== '' && value !== false && value !== 0;
}

function flag(value?: boolean): string {
	return value ? t('Enabled') : t('Disabled');
}

/** "value (source)", where the source says who decided it: the rule, the gateway's environment, or the product default. */
function withSource(value: string | number | undefined, source?: string): string | undefined {
	if (value === undefined) return undefined;
	return source ? `${value} (${SOURCE_NAMES[source] ? t(SOURCE_NAMES[source]) : source})` : String(value);
}

const SOURCE_NAMES: Record<string, string> = {rule: 'rule', env: 'environment', default: 'default'};

function ceiling(value: number): string | number {
	return value === 0 ? t('Unlimited') : value;
}

// These members are in `fc_effective` since the first gateway build that
// reports it, and the gateway fills every one from the data plane on each
// read. Its JSON drops a zero. So on a reported state an absent one of THESE
// is zero — "unlimited" for a ceiling, "none" for the queue, nothing
// executing or waiting — and is shown as that, not as a blank. An absent
// member outside this set is one the build does not report.
type FcBaseMember = 'max_outstanding' | 'ep_max_inflight' | 'prefill_max_inflight' | 'decode_max_inflight' | 'queue_depth' | 'queue_wait_ms' | 'inflight' | 'queued';

function base(effective: IFcEffective, member: FcBaseMember): number {
	return effective[member] ?? 0;
}

// ⚠️ Compact on purpose (observability scope): what is in force and who set
// it, what the pool holds now, plus the two states an operator must act on.
// Pool trends, per-tenant and per-endpoint detail stay in Grafana.
function AdmissionReadBack({effective, pd, readAtMs}: {effective?: IFcEffective; pd: boolean; readAtMs?: number}) {
	if (!effective) {
		// Absent is not "off": the gateway reports it only where its data plane
		// can read the pool state, so say what we know.
		return (
			<ValueBunch name={t('Admission Control')}>
				<Typography variant="body2" color="text.secondary">{t('Not reported by this gateway.')}</Typography>
			</ValueBunch>
		);
	}
	const source = effective.source ?? {};
	const adaptive = effective.adaptive === 'on';
	const declaredCeiling = base(effective, 'max_outstanding');
	const inForce = adaptive ? effective.effective_max_outstanding ?? 0 : declaredCeiling;
	const depth = base(effective, 'queue_depth');
	const queue = depth === 0 ? t('None (over the ceiling is refused)') : `${depth} / ${base(effective, 'queue_wait_ms')} ms`;
	const queued = base(effective, 'queued');
	const share = effective.tenant_max_share_pct;
	const held = effective.adapt_state === 'tightened' || effective.adapt_state === 'frozen';
	const readAt = readAtMs ? new Date(readAtMs).toLocaleTimeString() : undefined;

	return (
		<ValueBunch name={t('Admission Control')}>
			<Stack spacing={1}>
				{held && (
					<Alert severity="warning">
						{t('The adaptive ceiling is {{state}} at {{limit}} of {{max}} (reason: {{reason}}).', {
							state: effective.adapt_state,
							limit: effective.effective_max_outstanding ?? '?',
							max: declaredCeiling,
							reason: effective.adapt_reason ?? t('not reported'),
						})}
					</Alert>
				)}
				{queued > 0 && (
					<Alert severity="info">{t('{{count}} requests are waiting for capacity.', {count: queued})}</Alert>
				)}
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Admission Mode')} value={withSource(effective.mode, source.mode)} tooltip={t('The gate mode in force on the pool, and where it came from: the rule, the gateway environment, or the default.')} />
					<SingleTextBox label={t('Ceiling in Force')} value={withSource(ceiling(inForce), source.max_outstanding)} tooltip={t('Executing inference requests the pool admits now. Below the declared ceiling while an adaptive pool is tightened.')} />
					<SingleTextBox label={t('Executing Now')} value={base(effective, 'inflight')} tooltip={t('Inference requests executing on the pool when the rule list was read.')} />
					<SingleTextBox label={t('Waiting Now')} value={queued} tooltip={t('Inference requests waiting for capacity when the rule list was read.')} />
					<SingleTextBox label={t('Queue (depth / wait)')} value={withSource(queue, source.queue_depth)} tooltip={t('Requests that may wait for capacity, and how long.')} />
					{pd ? (
						<>
							<SingleTextBox label={t('Prefill Endpoint Ceiling')} value={withSource(ceiling(base(effective, 'prefill_max_inflight')), source.prefill_max_inflight)} tooltip={t('Executing prefill legs one endpoint admits.')} />
							<SingleTextBox label={t('Decode Endpoint Ceiling')} value={withSource(ceiling(base(effective, 'decode_max_inflight')), source.decode_max_inflight)} tooltip={t('Executing decode legs one endpoint admits.')} />
						</>
					) : (
						<SingleTextBox label={t('Endpoint Ceiling')} value={withSource(ceiling(base(effective, 'ep_max_inflight')), source.ep_max_inflight)} tooltip={t('Executing inference requests one endpoint admits.')} />
					)}
					{share !== undefined && share !== 0 && share !== 100 && (
						<SingleTextBox label={t('Tenant Max Share (%)')} value={withSource(share, source.tenant_max_share_pct)} tooltip={t('The most of the ceiling and of the queue one tenant may hold.')} />
					)}
				</Grid2>
				{/* The counts are one read of a pool that moves with traffic, and
				    this list is not polled: say when. A read that failed since is
				    the page's "Out of date" banner to report. */}
				{readAt && (
					<Typography variant="caption" color="text.secondary">
						{t('Executing and waiting are as read at {{time}} and move with traffic. Refresh the list to read them again.', {time: readAt})}
					</Typography>
				)}
			</Stack>
		</ValueBunch>
	);
}

const KV_EXACT_MODES: Record<number, string> = {
	0: 'Off',
	1: 'P/D exact',
	3: 'Single-role exact',
};

export default function AIGatewayPanel({serviceArguments, readAtMs}: {serviceArguments: IServiceArguments; readAtMs?: number}) {
	const aiValues = [
		serviceArguments.kvEngineType,
		serviceArguments.model_name,
		serviceArguments.api_key_auth,
		serviceArguments.trace_type,
		serviceArguments.session_header_name,
		serviceArguments.chwbl_prefix_hash_level,
		serviceArguments.chwbl_prefix_hash_flags,
		serviceArguments.sse_mode,
		serviceArguments.max_stream_duration_sec,
		serviceArguments.backend_keepalive_interval_sec,
		serviceArguments.pd_disagg_mode,
		serviceArguments.pd_cache_aware_mode,
		serviceArguments.pd_session_ttl_sec,
		serviceArguments.pd_prefill_timeout_sec,
		serviceArguments.pd_cache_threshold,
		serviceArguments.pd_balance_abs_threshold,
		serviceArguments.kvExactMode,
		serviceArguments.kvBlockSize,
		serviceArguments.kvHashAlgo,
		serviceArguments.kvZmqPort,
		serviceArguments.kvWarmupSec,
		serviceArguments.kvDpRankCount,
		serviceArguments.pdBootstrapPort,
		serviceArguments.kvModelProfile,
		serviceArguments.kvExactApiMode,
		serviceArguments.fc_effective,
	];

	// Ring tuning is rendered on `!== undefined` (a reported `false` or 0 is a
	// state), and only on a rule that builds a ring — the gate matches both.
	const chwblRing = serviceArguments.mode === 4 && isChwblSelector(serviceArguments.sel);
	const ringTuningReported = chwblRing && CHWBL_TUNING_FIELDS.some(field => serviceArguments[field] !== undefined);

	if (!aiValues.some(isSet) && !ringTuningReported) {
		return (
			<Typography variant="body2" color="text.secondary">
				{t('No AI Gateway features are configured for this rule.')}
			</Typography>
		);
	}

	const engine = resolveAIEngine(serviceArguments.kvEngineType);
	const topology = resolveAITopology(serviceArguments);
	const exactMode = serviceArguments.kvExactMode ?? 0;
	const exactModeValue = t(KV_EXACT_MODES[exactMode] ?? `Unknown (${exactMode})`);
	const explicitHash = serviceArguments.kvHashAlgo;
	const hash = explicitHash ?? effectiveAIHash(engine);
	const hashValue = hash ? `${hash} (${explicitHash ? t('explicit') : t('engine default')})` : t('Not applicable');
	const eventTransport = exactMode === 0
		? t('Disabled')
		: engine === 'trtllm'
			? t('HTTP drain on endpoint serving ports')
			: t('ZMQ');

	return (
		<Stack spacing={2}>
			{/* ⚠️ The NAMES here must track AIGatewaySettingsForm's, which is where
			    this value is set. They drifted when the JWT arc widened the enum:
			    the form became "Credential Policy" / "Unmanaged (no policy)" while
			    this panel still read "API Key Policy" / "Preserve / unmanaged" —
			    two names for one field, and the older one is wrong outright once
			    the value is `jwt`. (Neither old string was a locale key either, so
			    they rendered untranslated.) */}
			<ValueBunch name={t('Data-plane Credential Policy')}>
				<Grid2 container spacing={2}>
					<SingleTextBox
						label={t('Declared Policy')}
						value={serviceArguments.api_key_auth ?? t('Unmanaged (no policy)')}
						tooltip={t('This is the declaration returned by the Gateway. Omission is distinct from explicit disabled.')}
					/>
				</Grid2>
			</ValueBunch>

			<ValueBunch name={t('Engine & Topology')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('AI Engine')} value={engine} tooltip={t('The engine type is immutable after rule creation.')} />
					<SingleTextBox label={t('Topology')} value={topology} tooltip={t('Plain, prefill/decode, or single-role KV-exact routing.')} />
					<SingleTextBox label={t('Event Transport')} value={eventTransport} tooltip={t('TRT-LLM uses the endpoint HTTP drain; vLLM and SGLang use ZMQ for exact routing.')} />
				</Grid2>
			</ValueBunch>

			<ValueBunch name={t('Model Routing & Session')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Model Name')} value={serviceArguments.model_name} tooltip={t('Endpoint-pool selector for AI model routing.')} />
					<SingleTextBox label={t('Trace Type')} value={serviceArguments.trace_type} tooltip={t('Tracing catalog name for deep inspection.')} />
					<SingleTextBox label={t('Session Header Name')} value={serviceArguments.session_header_name} tooltip={t('Header carrying the persistent-routing session key.')} />
					<SingleTextBox label={t('CHWBL Prefix Hash Level')} value={serviceArguments.chwbl_prefix_hash_level} tooltip={t('CHWBL prefix hash level.')} />
					<SingleTextBox label={t('CHWBL Prefix Hash Flags')} value={serviceArguments.chwbl_prefix_hash_flags} tooltip={t('CHWBL prefix hash flags.')} />
					{/* Ring tuning as the gateway resolved it — a row only where it
					    reports one, so a gateway without the field shows nothing
					    rather than a default this UI made up. */}
					{chwblRing && serviceArguments.chwbl_mean_load_factor !== undefined && (
						<SingleTextBox label={t('CHWBL Mean Load Factor (%)')} value={serviceArguments.chwbl_mean_load_factor} tooltip={t('How far above the mean load an endpoint may go before the ring moves on to the next one.')} />
					)}
					{chwblRing && serviceArguments.chwbl_replication !== undefined && (
						<SingleTextBox
							label={t('CHWBL Replication')}
							value={serviceArguments.chwbl_replication}
							tooltip={serviceArguments.sel === 10 ? t('Total virtual nodes on the hash ring, shared between the positive-weight endpoints.') : t('Virtual nodes per endpoint on the hash ring.')}
						/>
					)}
					{chwblRing && serviceArguments.chwbl_enable_cache_salt !== undefined && (
						<SingleTextBox
							label={t('Require cache_salt')}
							value={serviceArguments.chwbl_enable_cache_salt ? t('Required') : t('Not required')}
							tooltip={t('When required, a request without a valid cache_salt is refused with HTTP 400 before it reaches a backend.')}
						/>
					)}
				</Grid2>
			</ValueBunch>

			<ValueBunch name={t('SSE Streaming')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('SSE Mode')} value={flag(serviceArguments.sse_mode)} tooltip={t('Suppresses idle timeout during active streams.')} />
					<SingleTextBox label={t('Max Stream Duration (s)')} value={serviceArguments.max_stream_duration_sec} tooltip={t('Absolute cap for SSE streams.')} />
					<SingleTextBox label={t('Backend Keepalive Interval (s)')} value={serviceArguments.backend_keepalive_interval_sec} tooltip={t('Backend socket keepalive interval.')} />
				</Grid2>
			</ValueBunch>

			{isAIService(serviceArguments) && <AdmissionReadBack effective={serviceArguments.fc_effective} pd={topology === 'pd'} readAtMs={readAtMs} />}

			{topology === 'pd' && (
				<ValueBunch name={t('Prefill / Decode Disaggregation')}>
					<Grid2 container spacing={2}>
						<SingleTextBox label={t('P/D Disaggregation Mode')} value={flag(serviceArguments.pd_disagg_mode)} tooltip={t('Prefill/decode orchestration for the selected engine.')} />
						<SingleTextBox label={t('P/D Cache-Aware Mode')} value={flag(serviceArguments.pd_cache_aware_mode)} tooltip={t('P/D cache-aware routing.')} />
						<SingleTextBox label={t('P/D Session TTL (s)')} value={serviceArguments.pd_session_ttl_sec} tooltip={t('Session stickiness TTL for P/D routing.')} />
						<SingleTextBox label={t('P/D Prefill Timeout (s)')} value={serviceArguments.pd_prefill_timeout_sec || t('Gateway default')} tooltip={t('Longest wait for the prefill stage before 504. 0 or omitted uses the gateway default.')} />
						<SingleTextBox label={t('P/D Cache Threshold')} value={serviceArguments.pd_cache_threshold} tooltip={t('Cache match threshold.')} />
						<SingleTextBox label={t('P/D Balance Abs Threshold')} value={serviceArguments.pd_balance_abs_threshold} tooltip={t('Load-imbalance bypass threshold.')} />
						{engine === 'sglang' && <SingleTextBox label={t('P/D Bootstrap Port')} value={serviceArguments.pdBootstrapPort || 8998} tooltip={t('0 or omitted resolves to SGLang default 8998.')} />}
					</Grid2>
				</ValueBunch>
			)}

			{engine !== 'llamacpp' && (exactMode !== 0 || [serviceArguments.kvBlockSize, serviceArguments.kvHashAlgo, serviceArguments.kvZmqPort].some(isSet)) && (
				<ValueBunch name={t('KV-Cache Routing')}>
					<Grid2 container spacing={2}>
						<SingleTextBox label={t('KV Exact Mode')} value={exactModeValue} tooltip={t('Mode 1 is P/D exact; mode 3 is single-role exact. Mode 2 is reserved.')} />
						<SingleTextBox label={t('KV Block/Page Size')} value={serviceArguments.kvBlockSize} tooltip={t('Must match the live engine block/page size.')} />
						<SingleTextBox label={t('KV Hash Algorithm')} value={hashValue} tooltip={t('Omitted values use the coherent engine default.')} />
						{engine !== 'trtllm' && <SingleTextBox label={t('KV ZMQ Port')} value={serviceArguments.kvZmqPort} tooltip={t('Base event-publisher port.')} />}
						<SingleTextBox label={t('KV Warmup (s)')} value={serviceArguments.kvWarmupSec} tooltip={t('Inventory warmup before exact routing activates.')} />
						{engine === 'sglang' && exactMode === 3 && <SingleTextBox label={t('KV DP Rank Count')} value={serviceArguments.kvDpRankCount || 1} tooltip={t('Ranks publish at base ZMQ port plus rank index.')} />}
						{/* DECLARED binding only — the resolved/live position renders in the
						    separate enforcement-status section below, never merged here. */}
						<SingleTextBox label={t('Model Profile (declared)')} value={serviceArguments.kvModelProfile ?? t('None — legacy profile-less rule')} tooltip={t('Bound ModelPromptProfile ID as declared on the rule. Immutable after create.')} />
						{serviceArguments.kvModelProfile && <SingleTextBox label={t('API Surface (declared)')} value={serviceArguments.kvExactApiMode ?? t('Profile default')} tooltip={t('Declared KV-exact API surface. Immutable after create.')} />}
					</Grid2>
				</ValueBunch>
			)}

			{engine === 'llamacpp' && (
				<Alert severity="info">
					{t('llama.cpp uses plain load balancing or CHWBL/session affinity and has no KV event plane or P/D controls.')}
				</Alert>
			)}

			{/* Resolved status — a dedicated read model, kept structurally apart
			    from the declared configuration above (renders only on KV-exact rules). */}
			<KvExactStatusPanel serviceArguments={serviceArguments} />
		</Stack>
	);
}
