import {describe, expect, it} from 'vitest';
import {IApiKeySummary} from 'types/ai';
import {apiKeyPatchFormInitialState, apiKeyPatchFromForm} from './ApiKeyPatchForm';
import {apiKeyPatchApplied} from 'hooks/query/confirmPredicates';

//---------------------------------------------------------
// The patch projection (Stage 4.1)
//---------------------------------------------------------
// The one rule worth more than the rest: on PATCH, 0 is a VALUE and omission
// means "unchanged" — the exact opposite of the create form, which expresses 0
// by omitting the field. Every test below exists to keep those apart.

const key = (over: Partial<IApiKeySummary> = {}): IApiKeySummary => ({
	key_id: 'key-1',
	tenant_id: 'tenant-a',
	name: 'k',
	enabled: true,
	...over,
});

describe('api key patch projection', () => {
	it('asks for nothing when the operator changed nothing', () => {
		const current = key({rate_limit_rps: 10, burst_size: 20, tokens_per_min: 1000, allowed_models: ['org/a']});
		const form = apiKeyPatchFormInitialState(current);

		// An untouched edit dialog must not send a body — the gateway would
		// refuse it 400 BEFORE looking the key up, a status that does not even
		// prove the key exists.
		expect(apiKeyPatchFromForm(form, current)).toEqual({});
	});

	//---------------------------------------------------------
	// ⭐⭐ Zero
	//---------------------------------------------------------

	it('sends 0 when the operator lifts a limit — the edit most likely to be made', () => {
		const current = key({rate_limit_rps: 10});
		const form = {...apiKeyPatchFormInitialState(current), rate_limit_rps: '0'};

		// Not `{}`. Dropping this would report success while leaving the limit
		// at 10 — the silent no-op that looks like a win.
		expect(apiKeyPatchFromForm(form, current)).toEqual({rate_limit_rps: 0});
	});

	it('sends 0 for burst and tokens too', () => {
		const current = key({burst_size: 5, tokens_per_min: 900});
		const form = {...apiKeyPatchFormInitialState(current), burst_size: '0', tokens_per_min: '0'};
		expect(apiKeyPatchFromForm(form, current)).toEqual({burst_size: 0, tokens_per_min: 0});
	});

	it('does NOT send 0 over a stored 0 — that is genuinely no change', () => {
		const current = key({rate_limit_rps: 0});
		const form = apiKeyPatchFormInitialState(current);
		expect(form.rate_limit_rps).toBe('0');
		expect(apiKeyPatchFromForm(form, current)).toEqual({});
	});

	it('sends 0 when the stored value is ABSENT, because absent is not a promise of 0', () => {
		// `ApiKeySummary` says optional zero metadata can be absent, so the UI
		// cannot know an absent field is 0 — if the operator asks for 0, ask.
		const current = key({});
		const form = {...apiKeyPatchFormInitialState(current), tokens_per_min: '0'};
		expect(apiKeyPatchFromForm(form, current)).toEqual({tokens_per_min: 0});
	});

	//---------------------------------------------------------
	// Blank
	//---------------------------------------------------------

	it('treats a cleared field as UNCHANGED, never as 0', () => {
		const current = key({rate_limit_rps: 10});
		const form = {...apiKeyPatchFormInitialState(current), rate_limit_rps: ''};

		// The API cannot express "unset" — only "set to 0" — so blanking must
		// not silently disable a limiter the operator meant to leave alone.
		expect(apiKeyPatchFromForm(form, current)).toEqual({});
	});

	it('contributes nothing for a half-typed value rather than guessing', () => {
		const current = key({rate_limit_rps: 10});
		expect(apiKeyPatchFromForm({...apiKeyPatchFormInitialState(current), rate_limit_rps: '3o'}, current)).toEqual({});
		expect(apiKeyPatchFromForm({...apiKeyPatchFormInitialState(current), rate_limit_rps: '-'}, current)).toEqual({});
	});

	it('drops a negative rather than sending a value the store would refuse after a partial write', () => {
		const current = key({rate_limit_rps: 10});
		expect(apiKeyPatchFromForm({...apiKeyPatchFormInitialState(current), rate_limit_rps: '-5'}, current)).toEqual({});
	});

	//---------------------------------------------------------
	// enabled and allowed_models
	//---------------------------------------------------------

	it('sends enabled only when it actually moved', () => {
		const current = key({enabled: true});
		const form = apiKeyPatchFormInitialState(current);
		expect(apiKeyPatchFromForm(form, current)).toEqual({});
		expect(apiKeyPatchFromForm({...form, enabled: false}, current)).toEqual({enabled: false});
	});

	it('sends an EMPTY model list when the operator clears a restriction', () => {
		const current = key({allowed_models: ['org/a', 'org/b']});
		const form = {...apiKeyPatchFormInitialState(current), allowed_models: ''};

		// An empty array is a present field that clears the restriction, not an
		// omission — it must reach the gateway.
		expect(apiKeyPatchFromForm(form, current)).toEqual({allowed_models: []});
	});

	it('does not send a model list that only changed whitespace', () => {
		const current = key({allowed_models: ['org/a', 'org/b']});
		const form = {...apiKeyPatchFormInitialState(current), allowed_models: 'org/a ,   org/b'};
		expect(apiKeyPatchFromForm(form, current)).toEqual({});
	});

	it('sends several fields at once, which is exactly the non-atomic case', () => {
		const current = key({rate_limit_rps: 10, allowed_models: ['org/a'], enabled: true});
		const form = {...apiKeyPatchFormInitialState(current), rate_limit_rps: '0', enabled: false, allowed_models: ''};
		expect(apiKeyPatchFromForm(form, current)).toEqual({rate_limit_rps: 0, enabled: false, allowed_models: []});
	});
});

//---------------------------------------------------------
// The confirm predicate
//---------------------------------------------------------

describe('api key patch confirmation', () => {
	it('confirms a 0 that reads back as an ABSENT field', () => {
		// ⚠️ The "too tight" trap in its sharpest form: the operator lifts a
		// limit to 0 and the gateway omits the zero from the summary. Comparing
		// strictly would tell them a completed change had not landed.
		const applied = apiKeyPatchApplied('key-1', {rate_limit_rps: 0});
		expect(applied([{key_id: 'key-1'}])).toBe(true);
		expect(applied([{key_id: 'key-1', rate_limit_rps: 0}])).toBe(true);
	});

	it('does not confirm while the old value is still served', () => {
		const applied = apiKeyPatchApplied('key-1', {rate_limit_rps: 0});
		expect(applied([{key_id: 'key-1', rate_limit_rps: 10}])).toBe(false);
	});

	it('confirms an empty model list that reads back as null', () => {
		const applied = apiKeyPatchApplied('key-1', {allowed_models: []});
		expect(applied([{key_id: 'key-1', allowed_models: null}])).toBe(true);
	});

	it('compares only the fields the patch named', () => {
		// The rate limit was deliberately left unchanged, so whatever it reads
		// is not evidence about this write.
		const applied = apiKeyPatchApplied('key-1', {enabled: false});
		expect(applied([{key_id: 'key-1', enabled: false, rate_limit_rps: 999}])).toBe(true);
	});

	it('never confirms from a sibling key', () => {
		const applied = apiKeyPatchApplied('key-1', {enabled: false});
		expect(applied([{key_id: 'key-2', enabled: false}])).toBe(false);
	});

	it('does not confirm a missing key', () => {
		expect(apiKeyPatchApplied('key-1', {enabled: false})([])).toBe(false);
	});
});
