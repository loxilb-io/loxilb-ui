import {t} from 'i18next';

//---------------------------------------------------------
// UI-P6-2 — raw-string numeric field state (ES-17).
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

export interface NumericFieldState {
	/** verbatim user text */
	raw: string;
	/** integer value iff raw is a complete in-range integer literal, else undefined */
	parsed: number | undefined;
	/** localized field-level error, undefined when acceptable */
	error: string | undefined;
	valid: boolean;
}

const INT_RE = /^-?\d+$/;

export function evaluateNumericField(raw: string, spec: NumericFieldSpec): NumericFieldState {
	const trimmed = raw.trim();
	const parsed = INT_RE.test(trimmed) && Number.isSafeInteger(Number(trimmed)) ? Number(trimmed) : undefined;
	const error =
		trimmed === ''
			? spec.required
				? t('Required')
				: undefined
			: parsed === undefined
				? t('Must be a whole number.')
				: spec.min !== undefined && parsed < spec.min
					? t('Must be at least {{min}}.', {min: spec.min})
					: spec.max !== undefined && parsed > spec.max
						? t('Must be at most {{max}}.', {max: spec.max})
						: undefined;
	return {raw, parsed: error === undefined ? parsed : undefined, error, valid: error === undefined};
}
