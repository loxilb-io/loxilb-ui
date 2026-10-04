import {describe, expect, it} from 'vitest';
import {isPreconditionFailure, opErrorText} from './opResultText';
import 'locales/i18n';
import {CONFLICT_KEY, NOT_ENABLED_KEY, PRECONDITION_KEY} from './opResultCodes';

// The gateway's actual sentence on a KV-exact refusal, copied from a live
// v0.9.8.9-rc.1 response. It names the setting; PRECONDITION_KEY cannot.
const GW_SENTENCE = 'vllm kvExactMode requires non-empty Gateway LLB_KV_NONE_HASH_SEED matching engine PYTHONHASHSEED';

describe('isPreconditionFailure', () => {
	it('recognizes the code regardless of which operation produced it', () => {
		expect(isPreconditionFailure({code: 'lb.create.precondition_failed'})).toBe(true);
		expect(isPreconditionFailure({code: 'profile.update.precondition_failed'})).toBe(true);
	});

	it('does not claim the neighbouring refusals, which ARE about the request', () => {
		// 501 is the closest sibling — also a deployment problem, but its mapped
		// message is already complete, so it must not pull raw prose in.
		expect(isPreconditionFailure({code: 'lb.create.not_implemented'})).toBe(false);
		expect(isPreconditionFailure({code: 'lb.create.conflict'})).toBe(false);
		expect(isPreconditionFailure({code: 'lb.create.invalid'})).toBe(false);
		expect(isPreconditionFailure({code: 'lb.create.failed'})).toBe(false);
	});

	it('matches on the code SUFFIX, not on the substring anywhere', () => {
		// Guards a `.includes()` rewrite: an operation segment that merely
		// mentions the word must not be treated as a precondition refusal.
		expect(isPreconditionFailure({code: 'lb.precondition_failed.retry'})).toBe(false);
	});
});

describe('opErrorText', () => {
	it('appends the gateway sentence for a precondition failure — the only actionable half', () => {
		const text = opErrorText({
			code: 'lb.create.precondition_failed',
			localeKey: PRECONDITION_KEY,
			rawDetail: GW_SENTENCE,
		});
		// Both halves, in order: whose problem it is, then what to change.
		expect(text).toBe(`${PRECONDITION_KEY} ${GW_SENTENCE}`);
		expect(text.indexOf(PRECONDITION_KEY)).toBeLessThan(text.indexOf('LLB_KV_NONE_HASH_SEED'));
	});

	it('keeps raw server prose OUT of every other failure', () => {
		// The general rule. A 409 whose body carries internal prose renders the
		// mapped sentence alone.
		expect(
			opErrorText({
				code: 'lb.create.conflict',
				localeKey: CONFLICT_KEY,
				rawDetail: 'pq: duplicate key value violates unique constraint "lb_rule_pkey"',
			}),
		).toBe(CONFLICT_KEY);

		expect(
			opErrorText({
				code: 'lb.create.not_implemented',
				localeKey: NOT_ENABLED_KEY,
				rawDetail: GW_SENTENCE,
			}),
		).toBe(NOT_ENABLED_KEY);
	});

	it('does not leave a dangling separator when a 412 carries no detail', () => {
		// The gateway is not obliged to send prose. A trailing space, or the
		// string "undefined", would be the visible symptom.
		for (const rawDetail of [undefined, '', '   ']) {
			const text = opErrorText({code: 'lb.create.precondition_failed', localeKey: PRECONDITION_KEY, rawDetail});
			expect(text).toBe(PRECONDITION_KEY);
			expect(text).not.toMatch(/undefined/);
			expect(text).toBe(text.trim());
		}
	});
});
