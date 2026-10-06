// Capability readiness verdicts.
//
// Every test here is about ONE property: which inputs may withdraw a control.
// Only a gateway that positively said "not ready" may. Everything else —
// unread, unreachable, an older build, a build that does not list the
// capability, a malformed body — must read `unknown`, because a control
// withdrawn on a guess hides a working feature and there is no error for the
// operator to act on.
import {describe, expect, it} from 'vitest';
import {
	CAP_KV_EXACT_VLLM,
	CAP_LB_ALLOWED_SOURCES,
	CapabilityVerdict,
	REASON_KV_EXACT_TOKENIZER_UNLOADABLE,
	REASON_LB_SOURCE_CHECK_SLOTS_EXHAUSTED,
	capabilityBudget,
	kvExactModelNotice,
	lbSourceBudgetNotice,
	ICapabilityStatus,
	REASON_KV_EXACT_SEED_TOO_LONG,
	REASON_KV_EXACT_SEED_UNSET,
	capabilityVerdict,
	kvExactAdmissible,
	kvExactVllmVerdict,
} from './capability_status';

const SENTENCE = 'vllm kvExactMode requires non-empty Gateway LLB_KV_NONE_HASH_SEED matching engine PYTHONHASHSEED';

function entry(over: Partial<ICapabilityStatus> = {}): ICapabilityStatus {
	return {name: CAP_KV_EXACT_VLLM, ready: true, ...over} as ICapabilityStatus;
}

describe('capabilityVerdict', () => {
	it('ready when the gateway says so', () => {
		expect(kvExactVllmVerdict([entry()])).toEqual({kind: 'ready'});
	});

	it('not-ready carries the stable code AND the gateway\'s own sentence', () => {
		const verdict = kvExactVllmVerdict([
			entry({ready: false, reason_code: REASON_KV_EXACT_SEED_UNSET, reason: SENTENCE}),
		]);
		expect(verdict).toEqual({kind: 'not-ready', reasonCode: REASON_KV_EXACT_SEED_UNSET, reason: SENTENCE});
	});

	it('honours the second known code as well as the first', () => {
		const verdict = kvExactVllmVerdict([
			entry({ready: false, reason_code: REASON_KV_EXACT_SEED_TOO_LONG, reason: 'seed exceeds 23 bytes'}),
		]);
		expect(verdict.kind).toBe('not-ready');
		expect(verdict.kind === 'not-ready' && verdict.reasonCode).toBe(REASON_KV_EXACT_SEED_TOO_LONG);
	});

	// ⭐ The contract calls `name` deliberately non-enumerable so a build that
	// gains a capability stays parseable to an older client. The mirror of that
	// promise on our side: an unrecognised reason_code is still a refusal. We
	// branch on `ready`, and fall back to the prose we were given.
	it('an unrecognised reason_code is still a refusal, explained in the gateway\'s words', () => {
		const verdict = kvExactVllmVerdict([
			entry({ready: false, reason_code: 'KV_EXACT_SOMETHING_WE_HAVE_NEVER_SEEN', reason: 'a future precondition'}),
		]);
		expect(verdict).toEqual({
			kind: 'not-ready',
			reasonCode: 'KV_EXACT_SOMETHING_WE_HAVE_NEVER_SEEN',
			reason: 'a future precondition',
		});
	});

	// Both fields are optional in the schema, so a refusal with no explanation
	// is legal. It stays a refusal: dropping it because we cannot explain it
	// would offer a control the gateway just told us it will reject.
	it('not-ready survives a missing reason and reason_code', () => {
		expect(kvExactVllmVerdict([entry({ready: false})])).toEqual({kind: 'not-ready', reasonCode: '', reason: ''});
	});

	it('trims the reason so a stray newline cannot render as an empty explanation', () => {
		const verdict = kvExactVllmVerdict([entry({ready: false, reason: `  ${SENTENCE}\n`})]);
		expect(verdict.kind === 'not-ready' && verdict.reason).toBe(SENTENCE);
	});
});

describe('unknown is never not-ready', () => {
	it('404 from an older gateway (null) is unknown, not a refusal', () => {
		expect(kvExactVllmVerdict(null)).toEqual({kind: 'unknown', why: 'endpoint-absent'});
	});

	it('an unread query (undefined) is unknown, not a refusal', () => {
		expect(kvExactVllmVerdict(undefined)).toEqual({kind: 'unknown', why: 'unreadable'});
	});

	// Straight from the contract: "Absence of a capability from this list means
	// this build does not know it, which is not the same as not ready."
	it('a build that does not list the capability is unknown', () => {
		expect(kvExactVllmVerdict([])).toEqual({kind: 'unknown', why: 'not-listed'});
		expect(kvExactVllmVerdict([entry({name: 'some_other_capability'})])).toEqual({kind: 'unknown', why: 'not-listed'});
	});

	// `ready` is REQUIRED upstream, so a missing or non-boolean value is a
	// malformed body, not a verdict. Reading it as false would invent a refusal
	// the gateway never made — and a truthy-coercion bug here would silently
	// mean "any garbage disables the feature".
	it.each([
		['missing', undefined],
		['a string', 'false'],
		['the string "true"', 'true'],
		['null', null],
		['0', 0],
	])('a %s `ready` is unreadable, not false', (_label, value) => {
		const list = [{name: CAP_KV_EXACT_VLLM, ready: value} as unknown as ICapabilityStatus];
		expect(capabilityVerdict(list, CAP_KV_EXACT_VLLM)).toEqual({kind: 'unknown', why: 'unreadable'});
	});

	it('survives a null entry in the array without throwing', () => {
		const list = [null, entry({ready: false, reason: SENTENCE})] as unknown as ICapabilityStatus[];
		expect(capabilityVerdict(list, CAP_KV_EXACT_VLLM).kind).toBe('not-ready');
	});
});

describe('kvExactAdmissible', () => {
	it('offers the control for every state except a positive refusal', () => {
		expect(kvExactAdmissible({kind: 'ready'})).toBe(true);
		expect(kvExactAdmissible({kind: 'unknown', why: 'endpoint-absent'})).toBe(true);
		expect(kvExactAdmissible({kind: 'unknown', why: 'not-listed'})).toBe(true);
		expect(kvExactAdmissible({kind: 'unknown', why: 'unreadable'})).toBe(true);
		expect(kvExactAdmissible({kind: 'not-ready', reasonCode: REASON_KV_EXACT_SEED_UNSET, reason: SENTENCE})).toBe(false);
	});
});

describe('capabilityBudget (lb_allowed_sources)', () => {
	const entry = (over: Partial<ICapabilityStatus>): ICapabilityStatus[] => [{name: CAP_LB_ALLOWED_SOURCES, ready: true, ...over}];

	it('reads a budget only when both halves are present', () => {
		expect(capabilityBudget(entry({limit: 29, in_use: 20}), CAP_LB_ALLOWED_SOURCES)).toEqual({limit: 29, inUse: 20});
		expect(capabilityBudget(entry({limit: 29}), CAP_LB_ALLOWED_SOURCES)).toBeUndefined();
		expect(capabilityBudget(entry({in_use: 3}), CAP_LB_ALLOWED_SOURCES)).toBeUndefined();
	});

	it('never turns a garbled count into a budget (or into 0)', () => {
		for (const bad of [-1, 1.5, '29' as unknown as number, NaN, Infinity]) {
			expect(capabilityBudget(entry({limit: bad, in_use: 0}), CAP_LB_ALLOWED_SOURCES)).toBeUndefined();
			expect(capabilityBudget(entry({limit: 29, in_use: bad}), CAP_LB_ALLOWED_SOURCES)).toBeUndefined();
		}
	});

	it('is undefined when the entry, the list or the endpoint is absent', () => {
		expect(capabilityBudget([], CAP_LB_ALLOWED_SOURCES)).toBeUndefined();
		expect(capabilityBudget(null, CAP_LB_ALLOWED_SOURCES)).toBeUndefined();
		expect(capabilityBudget(undefined, CAP_LB_ALLOWED_SOURCES)).toBeUndefined();
	});
});

describe('lbSourceBudgetNotice (the LB create form; a warning, never a block)', () => {
	const EXHAUSTED = 'all 29 source-check slots are held; delete a rule to free one (freed slots are reused first)';
	const notReady: ICapabilityStatus[] = [{name: CAP_LB_ALLOWED_SOURCES, ready: false, reason_code: REASON_LB_SOURCE_CHECK_SLOTS_EXHAUSTED, reason: EXHAUSTED, limit: 29, in_use: 29}];

	it('ready with a budget: a caption with the free slots', () => {
		expect(lbSourceBudgetNotice([{name: CAP_LB_ALLOWED_SOURCES, ready: true, limit: 29, in_use: 20}], false)).toEqual({kind: 'caption', free: 9, limit: 29});
	});

	it('not ready with sources entered: the gateway sentence, verbatim', () => {
		expect(lbSourceBudgetNotice(notReady, true)).toEqual({kind: 'warning', reasonCode: REASON_LB_SOURCE_CHECK_SLOTS_EXHAUSTED, reason: EXHAUSTED});
	});

	it('not ready with no sources: nothing, because nothing asks for a slot', () => {
		expect(lbSourceBudgetNotice(notReady, false)).toEqual({kind: 'none'});
	});

	it('unknown (404, not listed, unreadable) or ready without a budget: nothing, as before the budget existed', () => {
		expect(lbSourceBudgetNotice(null, true)).toEqual({kind: 'none'});
		expect(lbSourceBudgetNotice([], true)).toEqual({kind: 'none'});
		expect(lbSourceBudgetNotice(undefined, true)).toEqual({kind: 'none'});
		expect(lbSourceBudgetNotice([{name: CAP_LB_ALLOWED_SOURCES, ready: true}], true)).toEqual({kind: 'none'});
	});

	it('never shows a negative number of free slots', () => {
		expect(lbSourceBudgetNotice([{name: CAP_LB_ALLOWED_SOURCES, ready: true, limit: 29, in_use: 31}], false)).toEqual({kind: 'caption', free: 0, limit: 29});
	});
});

describe('kvExactModelNotice (one model on the rule form; a warning, never a block)', () => {
	const READY: CapabilityVerdict = {kind: 'ready'};
	const NO_TOKENIZER: CapabilityVerdict = {kind: 'not-ready', reasonCode: REASON_KV_EXACT_TOKENIZER_UNLOADABLE, reason: 'no tokenizer for it'};
	const NO_SEED: CapabilityVerdict = {kind: 'not-ready', reasonCode: 'KV_EXACT_SEED_UNSET', reason: 'no seed'};

	it('reports the refusal for the name it was read for', () => {
		expect(kvExactModelNotice(READY, NO_TOKENIZER, 'org/m', 'org/m')).toEqual({reasonCode: 'KV_EXACT_TOKENIZER_UNLOADABLE', reason: 'no tokenizer for it'});
	});

	// The seed verdict is a cached read; when it is merely unknown the model
	// read is the only one that answered, and its refusal still stands.
	it.each<CapabilityVerdict['kind']>(['ready', 'unknown'])('reports it when the model-independent verdict is %s', kind => {
		const seed: CapabilityVerdict = kind === 'ready' ? READY : {kind: 'unknown', why: 'unreadable'};
		expect(kvExactModelNotice(seed, NO_TOKENIZER, 'org/m', 'org/m')).not.toBeNull();
	});

	it('says nothing about a name the form no longer holds', () => {
		expect(kvExactModelNotice(READY, NO_TOKENIZER, 'org/a', 'org/b')).toBeNull();
		// A prefix is another name, not "close enough".
		expect(kvExactModelNotice(READY, NO_TOKENIZER, 'org/mo', 'org/model')).toBeNull();
	});

	it('says nothing when no name was asked about', () => {
		expect(kvExactModelNotice(READY, NO_TOKENIZER, '', '')).toBeNull();
	});

	it('says nothing when the gateway already refuses KV-exact outright', () => {
		expect(kvExactModelNotice(NO_SEED, NO_SEED, 'org/m', 'org/m')).toBeNull();
		expect(kvExactModelNotice(NO_SEED, NO_TOKENIZER, 'org/m', 'org/m')).toBeNull();
	});

	it.each<CapabilityVerdict>([
		{kind: 'ready'},
		{kind: 'unknown', why: 'endpoint-absent'},
		{kind: 'unknown', why: 'not-listed'},
		{kind: 'unknown', why: 'unreadable'},
	])('says nothing for $kind', model => {
		expect(kvExactModelNotice(READY, model, 'org/m', 'org/m')).toBeNull();
	});

	// The seed gone since the cached model-independent read: still a refusal,
	// still the gateway's sentence.
	it('passes on a refusal whose code is not the tokenizer one', () => {
		expect(kvExactModelNotice(READY, NO_SEED, 'org/m', 'org/m')).toEqual({reasonCode: 'KV_EXACT_SEED_UNSET', reason: 'no seed'});
	});
});
