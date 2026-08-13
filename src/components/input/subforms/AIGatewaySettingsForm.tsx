import {Stack, Typography} from '@mui/material';
import kv_hash_algos from 'assets/json/kv_hash_algos.json';
import AccordionBox from 'components/element/AccordionBox';
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {useInstanceCapabilities} from 'hooks/query/flavorHook';
import {t} from 'i18next';
import {useCallback} from 'react';
import {IEnumItem} from 'types/global';
import {IServiceArguments} from 'types/load_balancer';

//---------------------------------------------------------
// AI Gateway settings — model routing, SSE streaming, prefill/decode
// disaggregation and KV-cache routing (LoadbalanceEntry AI fields).
// Relevant to the fullproxy (mode=4) L7 path.
//---------------------------------------------------------
export default function AIGatewaySettingsForm(props: {value: IServiceArguments; onChange: any; params?: any}) {
	const {value, onChange, params} = props;

	// Flavor gating: every field in this accordion is gateway-only — upstream
	// loxilb silently drops them all, so the whole group disappears there
	// (hiding it also removes the endpoint P/D fields it transitively gates).
	const caps = useInstanceCapabilities();
	const hasAiFields = caps.hasField('LoadbalanceEntry.serviceArguments', 'model_name');

	const kv_hash_algo_list: IEnumItem[] = kv_hash_algos;
	const isL7 = value?.mode === 4;
	const disabled = !isL7;

	// Delta update — see LBInputForm.handleServiceArguments for why a full
	// {...value, field} spread here corrupts sibling sub-forms' fields.
	const handleChange = useCallback(
		(field: keyof IServiceArguments) => (newValue: any) => {
			onChange({[field]: newValue});
		},
		[onChange],
	);

	if (!hasAiFields) return null;

	return (
		<AccordionBox
			title={t('AI Gateway (Streaming / Prefill-Decode / KV Routing)')}
			tooltip={'AI-gateway load-balancing features. Applies to the fullproxy L7 mode.'}
		>
			<Stack spacing={2}>
				{disabled && (
					<Typography variant="caption" color="text.secondary">
						{t('These options apply only to the fullproxy NAT mode.')}
					</Typography>
				)}

				{/* Model routing + tracing */}
				<HorizontalStack>
					<ParamBox label={t('Model Name')} value={value?.model_name ?? ''} onChange={handleChange('model_name')} param_desc={{...params?.model_name, description: t('Endpoint-pool selector for AI model routing (e.g. "llama-70b"). Empty = wildcard pool.')}} disabled={disabled} />
					<ParamBox label={t('Trace Type')} value={value?.trace_type ?? ''} onChange={handleChange('trace_type')} param_desc={{...params?.trace_type, description: t('Tracing catalog name for deep inspection (e.g. v1, anthropic, default).')}} disabled={disabled} />
				</HorizontalStack>

				{/* Persistence / CHWBL */}
				<HorizontalStack>
					<ParamBox label={t('Session Header Name')} value={value?.session_header_name ?? ''} onChange={handleChange('session_header_name')} param_desc={{...params?.session_header_name, description: t('Header carrying the session key (used with sel=persist).')}} disabled={disabled} />
					<ParamBox label={t('CHWBL Prefix Hash Level')} value={value?.chwbl_prefix_hash_level ?? ''} onChange={handleChange('chwbl_prefix_hash_level')} param_desc={{...params?.chwbl_prefix_hash_level, type: 'integer', description: t('CHWBL prefix hash level (sel=8).')}} disabled={disabled} />
				</HorizontalStack>
				<HorizontalStack>
					<ParamBox label={t('CHWBL Prefix Hash Flags')} value={value?.chwbl_prefix_hash_flags ?? ''} onChange={handleChange('chwbl_prefix_hash_flags')} param_desc={{...params?.chwbl_prefix_hash_flags, type: 'integer', description: t('CHWBL prefix hash flags.')}} disabled={disabled} />
				</HorizontalStack>

				{/* SSE streaming */}
				<HorizontalStack>
					<ParamBox label={t('SSE Mode')} value={value?.sse_mode ?? false} onChange={handleChange('sse_mode')} param_desc={{...params?.sse_mode, type: 'boolean', description: t('Enable SSE streaming; suppresses idle-timeout during active streams.')}} disabled={disabled} />
					<ParamBox label={t('Max Stream Duration (s)')} value={value?.max_stream_duration_sec ?? ''} onChange={handleChange('max_stream_duration_sec')} param_desc={{...params?.max_stream_duration_sec, type: 'integer', description: t('Absolute cap for SSE streams in seconds. 0 = system hard cap (24h).')}} disabled={disabled} />
				</HorizontalStack>
				<HorizontalStack>
					<ParamBox label={t('Backend Keepalive Interval (s)')} value={value?.backend_keepalive_interval_sec ?? ''} onChange={handleChange('backend_keepalive_interval_sec')} param_desc={{...params?.backend_keepalive_interval_sec, type: 'integer', description: t('SO_KEEPALIVE/TCP_KEEPIDLE on the backend socket. 0 = disabled; 60 recommended in cloud.')}} disabled={disabled} />
				</HorizontalStack>

				{/* Prefill / Decode disaggregation */}
				<HorizontalStack>
					<ParamBox label={t('P/D Disaggregation Mode')} value={value?.pd_disagg_mode ?? false} onChange={handleChange('pd_disagg_mode')} param_desc={{...params?.pd_disagg_mode, type: 'boolean', description: t('Enable vLLM prefill/decode disaggregation.')}} disabled={disabled} />
					<ParamBox label={t('P/D Cache-Aware Mode')} value={value?.pd_cache_aware_mode ?? false} onChange={handleChange('pd_cache_aware_mode')} param_desc={{...params?.pd_cache_aware_mode, type: 'boolean', description: t('P/D cache-aware routing (requires P/D disaggregation).')}} disabled={disabled} />
				</HorizontalStack>
				<HorizontalStack>
					<ParamBox label={t('P/D Session TTL (s)')} value={value?.pd_session_ttl_sec ?? ''} onChange={handleChange('pd_session_ttl_sec')} param_desc={{...params?.pd_session_ttl_sec, type: 'integer', description: t('Session stickiness TTL for P/D cache-aware routing. 0 = no expiry.')}} disabled={disabled} />
					<ParamBox label={t('P/D Cache Threshold')} value={value?.pd_cache_threshold ?? ''} onChange={handleChange('pd_cache_threshold')} param_desc={{...params?.pd_cache_threshold, type: 'integer', description: t('Cache match threshold (0-100). Lower = more aggressive cache routing.')}} disabled={disabled} />
				</HorizontalStack>
				<HorizontalStack>
					<ParamBox label={t('P/D Balance Abs Threshold')} value={value?.pd_balance_abs_threshold ?? ''} onChange={handleChange('pd_balance_abs_threshold')} param_desc={{...params?.pd_balance_abs_threshold, type: 'integer', description: t('Load-imbalance threshold; if exceeded, bypass cache affinity.')}} disabled={disabled} />
				</HorizontalStack>

				{/* KV-cache routing */}
				<HorizontalStack>
					<ParamBox label={t('KV Exact Mode')} value={value?.kvExactMode ?? ''} onChange={handleChange('kvExactMode')} param_desc={{...params?.kvExactMode, type: 'integer', description: t('KV-cache exact routing mode: 0=off, 1=zmq, 2=nats(reserved), 3=zmq single-role.')}} disabled={disabled} />
					<ParamBox label={t('KV Block Size')} value={value?.kvBlockSize ?? ''} onChange={handleChange('kvBlockSize')} param_desc={{...params?.kvBlockSize, type: 'integer', description: t("Token block size for KV hash. Must match vLLM's block_size.")}} disabled={disabled} />
				</HorizontalStack>
				<HorizontalStack>
					<ParamBox label={t('KV Hash Algo')} value={value?.kvHashAlgo ?? ''} onChange={handleChange('kvHashAlgo')} param_desc={{...params?.kvHashAlgo, enum: kv_hash_algo_list, description: t("KV block hash algorithm. Must match vLLM's configured algorithm.")}} disabled={disabled} />
					<ParamBox label={t('KV ZMQ Port')} value={value?.kvZmqPort ?? ''} onChange={handleChange('kvZmqPort')} param_desc={{...params?.kvZmqPort, type: 'integer', description: t('ZMQ PUB socket port on vLLM prefill endpoints for KV cache events.')}} disabled={disabled} />
				</HorizontalStack>
			</Stack>
		</AccordionBox>
	);
}
