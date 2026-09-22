import {Alert, Stack, Typography} from '@mui/material';
import AccordionBox from 'components/element/AccordionBox';
import DropDownSelectBox from 'components/element/DropDownSelectBox';
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {useInstanceCapabilities} from 'hooks/query/flavorHook';
import {useCapabilityVerdict} from 'hooks/query/statusHook';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useJWTAuthProfiles, useModelProfiles} from 'hooks/query/queryHooks';
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
import {CAP_KV_EXACT_VLLM, kvExactAdmissible} from 'types/capability_status';
import {IEnumItem} from 'types/global';
import {IServiceArguments, KvExactApiMode, requiresJwtProfile} from 'types/load_balancer';

type TopologySelection = 'plain' | 'pd' | 'pd-exact' | 'single-role';

// ⚠️ The first option means two different things depending on the operation,
// and saying so is the point.
//
// On CREATE it is a real choice: the field is omitted and the service is never
// marked AI-facing, so a backend-owned X-Api-Key header passes through
// untouched.
//
// On EDIT it is NOT a way back to that state. A replace that omits the field
// PRESERVES the declared policy — deliberately, so an edit of some unrelated
// field can never silently turn enforcement off. Labelling it "Preserve /
// unmanaged" there would offer a transition the wire cannot express: the
// operator would select it, save, and the old policy would still be in force.
// So on edit it reads as what it actually does, and the caption says the only
// way to stop enforcing is to declare "disabled".
function apiKeyPolicyItems(isEdit: boolean): IEnumItem[] {
	return [
		{id: 0, name: isEdit ? 'Leave unchanged' : 'Unmanaged (no policy)', send_value: ''},
		{id: 1, name: 'Disabled (strip header)', send_value: 'disabled'},
		{id: 2, name: 'Required (enforce and strip)', send_value: 'required'},
		{id: 3, name: 'JWT bearer token', send_value: 'jwt'},
		{id: 4, name: 'API key or JWT', send_value: 'apikey-or-jwt'},
	];
}

function currentTopology(value: IServiceArguments): TopologySelection {
	if (value.pd_disagg_mode) return value.kvExactMode === 1 ? 'pd-exact' : 'pd';
	if (value.kvExactMode === 3) return 'single-role';
	return 'plain';
}

const EXACT_TOPOLOGIES: TopologySelection[] = ['pd-exact', 'single-role'];

/**
 * @param offerExact false only when the gateway has POSITIVELY reported that it
 *                   will refuse KV-exact rules (readiness `not-ready`). Unknown
 *                   readiness still offers them — see capability_status.ts.
 * @param current    the topology the form currently holds. An exact topology
 *                   that is already selected is ALWAYS offered, even when the
 *                   gateway would refuse it.
 *
 * ⚠️⚠️ WHY `current` IS NOT OPTIONAL POLITENESS. DropDownSelectBox falls back
 * to index 0 when no item matches the value, and it only calls onChange for an
 * empty value — so dropping the selected item from the list leaves the control
 * DISPLAYING "Plain routing" while the form still holds kvExactMode 3. Editing
 * an existing KV-exact rule on a gateway that lost its seed would then show the
 * operator a rule shape that is not the rule, and a save of any unrelated field
 * would look like it was preserving what is on screen. Withdrawing an option is
 * only honest when nothing is standing on it.
 */
function topologyOptions(engine: AIEngine, offerExact: boolean, current: TopologySelection): IEnumItem[] {
	const options: IEnumItem[] = [{id: 0, name: 'Plain routing', send_value: 'plain'}];
	if (engine === 'llamacpp') return options;
	if (engine !== 'trtllm') options.push({id: 1, name: 'P/D disaggregation', send_value: 'pd'});
	for (const topology of EXACT_TOPOLOGIES) {
		if (!offerExact && topology !== current) continue;
		options.push(
			topology === 'pd-exact'
				? {id: 2, name: 'P/D + KV exact', send_value: 'pd-exact'}
				: {id: 3, name: 'Single-role KV exact', send_value: 'single-role'},
		);
	}
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
	// Leading "Not set" maps to '' so the dropdown's default-announce lands on
	// "unselected" instead of injecting level 1 into every draft (F-CHWBL —
	// the fields only apply under the chwbl selector, and the serializer
	// strips the placeholder). Same pattern as the API-surface placeholder.
	const chwblLevelItems: IEnumItem[] = [
		{id: 0, name: t('Not set'), send_value: ''},
		...[1, 2, 3].map(level => ({id: level, name: String(level), send_value: level})),
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

	// ⭐ Can this GATEWAY admit a vLLM KV-exact rule at all? The precondition is
	// `LLB_KV_NONE_HASH_SEED` in the gateway's launch environment, so no request
	// body can satisfy it: on a gateway started without it, every KV-exact rule
	// is refused with 412 whatever this form sends. Asking before offering the
	// control is the difference between an honest "not available on this
	// deployment, here is why" and letting an operator fill in a form that
	// cannot succeed.
	//
	// ⚠️ Read only for vllm, because the capability is only about vllm
	// (`kv_exact_vllm` — kvExactMode 1 or 3 with kvEngineType vllm). sglang and
	// trtllm have their own admission rules (a loadable tokenizer, engine/mode
	// support) which this surface does not report, so their exact topologies
	// stay offered and the gateway stays the authority on them.
	const kvExactVerdict = useCapabilityVerdict(hasAiFields && engine === 'vllm' ? inst : null, CAP_KV_EXACT_VLLM);
	const offerExactTopologies = kvExactAdmissible(kvExactVerdict);

	// Configured JWT auth profiles, for the rule-side selector. Gated on a
	// POSITIVELY identified gateway exactly like the model-profile registry
	// above — /config/ai/jwtauthprofile is gateway-only, and a loxilb instance
	// must never see the request (request-side contract guard).
	const {data: jwtProfileData} = useJWTAuthProfiles(hasApiKeyPolicy ? inst : null);
	// Populated from the configured profiles so an unconfigured name — which
	// the gateway rejects with a 400 — cannot be expressed at all. The leading
	// blank keeps "none selected" representable, which is what the cross-field
	// warning keys on.
	const jwtProfileItems: IEnumItem[] = [
		{id: 0, name: 'Select a profile…', send_value: ''},
		...(Array.isArray(jwtProfileData) ? jwtProfileData : [])
			.map(p => p.name ?? '')
			.filter(name => name.length > 0)
			.sort((a, b) => a.localeCompare(b))
			.map((name, index) => ({id: index + 1, name, send_value: name})),
	];
	const registry = profilesQuery.data;
	const profiles = registry?.profiles ?? [];
	const modelName = value.model_name?.trim() ?? '';
	// With a model name declared, offer only the profiles that serve it
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
	// The leading placeholder maps to '' so the dropdown's default-announce
	// effect (which fires item_list[0] into onChange on an empty value) lands
	// on "still unselected" instead of silently defaulting a multi-surface
	// profile to its first surface — that silent default made the explicit
	// API-surface requirement unreachable and shipped 'completions' rules the
	// operator never chose.
	const apiModeItems: IEnumItem[] = [
		{id: 0, name: t('Select an API surface…'), send_value: ''},
		...(selectedProfile ? allowedProfileApiModes(selectedProfile) : []).map((mode, index) => ({id: index + 1, name: mode, send_value: mode})),
	];

	const handleProfileChange = useCallback((profileId: string) => {
		if (!profileId) {
			onChange({kvModelProfile: undefined, kvExactApiMode: undefined});
			return;
		}
		const profile = profiles.find(entry => entry.profileId === profileId);
		const modes = profile ? allowedProfileApiModes(profile) : [];
		// A new strict rule declares its API surface explicitly: a
		// single-surface profile is preselected, a multi-surface one demands a
		// deliberate choice — validation keeps submit blocked until it is made.
		onChange({kvModelProfile: profileId, kvExactApiMode: modes.length === 1 ? modes[0] : undefined});
	// eslint-disable-next-line react-hooks/exhaustive-deps -- profiles identity follows the query data
	}, [onChange, registry]);

	// Leaving KV-exact routing must take the profile binding with it: the
	// selector only renders under KV-exact, so a surviving kvModelProfile
	// would block submit through a control the operator can no longer see or
	// clear. On edit nothing is cleared — the binding is immutable there and
	// the gateway is the authority on an invalid transition.
	const dropProfileBinding = isEdit ? {} : {kvModelProfile: undefined, kvExactApiMode: undefined};

	const handleEngineChange = useCallback((newEngine: AIEngine) => {
		onBlockSizeConfirmed?.(false);
		onChange({
			kvEngineType: newEngine,
			kvHashAlgo: undefined,
			pdBootstrapPort: undefined,
			kvDpRankCount: undefined,
			...(newEngine === 'llamacpp' ? {pd_disagg_mode: false, kvExactMode: 0, ...dropProfileBinding} : {}),
		});
	// eslint-disable-next-line react-hooks/exhaustive-deps -- dropProfileBinding derives from isEdit, which never changes within a dialog
	}, [onChange, onBlockSizeConfirmed, isEdit]);

	const handleTopologyChange = useCallback((selection: TopologySelection) => {
		onBlockSizeConfirmed?.(false);
		switch (selection) {
			case 'plain':
				onChange({pd_disagg_mode: false, kvExactMode: 0, ...dropProfileBinding});
				break;
			case 'pd':
				onChange({pd_disagg_mode: true, kvExactMode: 0, ...dropProfileBinding});
				break;
			case 'pd-exact':
				onChange({pd_disagg_mode: true, kvExactMode: 1});
				break;
			case 'single-role':
				onChange({pd_disagg_mode: false, kvExactMode: 3});
				break;
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps -- dropProfileBinding derives from isEdit, which never changes within a dialog
	}, [onChange, onBlockSizeConfirmed, isEdit]);

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
							label={t('Data-plane Credential Policy')}
							value={value.api_key_auth ?? ''}
							onChange={newValue => {
								const mode = (newValue || undefined) as IServiceArguments['api_key_auth'];
								// The two fields travel together upstream, so they
								// change together here: leaving a stale profile on a
								// mode that cannot consult it is rejected 400
								// (ErrJwtProfileNotApplicable), and the serializer
								// drops it by omission, which is what releases the
								// profile for deletion.
								onChange(requiresJwtProfile(mode) ? {api_key_auth: mode} : {api_key_auth: mode, jwt_auth_profile: undefined});
							}}
							item_list={apiKeyPolicyItems(isEdit)}
							disabled={!isL7}
						/>
						<Typography variant="caption" color="text.secondary">
							{isEdit
								? t('Leave unchanged omits the field, which preserves the declared policy — it is not a way back to unmanaged. To stop enforcing, declare Disabled. Disabled admits keyless traffic but strips X-Api-Key. Required validates the key, strips it, and fails closed if the policy store is unavailable.')
								: t('Unmanaged omits the field and leaves backend X-Api-Key headers untouched. Disabled admits keyless traffic but strips that header. Required validates the key, strips it, and fails closed if the policy store is unavailable.')}
						</Typography>

						{requiresJwtProfile(value.api_key_auth) && (
							<Stack spacing={1}>
								<DropDownSelectBox
									label={t('JWT Auth Profile')}
									value={value.jwt_auth_profile ?? ''}
									onChange={newValue => onChange({jwt_auth_profile: newValue || undefined})}
									// A selector, never free text: the gateway rejects a
									// name that is not configured, and a dropdown makes
									// that state unreachable instead of turning it into
									// a 400 on save.
									item_list={jwtProfileItems}
									disabled={!isL7}
								/>
								{jwtProfileItems.length <= 1 ? (
									<Alert severity="warning">
										{t('No JWT auth profiles are configured on this instance. Create one under AI Gateway → JWT Auth Profiles before selecting a JWT mode.')}
									</Alert>
								) : !value.jwt_auth_profile ? (
									<Alert severity="warning">{t('A JWT mode requires a profile. The rule is rejected without one.')}</Alert>
								) : null}
								{value.api_key_auth === 'apikey-or-jwt' && (
									<Alert severity="info">
										{t('Fixed precedence, not "try both": a present X-Api-Key decides alone and its rejection is final, with no JWT fallback. Only a request without that header falls through to the bearer token, and one carrying neither is refused.')}
									</Alert>
								)}
							</Stack>
						)}
					</Stack>
				)}

				<HorizontalStack>
					<DropDownSelectBox label={t('AI Engine')} value={engine} onChange={handleEngineChange} item_list={engineItems} disabled={!isL7 || isEdit} />
					<DropDownSelectBox label={t('Topology')} value={topology} onChange={handleTopologyChange} item_list={topologyOptions(engine, offerExactTopologies, topology)} disabled={!isL7} />
				</HorizontalStack>
				{kvExactVerdict.kind === 'not-ready' && (
					// The gateway's OWN sentence, verbatim, and nothing of ours in
					// front of it: it names the variable, the byte bound and the
					// engine setting it must match, which is everything an operator
					// needs and more than we could restate without drifting from it.
					// We add only what the sentence cannot know — that this is the
					// deployment's doing rather than the form's, and whether the
					// option is still on screen because the rule already uses it.
					<Alert severity={exactRouting ? 'error' : 'info'}>
						<Typography variant="body2">
							{exactRouting
								? t('This gateway will refuse this rule: KV-exact routing is not available on this deployment, and no field on this form can change that.')
								: t('KV-exact topologies are not offered: this gateway cannot serve them until its launch environment is changed.')}
						</Typography>
						{kvExactVerdict.reason ? (
							<Typography variant="body2" sx={{mt: 1, fontFamily: 'monospace', whiteSpace: 'pre-wrap'}}>
								{kvExactVerdict.reason}
							</Typography>
						) : (
							// `reason` is optional in the contract. If the gateway
							// omitted it we say so rather than inventing a cause —
							// the operator needs to know the refusal is real and
							// that the explanation is missing, not be handed a guess.
							<Typography variant="body2" sx={{mt: 1}}>
								{t('The gateway reported no reason for this refusal. Check its launch environment and logs.')}
							</Typography>
						)}
					</Alert>
				)}
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
					<ParamBox label={t('CHWBL Prefix Hash Level')} value={value.chwbl_prefix_hash_level ?? ''} onChange={handleChange('chwbl_prefix_hash_level')} param_desc={{...params?.chwbl_prefix_hash_level, type: 'integer', enum: chwblLevelItems, description: t('Prefix hash level for the chwbl selector (SEL); leave Not set on other algorithms.')}} disabled={!isL7} />
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
							// After create the binding is immutable — read-only on a
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
