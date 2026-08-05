//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Grid2, Stack, Typography} from '@mui/material';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import {t} from 'i18next';
import {IServiceArguments} from 'types/load_balancer';

//---------------------------------------------------------
// Helpers
//---------------------------------------------------------
// Every AI-gateway field is opt-in, and the gateway reports the "off" state as
// 0 / false / "" rather than omitting the key. Treating those as unset is what
// lets a plain L4 rule show the empty state instead of a wall of zeroes.
function is_set(value: unknown): boolean {
	return value !== undefined && value !== null && value !== '' && value !== false && value !== 0;
}

// Feature flags read better as Enabled/Disabled than as "true"/"False".
function flag(value?: boolean): string {
	return value ? t('Enabled') : t('Disabled');
}

// kvExactMode is a small enum the gateway reports as a bare integer. Keys stay
// untranslated here and go through t() at render time — translating at module
// scope would freeze the strings to whichever language loaded first.
const KV_EXACT_MODES: Record<number, string> = {
	0: 'Off',
	1: 'ZMQ',
	2: 'NATS (reserved)',
	3: 'ZMQ single-role',
};

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function AIGatewayPanel(props: {serviceArguments: IServiceArguments}) {
	const {serviceArguments} = props;

	// The 16 AI fields the gateway round-trips on GET. llm_type is write-only and
	// kvWarmupSec / chwbl_mean_load_factor / chwbl_replication are not surfaced by
	// GET at all, so they are deliberately absent — this panel can only show what
	// the gateway returns.
	const ai_values = [
		serviceArguments.model_name,
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
	];

	if (!ai_values.some(is_set)) {
		return (
			<Typography variant="body2" color="text.secondary">
				{t('No AI Gateway features are configured for this rule.')}
			</Typography>
		);
	}

	const kv_exact_mode = serviceArguments.kvExactMode;
	const kv_exact_mode_label = kv_exact_mode === undefined ? undefined : KV_EXACT_MODES[kv_exact_mode];
	const kv_exact_mode_value = kv_exact_mode_label ? t(kv_exact_mode_label) : kv_exact_mode;

	return (
		<Stack spacing={2}>
			<ValueBunch name={t('Model Routing & Session')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Model Name')} value={serviceArguments.model_name} tooltip='Endpoint-pool selector for AI model routing (e.g. "llama-70b"). Empty = wildcard pool.' />
					<SingleTextBox label={t('Trace Type')} value={serviceArguments.trace_type} tooltip='Tracing catalog name for deep inspection (e.g. v1, anthropic, default).' />
					<SingleTextBox label={t('Session Header Name')} value={serviceArguments.session_header_name} tooltip='Header carrying the session key (used with sel=persist).' />
					<SingleTextBox label={t('CHWBL Prefix Hash Level')} value={serviceArguments.chwbl_prefix_hash_level} tooltip='CHWBL prefix hash level (sel=8).' />
					<SingleTextBox label={t('CHWBL Prefix Hash Flags')} value={serviceArguments.chwbl_prefix_hash_flags} tooltip='CHWBL prefix hash flags.' />
				</Grid2>
			</ValueBunch>

			<ValueBunch name={t('SSE Streaming')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('SSE Mode')} value={flag(serviceArguments.sse_mode)} tooltip='SSE streaming; suppresses idle-timeout during active streams.' />
					<SingleTextBox label={t('Max Stream Duration (s)')} value={serviceArguments.max_stream_duration_sec} tooltip='Absolute cap for SSE streams in seconds. 0 = system hard cap (24h).' />
					<SingleTextBox label={t('Backend Keepalive Interval (s)')} value={serviceArguments.backend_keepalive_interval_sec} tooltip='SO_KEEPALIVE/TCP_KEEPIDLE on the backend socket. 0 = disabled; 60 recommended in cloud.' />
				</Grid2>
			</ValueBunch>

			<ValueBunch name={t('Prefill / Decode Disaggregation')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('P/D Disaggregation Mode')} value={flag(serviceArguments.pd_disagg_mode)} tooltip='vLLM prefill/decode disaggregation.' />
					<SingleTextBox label={t('P/D Cache-Aware Mode')} value={flag(serviceArguments.pd_cache_aware_mode)} tooltip='P/D cache-aware routing (requires P/D disaggregation).' />
					<SingleTextBox label={t('P/D Session TTL (s)')} value={serviceArguments.pd_session_ttl_sec} tooltip='Session stickiness TTL for P/D cache-aware routing. 0 = no expiry.' />
					<SingleTextBox label={t('P/D Cache Threshold')} value={serviceArguments.pd_cache_threshold} tooltip='Cache match threshold (0-100). Lower = more aggressive cache routing.' />
					<SingleTextBox label={t('P/D Balance Abs Threshold')} value={serviceArguments.pd_balance_abs_threshold} tooltip='Load-imbalance threshold; if exceeded, bypass cache affinity.' />
				</Grid2>
			</ValueBunch>

			<ValueBunch name={t('KV-Cache Routing')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('KV Exact Mode')} value={kv_exact_mode_value} tooltip='KV-cache exact routing mode: 0=off, 1=zmq, 2=nats(reserved), 3=zmq single-role.' />
					<SingleTextBox label={t('KV Block Size')} value={serviceArguments.kvBlockSize} tooltip="Token block size for KV hash. Must match vLLM's block_size." />
					<SingleTextBox label={t('KV Hash Algo')} value={serviceArguments.kvHashAlgo} tooltip="KV block hash algorithm. Must match vLLM's configured algorithm." />
					<SingleTextBox label={t('KV ZMQ Port')} value={serviceArguments.kvZmqPort} tooltip='ZMQ PUB socket port on vLLM prefill endpoints for KV cache events.' />
				</Grid2>
			</ValueBunch>
		</Stack>
	);
}
