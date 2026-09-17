//---------------------------------------------------------
// Raw-string numeric field admission.
//---------------------------------------------------------
// ⚠️ This file deliberately does NOT import 'locales/i18n'. That absence is
// the test: `t()` answers `undefined` until i18next is initialized, and the
// original implementation derived `valid` from `error === undefined` — so an
// unresolved translation turned every rejection into an acceptance. A form
// gating submit on `.valid` would have opened on invalid input.
//
// Bootstrapping i18n here would hide exactly the coupling being pinned, so
// the assertions below check the DECISION (`code`, `valid`, `parsed`), never
// the message text.

import {describe, expect, it} from 'vitest';
import {t} from 'i18next';
import {evaluateNumericField} from './numericField';

const OPTIONAL = {required: false, min: 0};

describe('evaluateNumericField — admission is independent of localization', () => {
	// The precondition the rest of this file rests on. If i18next ever gains a
	// global default init, this assertion fails and tells the next reader that
	// these tests no longer reproduce the original condition.
	it('runs in the uninitialized-i18n window it is meant to cover', () => {
		expect(t('Must be a whole number.')).toBeUndefined();
	});

	it('refuses a half-typed number even when no message resolves', () => {
		const state = evaluateNumericField('3o', OPTIONAL);
		expect(state.valid).toBe(false);
		expect(state.code).toBe('not-an-integer');
		// The message is absent here — and that must not soften the verdict.
		expect(state.error).toBeUndefined();
	});

	it('refuses a below-minimum value and withholds it from the serializer', () => {
		const state = evaluateNumericField('-1', OPTIONAL);
		expect(state.valid).toBe(false);
		expect(state.code).toBe('below-min');
		// ⚠️ The sharper half of the old bug: `parsed` was gated on the same
		// unresolved message, so -1 was handed to callers that serialize from
		// `parsed` — a forbidden value reaching the wire, not merely a missing
		// warning.
		expect(state.parsed).toBeUndefined();
	});

	it('refuses an above-maximum value', () => {
		const state = evaluateNumericField('70000', {required: false, min: 1, max: 65535});
		expect(state.valid).toBe(false);
		expect(state.code).toBe('above-max');
		expect(state.parsed).toBeUndefined();
	});

	it('refuses a blank required field and accepts a blank optional one', () => {
		expect(evaluateNumericField('', {required: true}).code).toBe('required');
		expect(evaluateNumericField('', {required: false}).valid).toBe(true);
		// Blank optional means "not chosen", so there is nothing to serialize.
		expect(evaluateNumericField('', {required: false}).parsed).toBeUndefined();
	});

	it('accepts an in-range integer and passes it through', () => {
		const state = evaluateNumericField(' 30 ', OPTIONAL);
		expect(state.valid).toBe(true);
		expect(state.code).toBeUndefined();
		expect(state.parsed).toBe(30);
		// Raw text stays verbatim: the control is never reverted or reformatted
		// under the operator's cursor.
		expect(state.raw).toBe(' 30 ');
	});

	it('rejects anything that is not a complete integer literal', () => {
		for (const raw of ['1.5', '1e3', '0x10', '--1', '1 2', '+', '-']) {
			expect(evaluateNumericField(raw, {required: false}).valid, `${raw} must be refused`).toBe(false);
		}
	});

	it('refuses an integer too large to represent exactly', () => {
		// Number('9007199254740993') silently rounds; accepting it would send a
		// value the operator never typed.
		expect(evaluateNumericField('9007199254740993', {required: false}).code).toBe('not-an-integer');
	});
});
