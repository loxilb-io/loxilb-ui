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
