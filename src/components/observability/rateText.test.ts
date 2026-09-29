import type {TFunction} from 'i18next';
import {describe, expect, it} from 'vitest';
import {parseExposition} from 'observability/parser';
import {IMetricsSnapshot} from 'types/observability';
import {countOrAbsence, formatRate, formatRatio} from './rateText';

// Identity translator: assertions read the English catalogue key.
const t = ((key: string) => key) as unknown as TFunction;

describe('formatRate — absent families', () => {
	// ⭐ The defect: every one of these used to print "Warming up…", a transient
	// state, for a family that stays absent for the life of the process. Each
	// reading now says only what the manifest lets it say.
	it('a precondition family says nothing was reported — not "not configured", which it cannot know', () => {
		expect(formatRate({kind: 'absent', reading: {kind: 'conditional', precondition: 'x'}}, t)).toBe('None reported');
	});

	it('a lazy unconditional family has had no events since the process started', () => {
		expect(formatRate({kind: 'absent', reading: {kind: 'until-used'}}, t)).toBe('None since start');
	});

	it('an eager family that is missing is a fault, not a quiet zero', () => {
		expect(formatRate({kind: 'absent', reading: {kind: 'unexpected'}}, t)).toBe('Missing');
	});

	it('a gated family is not available on this build', () => {
		expect(formatRate({kind: 'absent', reading: {kind: 'gated'}}, t)).toBe('Not available');
	});

	it.each([{kind: 'indeterminate'}, {kind: 'not-in-manifest'}] as const)('an unexplained absence ($kind) is N/A', reading => {
		expect(formatRate({kind: 'absent', reading}, t)).toBe('N/A');
	});

	it('never renders an absent family as a number', () => {
		for (const reading of [{kind: 'until-used'}, {kind: 'unexpected'}, {kind: 'gated'}] as const) {
			expect(formatRate({kind: 'absent', reading}, t, ' B/s')).not.toMatch(/\d/);
		}
	});

	it('still warms up while a present series waits for its second observation', () => {
		expect(formatRate({kind: 'insufficient-samples'}, t)).toBe('Warming up…');
	});
});

describe('formatRatio — a ratio over an absent family', () => {
	it('carries the same words as the rate it could not be derived from', () => {
		expect(formatRatio({kind: 'not-derivable', reason: 'absent', reading: {kind: 'until-used'}}, t)).toBe('None since start');
	});
});

describe('countOrAbsence — a count over a family that may be absent', () => {
	const snap = (text: string, extra: Partial<IMetricsSnapshot> = {}): IMetricsSnapshot => {
		const parsed = parseExposition(text);
		return {instanceId: 1, flavor: 'inference-gateway', receivedAtMs: 1, available: true, families: parsed.families, diagnostics: parsed.diagnostics, ...extra};
	};
	const positive = (s: {value: number}) => s.value > 0;

	// ⭐ The defect: `selectSamples(...).filter(...).length` over an absent
	// family is 0, printed as "0 enforcement faults" about a family the
	// gateway never exported (it needs a strict KV-exact rule to exist).
	it('an absent family says why, never 0', () => {
		expect(countOrAbsence(snap('other 1'), 'loxilb_ai_kv_enforcement_fault', positive, t)).toBe('None reported');
	});

	it('a present family is counted, including a true 0', () => {
		const text = ['loxilb_ai_kv_enforcement_fault{rule="a"} 1', 'loxilb_ai_kv_enforcement_fault{rule="b"} 0'].join('\n');
		expect(countOrAbsence(snap(text), 'loxilb_ai_kv_enforcement_fault', positive, t)).toBe(1);
		expect(countOrAbsence(snap('loxilb_ai_kv_enforcement_fault{rule="a"} 0'), 'loxilb_ai_kv_enforcement_fault', positive, t)).toBe(0);
	});

	it('no snapshot, or a failed one, is no data rather than a count', () => {
		expect(countOrAbsence(undefined, 'loxilb_ai_kv_enforcement_fault', positive, t)).toBe('No data');
		const failed = snap('', {available: false, failure: {status: 'unavailable', code: 'x', localeKey: 'x', retryable: true}});
		expect(countOrAbsence(failed, 'loxilb_ai_kv_enforcement_fault', positive, t)).toBe('No data');
	});
});
