import {t} from 'i18next';

//---------------------------------------------------------
// raw-string numeric field state.
// Raw text is the single source of truth for the control; invalid input is
// never coerced to 0, never clamped, never reverted; submit gates on `valid`.
// Forms keep the raw string in their state and serialize from `parsed`.
//---------------------------------------------------------

export interface NumericFieldSpec {
	/** whether an empty field is an error (from the generated schema) */
	required: boolean;
	min?: number;
	max?: number;
}

/**
 * Why the field is unacceptable — decided without reference to any message.
 *
 * ⚠️ Acceptance used to be read back off the localized string: `valid` was
 * `error === undefined`, and `error` was a `t()` call. That makes admission a
 * function of whether a TRANSLATION RESOLVED. `t()` answers `undefined` before
 * i18next is initialized, so in that window every rejection silently inverted
 * into acceptance — `'3o'` read valid, and `-1` was handed back through
 * `parsed` for a spec that forbids it. A submit gate must not be able to open
 * because a locale bundle was missing.
 */
export type NumericFieldErrorCode = 'required' | 'not-an-integer' | 'below-min' | 'above-max';

export interface NumericFieldState {
	/** verbatim user text */
	raw: string;
	/** integer value iff raw is a complete in-range integer literal, else undefined */
	parsed: number | undefined;
	/** why it was refused, independent of localization; undefined when acceptable */
	code: NumericFieldErrorCode | undefined;
	/** localized field-level error, undefined when acceptable */
	error: string | undefined;
	valid: boolean;
}

const INT_RE = /^-?\d+$/;

/** The whole admission decision. Deliberately free of i18n. */
function classify(trimmed: string, parsed: number | undefined, spec: NumericFieldSpec): NumericFieldErrorCode | undefined {
	if (trimmed === '') return spec.required ? 'required' : undefined;
	if (parsed === undefined) return 'not-an-integer';
	if (spec.min !== undefined && parsed < spec.min) return 'below-min';
	if (spec.max !== undefined && parsed > spec.max) return 'above-max';
	return undefined;
}

function message(code: NumericFieldErrorCode, spec: NumericFieldSpec): string {
	switch (code) {
		case 'required':
			return t('Required');
		case 'not-an-integer':
			return t('Must be a whole number.');
		case 'below-min':
			return t('Must be at least {{min}}.', {min: spec.min});
		case 'above-max':
			return t('Must be at most {{max}}.', {max: spec.max});
	}
}

export function evaluateNumericField(raw: string, spec: NumericFieldSpec): NumericFieldState {
	const trimmed = raw.trim();
	const parsed = INT_RE.test(trimmed) && Number.isSafeInteger(Number(trimmed)) ? Number(trimmed) : undefined;
	const code = classify(trimmed, parsed, spec);
	return {
		raw,
		// A refused value is never handed on to a serializer, whatever the reason.
		parsed: code === undefined ? parsed : undefined,
		code,
		error: code === undefined ? undefined : message(code, spec),
		valid: code === undefined,
	};
}
