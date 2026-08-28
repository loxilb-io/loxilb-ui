import {Alert, Grid2, Stack, Typography} from '@mui/material';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import {t} from 'i18next';
import {effectiveAIHash, resolveAIEngine, resolveAITopology} from 'types/ai_gateway';
import {IServiceArguments} from 'types/load_balancer';

function isSet(value: unknown): boolean {
	return value !== undefined && value !== null && value !== '' && value !== false && value !== 0;
}

function flag(value?: boolean): string {
	return value ? t('Enabled') : t('Disabled');
}

const KV_EXACT_MODES: Record<number, string> = {
	0: 'Off',
	1: 'P/D exact',
	3: 'Single-role exact',
};

export default function AIGatewayPanel({serviceArguments}: {serviceArguments: IServiceArguments}) {
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
		serviceArguments.pd_cache_threshold,
		serviceArguments.pd_balance_abs_threshold,
		serviceArguments.kvExactMode,
		serviceArguments.kvBlockSize,
		serviceArguments.kvHashAlgo,
		serviceArguments.kvZmqPort,
		serviceArguments.kvWarmupSec,
		serviceArguments.kvDpRankCount,
		serviceArguments.pdBootstrapPort,
	];

	if (!aiValues.some(isSet)) {
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
			<ValueBunch name={t('Data-plane API Key Policy')}>
				<Grid2 container spacing={2}>
					<SingleTextBox
						label={t('Declared Policy')}
						value={serviceArguments.api_key_auth ?? t('Preserve / unmanaged')}
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
				</Grid2>
			</ValueBunch>

			<ValueBunch name={t('SSE Streaming')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('SSE Mode')} value={flag(serviceArguments.sse_mode)} tooltip={t('Suppresses idle timeout during active streams.')} />
					<SingleTextBox label={t('Max Stream Duration (s)')} value={serviceArguments.max_stream_duration_sec} tooltip={t('Absolute cap for SSE streams.')} />
					<SingleTextBox label={t('Backend Keepalive Interval (s)')} value={serviceArguments.backend_keepalive_interval_sec} tooltip={t('Backend socket keepalive interval.')} />
				</Grid2>
			</ValueBunch>

			{topology === 'pd' && (
				<ValueBunch name={t('Prefill / Decode Disaggregation')}>
					<Grid2 container spacing={2}>
						<SingleTextBox label={t('P/D Disaggregation Mode')} value={flag(serviceArguments.pd_disagg_mode)} tooltip={t('Prefill/decode orchestration for the selected engine.')} />
						<SingleTextBox label={t('P/D Cache-Aware Mode')} value={flag(serviceArguments.pd_cache_aware_mode)} tooltip={t('P/D cache-aware routing.')} />
						<SingleTextBox label={t('P/D Session TTL (s)')} value={serviceArguments.pd_session_ttl_sec} tooltip={t('Session stickiness TTL for P/D routing.')} />
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
					</Grid2>
				</ValueBunch>
			)}

			{engine === 'llamacpp' && (
				<Alert severity="info">
					{t('llama.cpp uses plain load balancing or CHWBL/session affinity and has no KV event plane or P/D controls.')}
				</Alert>
			)}
		</Stack>
	);
}
