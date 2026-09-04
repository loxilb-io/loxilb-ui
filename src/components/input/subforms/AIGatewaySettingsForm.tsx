import {Alert, Stack, Typography} from '@mui/material';
import AccordionBox from 'components/element/AccordionBox';
import DropDownSelectBox from 'components/element/DropDownSelectBox';
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {useInstanceCapabilities} from 'hooks/query/flavorHook';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useModelProfiles} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {useCallback} from 'react';
import {
	AI_ENGINES,
	AIEngine,
	allowedAIHashes,
	allowedProfileApiModes,
	effectiveAIHash,
	profileAcceptsModel,
	resolveAIEngine,
} from 'types/ai_gateway';
import {IEnumItem} from 'types/global';
import {IServiceArguments, KvExactApiMode} from 'types/load_balancer';

type TopologySelection = 'plain' | 'pd' | 'pd-exact' | 'single-role';

const API_KEY_POLICY_ITEMS: IEnumItem[] = [
	{id: 0, name: 'Preserve / unmanaged', send_value: ''},
	{id: 1, name: 'Disabled (strip header)', send_value: 'disabled'},
	{id: 2, name: 'Required (enforce and strip)', send_value: 'required'},
];

function currentTopology(value: IServiceArguments): TopologySelection {
	if (value.pd_disagg_mode) return value.kvExactMode === 1 ? 'pd-exact' : 'pd';
	if (value.kvExactMode === 3) return 'single-role';
	return 'plain';
}

function topologyOptions(engine: AIEngine): IEnumItem[] {
	const options: IEnumItem[] = [{id: 0, name: 'Plain routing', send_value: 'plain'}];
	if (engine === 'llamacpp') return options;
	if (engine !== 'trtllm') options.push({id: 1, name: 'P/D disaggregation', send_value: 'pd'});
	options.push({id: 2, name: 'P/D + KV exact', send_value: 'pd-exact'});
	options.push({id: 3, name: 'Single-role KV exact', send_value: 'single-role'});
	return options;
}

export default function AIGatewaySettingsForm(props: {
	value: IServiceArguments;
	onChange: (delta: Partial<IServiceArguments>) => void;
	params?: any;
	isEdit?: boolean;
	blockSizeConfirmed?: boolean;
	onBlockSizeConfirmed?: (confirmed: boolean) => void;
}) {
	const {value, onChange, params, isEdit = false, blockSizeConfirmed = false, onBlockSizeConfirmed} = props;
	const caps = useInstanceCapabilities();
	// Do not expose IGW-only write controls until /version has positively
	// identified the selected instance. In particular, api_key_auth is not part
	// of the loxilb OSS LB schema and must never flash into an OSS form.
	const hasAiFields = caps.resolved && caps.flavor === 'inference-gateway' && caps.hasField('LoadbalanceEntry.serviceArguments', 'model_name');
	const hasApiKeyPolicy = caps.resolved && caps.flavor === 'inference-gateway' && caps.hasField('LoadbalanceEntry.serviceArguments', 'api_key_auth');
	const hasProfileFields = caps.resolved && caps.flavor === 'inference-gateway' && caps.hasField('LoadbalanceEntry.serviceArguments', 'kvModelProfile');
	const isL7 = value.mode === 4;
	const engine = resolveAIEngine(value.kvEngineType);
	const topology = currentTopology(value);
	const exactRouting = topology === 'pd-exact' || topology === 'single-role';
	const pdTopology = topology === 'pd' || topology === 'pd-exact';
	const effectiveHash = effectiveAIHash(engine);

	const engineItems: IEnumItem[] = caps
		.allowedEnum<AIEngine>('LoadbalanceEntry.serviceArguments.kvEngineType', [...AI_ENGINES])
		.map((item, index) => ({id: index, name: item, send_value: item}));
	const hashItems: IEnumItem[] = [
		{id: 0, name: effectiveHash ? `Engine default (${effectiveHash})` : 'Engine default (none)', send_value: ''},
		...caps
			.allowedEnum('LoadbalanceEntry.serviceArguments.kvHashAlgo', [...allowedAIHashes(engine)])
			.map((item, index) => ({id: index + 1, name: item, send_value: item})),
	];

	const handleChange = useCallback(
		(field: keyof IServiceArguments) => (newValue: any) => onChange({[field]: newValue}),
		[onChange],
	);

	// Published model profiles (read-only registry). Fetched ONLY on a
	// positively identified gateway — a loxilb instance must never see the
	// gateway-only endpoint (request-side contract guard).
	const inst = useInstanceFromURL();
	const profilesQuery = useModelProfiles(hasProfileFields ? inst : null);
	const registry = profilesQuery.data;
	const profiles = registry?.profiles ?? [];
	const modelName = value.model_name?.trim() ?? '';
	// FR-02: with a model name declared, offer only the profiles that serve it
	// (base model or allowed alias); without one, offer the whole set. The
	// profile currently selected always stays listed — dropping it from the
	// options would leave the Select with an out-of-range value (console
	// error) and hide what the field-level mismatch error is pointing at.
	const selectableProfiles = modelName
		? profiles.filter(profile => profileAcceptsModel(profile, modelName) !== null || profile.profileId === value.kvModelProfile)
		: profiles;
	const selectedProfile = profiles.find(profile => profile.profileId === value.kvModelProfile);
	const profileItems: IEnumItem[] = [
		{id: 0, name: t('None (legacy profile-less routing)'), send_value: ''},
		...selectableProfiles.map((profile, index) => {
			const aliasContext = modelName && profileAcceptsModel(profile, modelName) === 'alias' ? ` (${t('alias')}: ${modelName})` : '';
			return {
				id: index + 1,
				name: `${profile.profileId} — ${profile.baseModel} — ${(profile.supportedApis ?? []).join('/')}${aliasContext}`,
				send_value: profile.profileId,
			};
		}),
	];
	const apiModeItems: IEnumItem[] = (selectedProfile ? allowedProfileApiModes(selectedProfile) : []).map((mode, index) => ({id: index, name: mode, send_value: mode}));

	const handleProfileChange = useCallback((profileId: string) => {
		if (!profileId) {
			onChange({kvModelProfile: undefined, kvExactApiMode: undefined});
			return;
		}
		const profile = profiles.find(entry => entry.profileId === profileId);
		const modes = profile ? allowedProfileApiModes(profile) : [];
		// A new strict rule declares its API surface explicitly (FR-02): a
		// single-surface profile is preselected, a multi-surface one demands a
		// deliberate choice — validation keeps submit blocked until it is made.
		onChange({kvModelProfile: profileId, kvExactApiMode: modes.length === 1 ? modes[0] : undefined});
	// eslint-disable-next-line react-hooks/exhaustive-deps -- profiles identity follows the query data
	}, [onChange, registry]);

	const handleEngineChange = useCallback((newEngine: AIEngine) => {
		onBlockSizeConfirmed?.(false);
		onChange({
			kvEngineType: newEngine,
			kvHashAlgo: undefined,
			pdBootstrapPort: undefined,
			kvDpRankCount: undefined,
			...(newEngine === 'llamacpp' ? {pd_disagg_mode: false, kvExactMode: 0} : {}),
		});
	}, [onChange, onBlockSizeConfirmed]);

	const handleTopologyChange = useCallback((selection: TopologySelection) => {
		onBlockSizeConfirmed?.(false);
		switch (selection) {
			case 'plain':
				onChange({pd_disagg_mode: false, kvExactMode: 0});
				break;
			case 'pd':
				onChange({pd_disagg_mode: true, kvExactMode: 0});
				break;
			case 'pd-exact':
				onChange({pd_disagg_mode: true, kvExactMode: 1});
				break;
			case 'single-role':
				onChange({pd_disagg_mode: false, kvExactMode: 3});
				break;
		}
	}, [onChange, onBlockSizeConfirmed]);

	const handleBlockSize = useCallback((newValue: number | undefined) => {
		onBlockSizeConfirmed?.(false);
		onChange({kvBlockSize: newValue});
	}, [onChange, onBlockSizeConfirmed]);

	if (!hasAiFields) return null;

	return (
		<AccordionBox
			title={t('AI Gateway (Streaming / Prefill-Decode / KV Routing)')}
			tooltip={t('AI-gateway load-balancing features. Applies to the fullproxy L7 mode.')}
		>
			<Stack spacing={2}>
				{!isL7 && <Alert severity="info">{t('These options apply only to the fullproxy NAT mode.')}</Alert>}

				{hasApiKeyPolicy && (
					<Stack spacing={1}>
						<DropDownSelectBox
							label={t('Data-plane API Key Policy')}
							value={value.api_key_auth ?? ''}
							onChange={newValue => onChange({api_key_auth: newValue || undefined})}
							item_list={API_KEY_POLICY_ITEMS}
							disabled={!isL7}
						/>
						<Typography variant="caption" color="text.secondary">
							{t('Preserve/unmanaged omits the field and leaves backend X-Api-Key headers untouched. Disabled admits keyless traffic but strips that header. Required validates the key, strips it, and fails closed if the policy store is unavailable.')}
						</Typography>
					</Stack>
				)}

				<HorizontalStack>
					<DropDownSelectBox label={t('AI Engine')} value={engine} onChange={handleEngineChange} item_list={engineItems} disabled={!isL7 || isEdit} />
					<DropDownSelectBox label={t('Topology')} value={topology} onChange={handleTopologyChange} item_list={topologyOptions(engine)} disabled={!isL7} />
				</HorizontalStack>
				{isEdit && (
					<Typography variant="caption" color="warning.main">
						{t('The AI engine is immutable. Delete and recreate the rule to change it.')}
					</Typography>
				)}

				<HorizontalStack>
					<ParamBox label={t('Model Name')} value={value.model_name ?? ''} onChange={handleChange('model_name')} param_desc={{...params?.model_name, description: t('Endpoint-pool selector for AI model routing. Empty selects the wildcard pool.')}} disabled={!isL7} />
					<ParamBox label={t('Trace Type')} value={value.trace_type ?? ''} onChange={handleChange('trace_type')} param_desc={{...params?.trace_type, description: t('Tracing catalog name for deep inspection.')}} disabled={!isL7} />
				</HorizontalStack>
				<HorizontalStack>
					<ParamBox label={t('Session Header Name')} value={value.session_header_name ?? ''} onChange={handleChange('session_header_name')} param_desc={{...params?.session_header_name, description: t('Header carrying the session key for persistent routing.')}} disabled={!isL7} />
					<ParamBox label={t('CHWBL Prefix Hash Level')} value={value.chwbl_prefix_hash_level ?? ''} onChange={handleChange('chwbl_prefix_hash_level')} param_desc={{...params?.chwbl_prefix_hash_level, type: 'integer'}} disabled={!isL7} />
				</HorizontalStack>
				<HorizontalStack>
					<ParamBox label={t('CHWBL Prefix Hash Flags')} value={value.chwbl_prefix_hash_flags ?? ''} onChange={handleChange('chwbl_prefix_hash_flags')} param_desc={{...params?.chwbl_prefix_hash_flags, type: 'integer'}} disabled={!isL7} />
				</HorizontalStack>

				<HorizontalStack>
					<ParamBox label={t('SSE Mode')} value={value.sse_mode ?? false} onChange={handleChange('sse_mode')} param_desc={{...params?.sse_mode, type: 'boolean', description: t('Suppress idle timeout while an SSE stream is active.')}} disabled={!isL7} />
					<ParamBox label={t('Max Stream Duration (s)')} value={value.max_stream_duration_sec ?? ''} onChange={handleChange('max_stream_duration_sec')} param_desc={{...params?.max_stream_duration_sec, type: 'integer'}} disabled={!isL7} />
				</HorizontalStack>
				<HorizontalStack>
					<ParamBox label={t('Backend Keepalive Interval (s)')} value={value.backend_keepalive_interval_sec ?? ''} onChange={handleChange('backend_keepalive_interval_sec')} param_desc={{...params?.backend_keepalive_interval_sec, type: 'integer'}} disabled={!isL7} />
				</HorizontalStack>

				{pdTopology && (
					<>
						<HorizontalStack>
							<ParamBox label={t('P/D Cache-Aware Mode')} value={value.pd_cache_aware_mode ?? false} onChange={handleChange('pd_cache_aware_mode')} param_desc={{...params?.pd_cache_aware_mode, type: 'boolean'}} />
							<ParamBox label={t('P/D Session TTL (s)')} value={value.pd_session_ttl_sec ?? ''} onChange={handleChange('pd_session_ttl_sec')} param_desc={{...params?.pd_session_ttl_sec, type: 'integer'}} />
						</HorizontalStack>
						<HorizontalStack>
							<ParamBox label={t('P/D Cache Threshold')} value={value.pd_cache_threshold ?? ''} onChange={handleChange('pd_cache_threshold')} param_desc={{...params?.pd_cache_threshold, type: 'integer'}} />
							<ParamBox label={t('P/D Balance Abs Threshold')} value={value.pd_balance_abs_threshold ?? ''} onChange={handleChange('pd_balance_abs_threshold')} param_desc={{...params?.pd_balance_abs_threshold, type: 'integer'}} />
						</HorizontalStack>
						{engine === 'sglang' && (
							<ParamBox label={t('P/D Bootstrap Port')} value={value.pdBootstrapPort ?? 0} onChange={handleChange('pdBootstrapPort')} param_desc={{...params?.pdBootstrapPort, type: 'integer', description: t("Must match SGLang's disaggregation bootstrap port. 0 uses 8998.")}} />
						)}
					</>
				)}

				{exactRouting && (
					<>
						<Alert severity="warning">
							{engine === 'vllm' && t('Block size must match the live vLLM --block-size.')}
							{engine === 'sglang' && t('Page size is model-dependent. Read the effective value from /get_server_info before creating the rule.')}
							{engine === 'trtllm' && t('Block size must match the live TensorRT-LLM tokens_per_block value; do not assume 32.')}
						</Alert>
						<HorizontalStack>
							<ParamBox label={t('KV Block Size')} value={value.kvBlockSize ?? ''} onChange={handleBlockSize} param_desc={{...params?.kvBlockSize, type: 'integer', required: true}} />
							<ParamBox label={t('KV Hash Override')} value={value.kvHashAlgo ?? ''} onChange={handleChange('kvHashAlgo')} param_desc={{...params?.kvHashAlgo, enum: hashItems, description: t('Omission is recommended; the Gateway derives the coherent engine default.')}} />
						</HorizontalStack>
						<HorizontalStack>
							<ParamBox label={t('Block/Page Size Confirmed')} value={blockSizeConfirmed} onChange={onBlockSizeConfirmed ?? (() => {})} param_desc={{type: 'boolean', description: t('Confirm this value was obtained from the live engine configuration.')}} />
							<ParamBox label={t('KV Warmup (s)')} value={value.kvWarmupSec ?? ''} onChange={handleChange('kvWarmupSec')} param_desc={{...params?.kvWarmupSec, type: 'integer'}} />
						</HorizontalStack>
						{(engine === 'vllm' || engine === 'sglang') && (
							<ParamBox label={t('KV ZMQ Port')} value={value.kvZmqPort ?? ''} onChange={handleChange('kvZmqPort')} param_desc={{...params?.kvZmqPort, type: 'port'}} />
						)}
						{engine === 'sglang' && exactRouting && (
							<ParamBox label={t('KV DP Rank Count')} value={value.kvDpRankCount ?? 1} onChange={handleChange('kvDpRankCount')} param_desc={{...params?.kvDpRankCount, type: 'integer'}} />
						)}
						{engine === 'trtllm' && (
							<Typography variant="caption" color="text.secondary">
								{t('TensorRT-LLM events are drained over each endpoint serving port; no ZMQ or client DP-rank setting is sent.')}
							</Typography>
						)}

						{hasProfileFields && (isEdit ? (
							// FR-03: after create the binding is immutable — read-only on a
							// strict rule, and NO attach affordance on a profile-less rule
							// (the migration attach is deliberately out of MVP scope).
							value.kvModelProfile ? (
								<Stack spacing={1}>
									<HorizontalStack>
										<DropDownSelectBox label={t('Model Profile')} value={value.kvModelProfile} onChange={() => {}} item_list={[{id: 0, name: value.kvModelProfile, send_value: value.kvModelProfile}]} disabled />
										<DropDownSelectBox label={t('API Surface')} value={value.kvExactApiMode ?? ''} onChange={() => {}} item_list={[{id: 0, name: value.kvExactApiMode ?? t('Profile default'), send_value: value.kvExactApiMode ?? ''}]} disabled />
									</HorizontalStack>
									<Typography variant="caption" color="warning.main">
										{t('The model profile and API surface are immutable. Delete and recreate the rule to change them.')}
									</Typography>
								</Stack>
							) : null
						) : (
							<Stack spacing={1}>
								<HorizontalStack>
									<DropDownSelectBox
										label={t('Model Profile')}
										value={value.kvModelProfile ?? ''}
										onChange={handleProfileChange}
										item_list={profileItems}
										disabled={!isL7}
									/>
									{/* Rendered only once the selection resolves against the
									    published set: a stale profile id would hand the
									    dropdown an empty option list (its default-announce
									    effect dereferences item_list[0] — crash), and the
									    stale-selection error below is the honest surface. */}
									{value.kvModelProfile && selectedProfile && (
										<DropDownSelectBox
											label={t('API Surface')}
											value={value.kvExactApiMode ?? ''}
											onChange={(mode: KvExactApiMode) => onChange({kvExactApiMode: mode})}
											item_list={apiModeItems}
											disabled={!isL7}
										/>
									)}
								</HorizontalStack>
								<Typography variant="caption" color="text.secondary">
									{t('Binding a published profile makes this a strict rule: the gateway verifies the pinned tokenizer artifacts and attests enforcement before exact routing serves. Profile and API surface are immutable after create.')}
								</Typography>
								{registry !== undefined && modelName && selectableProfiles.length === 0 && profiles.length > 0 && (
									<Typography variant="caption" color="warning.main">
										{t('No published profile serves this model name (base model or allowed alias). Legacy profile-less routing remains available.')}
									</Typography>
								)}
								{value.kvModelProfile && !selectedProfile && registry !== undefined && (
									<Typography variant="caption" color="error">
										{t('Selected profile is not in the currently published registry. Refresh the profile list.')}
									</Typography>
								)}
							</Stack>
						))}
					</>
				)}
			</Stack>
		</AccordionBox>
	);
}
