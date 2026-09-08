import {describe, expect, it} from 'vitest';
import {
	allowedProfileApiModes,
	classifyKvExactReadiness,
	kvExactPollIntervalMs,
	KV_STATUS_POLL_FAST_MS,
	KV_STATUS_POLL_STEADY_MS,
	profileAcceptsModel,
	serializeAIConfiguration,
	serializeStrictProfileFields,
	validateAIConfiguration,
	validateProfileSelection,
	IKvExactStatusEntry,
	IModelProfileEntry,
} from './ai_gateway';
import {IServiceArguments, IServiceConfiguration} from './load_balancer';

//---------------------------------------------------------
// Fixtures
//---------------------------------------------------------
const chatProfile: IModelProfileEntry = {
	profileId: 'qwen3-chat',
	gen: 4,
	baseModel: 'Qwen/Qwen3-32B',
	aliasPolicy: 'list',
	allowedAliases: ['qwen-chat'],
	supportedApis: ['chat'],
	tokenizerSha256: 'a'.repeat(64),
};

const bothProfile: IModelProfileEntry = {
	profileId: 'llama-both',
	gen: 4,
	baseModel: 'meta-llama/Llama-3-70B',
	aliasPolicy: 'base_model_only',
	supportedApis: ['completions', 'chat'],
	tokenizerSha256: 'b'.repeat(64),
};

function statusEntry(overrides: Partial<IKvExactStatusEntry>): IKvExactStatusEntry {
	return {
		ruleIdentity: 'rule-1',
		modelName: 'Qwen/Qwen3-32B',
		engineFamily: 'vllm',
		apiMode: 'chat',
		desiredState: 'READY',
		enforcedState: 'PENDING_DATAPLANE_CONTRACT',
		reasonCodes: [],
		...overrides,
	};
}

function strictArgs(overrides: Partial<IServiceArguments> = {}): IServiceArguments {
	return {
		name: 'e2e-strict',
		externalIP: '192.0.2.10',
		inactiveTimeOut: 30,
		port: 8000,
		protocol: 'tcp',
		mode: 4,
		model_name: 'Qwen/Qwen3-32B',
		pd_disagg_mode: true,
		kvExactMode: 1,
		kvBlockSize: 16,
		kvModelProfile: 'qwen3-chat',
		kvExactApiMode: 'chat',
		...overrides,
	} as IServiceArguments;
}

function strictConfiguration(argOverrides: Partial<IServiceArguments> = {}): IServiceConfiguration {
	return {
		serviceArguments: strictArgs(argOverrides),
		endpoints: [
			{endpointIP: '10.0.0.1', weight: 1, targetPort: 8000, state: 'active', counter: '', ep_role: 1},
			{endpointIP: '10.0.0.2', weight: 1, targetPort: 8000, state: 'active', counter: '', ep_role: 2},
		],
	} as IServiceConfiguration;
}

//---------------------------------------------------------
// profileAcceptsModel
//---------------------------------------------------------
describe('profileAcceptsModel', () => {
	it('matches the base model', () => {
		expect(profileAcceptsModel(chatProfile, 'Qwen/Qwen3-32B')).toBe('base');
	});

	it('matches an allowed alias only under the list policy', () => {
		expect(profileAcceptsModel(chatProfile, 'qwen-chat')).toBe('alias');
		// base_model_only must ignore any alias list — there is no "any" policy.
		expect(profileAcceptsModel({...bothProfile, allowedAliases: ['sneaky']}, 'sneaky')).toBeNull();
	});

	it('rejects a non-matching model and an empty model name', () => {
		expect(profileAcceptsModel(chatProfile, 'other/model')).toBeNull();
		expect(profileAcceptsModel(chatProfile, '')).toBeNull();
	});
});

//---------------------------------------------------------
// allowedProfileApiModes
//---------------------------------------------------------
describe('allowedProfileApiModes', () => {
	it('offers only the declared surface for a single-surface profile', () => {
		expect(allowedProfileApiModes(chatProfile)).toEqual(['chat']);
	});

	it('offers both plus the combined mode when both surfaces are declared', () => {
		expect(allowedProfileApiModes(bothProfile)).toEqual(['completions', 'chat', 'both']);
	});

	it('never offers "both" from an unknown future surface and does not crash on it', () => {
		const future = {...chatProfile, supportedApis: ['chat', 'speech']};
		expect(allowedProfileApiModes(future)).toEqual(['chat']);
	});
});

//---------------------------------------------------------
// validateProfileSelection
//---------------------------------------------------------
describe('validateProfileSelection', () => {
	it('passes a coherent strict selection', () => {
		expect(validateProfileSelection(strictArgs(), chatProfile)).toEqual([]);
	});

	it('is silent when no profile is selected (legacy rules stay legal)', () => {
		expect(validateProfileSelection(strictArgs({kvModelProfile: undefined, kvExactApiMode: undefined}), undefined)).toEqual([]);
	});

	it('rejects a profile on a non-exact rule', () => {
		const issues = validateProfileSelection(strictArgs({kvExactMode: 0}), chatProfile);
		expect(issues.some(issue => issue.field === 'kvModelProfile')).toBe(true);
	});

	it('flags a stale selection (profile no longer published) with a refresh hint', () => {
		const issues = validateProfileSelection(strictArgs(), undefined);
		expect(issues).toHaveLength(1);
		expect(issues[0].field).toBe('kvModelProfile');
		expect(issues[0].message).toContain('Refresh');
	});

	it('rejects a model the profile does not serve', () => {
		const issues = validateProfileSelection(strictArgs({model_name: 'other/model'}), chatProfile);
		expect(issues.some(issue => issue.field === 'kvModelProfile' && issue.message.includes('other/model'))).toBe(true);
	});

	it('rejects an API surface outside the profile declaration', () => {
		const issues = validateProfileSelection(strictArgs({kvExactApiMode: 'both'}), chatProfile);
		expect(issues.some(issue => issue.field === 'kvExactApiMode')).toBe(true);
	});
});

//---------------------------------------------------------
// validateAIConfiguration — structural profile checks
//---------------------------------------------------------
describe('validateAIConfiguration profile fields', () => {
	it('accepts a coherent strict P/D exact-mode-1 configuration', () => {
		expect(validateAIConfiguration(strictConfiguration())).toEqual([]);
	});

	it('rejects profile binding without exact routing', () => {
		const issues = validateAIConfiguration(strictConfiguration({kvExactMode: 0, pd_disagg_mode: false}));
		expect(issues.some(issue => issue.field === 'kvModelProfile')).toBe(true);
		expect(issues.some(issue => issue.field === 'kvExactApiMode')).toBe(true);
	});

	it('rejects an out-of-vocabulary API surface', () => {
		const issues = validateAIConfiguration(strictConfiguration({kvExactApiMode: 'streaming' as any}));
		expect(issues.some(issue => issue.field === 'kvExactApiMode' && issue.message.includes('completions, chat, or both'))).toBe(true);
	});

	it('treats lingering profile state as AI-active on a non-AI rule', () => {
		const issues = validateAIConfiguration(strictConfiguration({
			mode: 1, model_name: undefined, pd_disagg_mode: false, kvExactMode: 0, kvBlockSize: 16,
			kvExactApiMode: undefined,
		}));
		expect(issues.some(issue => issue.field === 'mode')).toBe(true);
	});
});

//---------------------------------------------------------
// serializeStrictProfileFields — AC-04 wire exactness
//---------------------------------------------------------
describe('serializeStrictProfileFields', () => {
	it('keeps exactly the two scalar fields on a strict rule', () => {
		const wire = serializeStrictProfileFields(strictArgs());
		expect(wire.kvModelProfile).toBe('qwen3-chat');
		expect(wire.kvExactApiMode).toBe('chat');
	});

	it('drops both fields without exact routing', () => {
		const wire = serializeStrictProfileFields(strictArgs({kvExactMode: 0}));
		expect('kvModelProfile' in wire).toBe(false);
		expect('kvExactApiMode' in wire).toBe(false);
	});

	it('never emits an API surface without a bound profile', () => {
		const wire = serializeStrictProfileFields(strictArgs({kvModelProfile: undefined}));
		expect('kvModelProfile' in wire).toBe(false);
		expect('kvExactApiMode' in wire).toBe(false);
	});

	it('treats empty strings as form artifacts, not wire values', () => {
		const wire = serializeStrictProfileFields(strictArgs({kvModelProfile: '', kvExactApiMode: '' as any}));
		expect('kvModelProfile' in wire).toBe(false);
		expect('kvExactApiMode' in wire).toBe(false);
	});
});

//---------------------------------------------------------
// serializeAIConfiguration — end-to-end funnel
//---------------------------------------------------------
describe('serializeAIConfiguration profile funnel', () => {
	it('sends both scalars for a strict P/D exact rule and no hidden defaults', () => {
		const wire = serializeAIConfiguration(strictConfiguration()).serviceArguments;
		expect(wire.kvModelProfile).toBe('qwen3-chat');
		expect(wire.kvExactApiMode).toBe('chat');
		expect(Array.isArray(wire.kvModelProfile)).toBe(false);
		expect(Array.isArray(wire.kvExactApiMode)).toBe(false);
	});

	it('drops the profile fields when topology serialization strips exact mode', () => {
		// P/D with kvExactMode !== 1 loses KV_FIELDS; the profile fields must not outlive them.
		const wire = serializeAIConfiguration(strictConfiguration({kvExactMode: 0})).serviceArguments;
		expect('kvModelProfile' in wire).toBe(false);
		expect('kvExactApiMode' in wire).toBe(false);
	});

	it('keeps the profile fields on a single-role exact-mode-3 rule', () => {
		const config = strictConfiguration({pd_disagg_mode: false, kvExactMode: 3});
		config.endpoints = config.endpoints.map(endpoint => ({...endpoint, ep_role: 0}));
		const wire = serializeAIConfiguration(config).serviceArguments;
		expect(wire.kvModelProfile).toBe('qwen3-chat');
		expect(wire.kvExactApiMode).toBe('chat');
	});

	it('strips the profile fields entirely outside full-proxy AI mode', () => {
		const wire = serializeAIConfiguration(strictConfiguration({mode: 1})).serviceArguments;
		expect('kvModelProfile' in wire).toBe(false);
		expect('kvExactApiMode' in wire).toBe(false);
	});
});

//---------------------------------------------------------
// classifyKvExactReadiness — AC-07..AC-11 display policy
//---------------------------------------------------------
describe('classifyKvExactReadiness', () => {
	it('never reports ready while pending — POST 2xx is not readiness', () => {
		for (const state of ['PROFILE_VALIDATED', 'PENDING_DATAPLANE_CONTRACT', 'TOKEN_PARITY_VERIFIED', 'TOKEN_PARITY_NOT_AVAILABLE_WITH_APPROVED_ORACLE', 'ENGINE_HASH_ATTESTED']) {
			const readiness = classifyKvExactReadiness(statusEntry({enforcedState: state}));
			expect(readiness.kind).toBe('pending');
			expect(readiness.ready).toBe(false);
		}
	});

	it('reports ready only for READY with an explicitly lifted fence', () => {
		const lifted = classifyKvExactReadiness(statusEntry({
			enforcedState: 'READY',
			enforcement: {desired: 'READY', enforced: 'READY', goFenced: false},
		}));
		expect(lifted.kind).toBe('ready');
		expect(lifted.ready).toBe(true);
		expect(lifted.warning).toBe(false);
	});

	it('refuses ready for READY behind a fence or an unreported fence', () => {
		const fenced = classifyKvExactReadiness(statusEntry({
			enforcedState: 'READY',
			enforcement: {desired: 'READY', enforced: 'READY', goFenced: true},
		}));
		expect(fenced.ready).toBe(false);
		expect(fenced.fenced).toBe(true);

		// goFenced=false must stay distinguishable from goFenced omitted.
		const unreported = classifyKvExactReadiness(statusEntry({enforcedState: 'READY'}));
		expect(unreported.ready).toBe(false);
		expect(unreported.fenced).toBeUndefined();
	});

	it('marks READY_FUNCTIONAL_ONLY as a distinct warning state, never plain ready', () => {
		const functional = classifyKvExactReadiness(statusEntry({
			enforcedState: 'READY_FUNCTIONAL_ONLY',
			enforcement: {desired: 'READY', enforced: 'READY_FUNCTIONAL_ONLY', goFenced: false},
		}));
		expect(functional.kind).toBe('ready-functional-only');
		expect(functional.ready).toBe(true);
		expect(functional.warning).toBe(true);
	});

	it('classifies legacy, degradation, fault, and migration states', () => {
		expect(classifyKvExactReadiness(statusEntry({enforcedState: 'LEGACY_ACTIVE_UNATTESTED'})).kind).toBe('legacy');
		expect(classifyKvExactReadiness(statusEntry({enforcedState: 'DEGRADING'})).kind).toBe('degrading');
		expect(classifyKvExactReadiness(statusEntry({enforcedState: 'DEGRADED'})).kind).toBe('degraded');
		expect(classifyKvExactReadiness(statusEntry({enforcedState: 'ENFORCEMENT_FAULT'})).kind).toBe('fault');
		expect(classifyKvExactReadiness(statusEntry({enforcedState: 'REQUIRES_MIGRATION'})).kind).toBe('requires-migration');
	});

	it('treats unknown future vocabulary as raw and non-ready without throwing (AC-10)', () => {
		const readiness = classifyKvExactReadiness(statusEntry({
			enforcedState: 'QUANTUM_ATTESTED_V9',
			enforcement: {desired: 'READY', enforced: 'QUANTUM_ATTESTED_V9', goFenced: false},
		}));
		expect(readiness.kind).toBe('unknown');
		expect(readiness.ready).toBe(false);
		expect(readiness.rawState).toBe('QUANTUM_ATTESTED_V9');
	});
});

//---------------------------------------------------------
// kvExactPollIntervalMs — polling cadence policy
//---------------------------------------------------------
describe('kvExactPollIntervalMs', () => {
	it('polls fast before the first data arrives', () => {
		expect(kvExactPollIntervalMs(undefined)).toBe(KV_STATUS_POLL_FAST_MS);
	});

	it('settles to steady cadence for "no status for this selection" (404 → null)', () => {
		expect(kvExactPollIntervalMs(null)).toBe(KV_STATUS_POLL_STEADY_MS);
		expect(kvExactPollIntervalMs([])).toBe(KV_STATUS_POLL_STEADY_MS);
	});

	it('polls fast through pending, degrading, and unknown states', () => {
		expect(kvExactPollIntervalMs([statusEntry({enforcedState: 'PENDING_DATAPLANE_CONTRACT'})])).toBe(KV_STATUS_POLL_FAST_MS);
		expect(kvExactPollIntervalMs([statusEntry({enforcedState: 'DEGRADING'})])).toBe(KV_STATUS_POLL_FAST_MS);
		expect(kvExactPollIntervalMs([statusEntry({enforcedState: 'SOMETHING_NEW'})])).toBe(KV_STATUS_POLL_FAST_MS);
	});

	it('keeps a non-zero steady cadence after READY, DEGRADED, and FAULT — drift must still surface', () => {
		for (const state of ['READY', 'READY_FUNCTIONAL_ONLY', 'DEGRADED', 'ENFORCEMENT_FAULT', 'LEGACY_ACTIVE_UNATTESTED', 'REQUIRES_MIGRATION']) {
			const interval = kvExactPollIntervalMs([statusEntry({enforcedState: state})]);
			expect(interval).toBe(KV_STATUS_POLL_STEADY_MS);
			expect(interval).toBeGreaterThan(0);
		}
	});

	it('lets one transitional entry keep the whole key fast', () => {
		expect(kvExactPollIntervalMs([
			statusEntry({enforcedState: 'READY'}),
			statusEntry({ruleIdentity: 'rule-2', enforcedState: 'DEGRADING'}),
		])).toBe(KV_STATUS_POLL_FAST_MS);
	});
});
