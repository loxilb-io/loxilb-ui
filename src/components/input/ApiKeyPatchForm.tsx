//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert, Divider, FormControlLabel, Grid2, Stack, Switch, Typography} from '@mui/material';
import NewBox from 'components/layout/NewBox';
import ParamBox from 'components/element/ParamBox';
import {evaluateNumericField} from 'components/input/numericField';
import {t} from 'i18next';
import React from 'react';
import {IApiKeyPatch, IApiKeySummary, apiKeyPatchIsEmpty, validateApiKeyPatch} from 'types/ai';

//---------------------------------------------------------
// Edit an existing API key (Stage 4.1)
//---------------------------------------------------------
// ⭐⭐ WHY THIS FORM IS NOT THE CREATE FORM WITH A DIFFERENT TITLE. The wire
// semantics of the two operations are opposite for the same typed value:
//
//   create   a rate field of 0 is expressed BY OMISSION (omitted = "use the
//            gateway default"), so `apiKeyFormToRequest` drops any value <= 0
//   patch    omitted = "leave the stored value UNCHANGED", and 0 = an explicit
//            limit of zero ("no per-key request limit" / "no per-key token
//            quota" / for burst, fall back to rps as the capacity)
//
// Reusing the create projection would turn "make this key unlimited" into
// "change nothing" and still report success — a silent no-op that looks
// exactly like a win. So this form owns its own projection.
//
// ⭐ PRESENCE IS COMPUTED AS A DIFF against the key as listed, which is what
// makes a binary control like `enabled` expressible at all: the field is sent
// only when the operator actually moved it. The diff is a pure function
// (`apiKeyPatchFromForm`) so the 0-versus-unchanged rule is testable without
// rendering.
//
// ⚠️ THE FORM TELLS THE OPERATOR WHICH FIELDS WILL BE SENT, deliberately. The
// gateway writes the model/enabled fields and the rate-limit fields in
// SEPARATE statements with no transaction, so a partial failure can leave some
// of them applied. An operator about to change four fields at once should be
// able to see that this is not one atomic edit.
//
// ⚠️ A BLANK NUMERIC MEANS UNCHANGED, NOT ZERO. The API has no way to express
// "remove this value" — only "set it to 0" — so blanking a field cannot be a
// request to unset it, and treating blank as 0 would silently disable a
// limiter the operator only meant to leave alone. To set zero, type 0.

export interface IApiKeyPatchFormState {
	// Raw text as typed. Parsing happens in the projection and validity in
	// `evaluateNumericField`, so a typo can never silently become 0 — which on
	// these fields is a real, meaningful value.
	rate_limit_rps: string;
	burst_size: string;
	tokens_per_min: string;
	// Comma-separated in the form, exactly as the create form does it.
	allowed_models: string;
	enabled: boolean;
}

// The gateway rejects nothing here, but `min: 0` keeps a negative off the wire
// (it would be refused after the lookup, i.e. possibly after a partial write).
const RATE_FIELD_SPEC = {required: false, min: 0};

const modelsToText = (models: readonly string[] | undefined): string => (models ?? []).join(', ');

const textToModels = (text: string): string[] =>
	text
		.split(',')
		.map(m => m.trim())
		.filter(m => m.length > 0);

export function apiKeyPatchFormInitialState(current: IApiKeySummary): IApiKeyPatchFormState {
	// ⚠️ An absent numeric is shown blank rather than as 0. The summary's own
	// contract warns that "optional zero metadata can be absent", so a missing
	// field may well BE zero — but the UI must not assert which, and blank
	// (= unchanged) is the reading that changes nothing either way.
	const numeric = (value: number | undefined): string => (value === undefined || value === null ? '' : String(value));
	return {
		rate_limit_rps: numeric(current.rate_limit_rps),
		burst_size: numeric(current.burst_size),
		tokens_per_min: numeric(current.tokens_per_min),
		allowed_models: modelsToText(current.allowed_models),
		// `enabled` is the one field the summary always serializes.
		enabled: current.enabled !== false,
	};
}

/**
 * Project the form onto a patch body: only the fields the operator actually
 * changed, with 0 carried through as a value.
 *
 * ⚠️ An unparseable numeric contributes NOTHING rather than a guess. Submit is
 * gated separately, so this only matters mid-typing.
 */
export function apiKeyPatchFromForm(form: IApiKeyPatchFormState, current: IApiKeySummary): IApiKeyPatch {
	const patch: IApiKeyPatch = {};

	const numericFields: [keyof IApiKeyPatchFormState & keyof IApiKeyPatch, number | undefined][] = [
		['rate_limit_rps', current.rate_limit_rps ?? undefined],
		['burst_size', current.burst_size ?? undefined],
		['tokens_per_min', current.tokens_per_min ?? undefined],
	];

	for (const [field, stored] of numericFields) {
		const raw = String(form[field] ?? '').trim();
		// Blank is "unchanged" — see the header note on why it cannot be 0.
		if (raw.length === 0) continue;
		const {parsed, valid} = evaluateNumericField(raw, RATE_FIELD_SPEC);
		if (!valid || parsed === undefined) continue;
		// ⭐ The comparison is what makes 0 work: typing 0 over an absent or
		// non-zero stored value is a CHANGE and is sent as 0, while 0 over a
		// stored 0 is not a change and is correctly left out.
		if (parsed !== stored) (patch[field] as number) = parsed;
	}

	if (form.enabled !== (current.enabled !== false)) patch.enabled = form.enabled;

	const models = textToModels(form.allowed_models);
	const storedModels = (current.allowed_models ?? []) as string[];
	// ⚠️ An EMPTY list is a legitimate change: it clears the restriction and
	// allows all models. It is a present field, not an omission, so it must
	// survive this comparison when the key currently has a restriction.
	if (models.join(',') !== storedModels.join(',')) patch.allowed_models = models;

	return patch;
}

/** Field labels for the "will be sent" summary, in contract order. */
function changedFieldLabels(patch: IApiKeyPatch): string[] {
	const labels: string[] = [];
	if (patch.allowed_models !== undefined) labels.push(t('Allowed models'));
	if (patch.enabled !== undefined) labels.push(t('Enabled'));
	if (patch.rate_limit_rps !== undefined) labels.push(t('Requests per second'));
	if (patch.burst_size !== undefined) labels.push(t('Burst size'));
	if (patch.tokens_per_min !== undefined) labels.push(t('Tokens per minute'));
	return labels;
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface ApiKeyPatchFormProps {
	current: IApiKeySummary;
	onChange: (data: IApiKeyPatch & {isValid?: boolean}) => void;
}

export default function ApiKeyPatchForm({current, onChange}: ApiKeyPatchFormProps) {
	const [form, setForm] = React.useState<IApiKeyPatchFormState>(() => apiKeyPatchFormInitialState(current));

	const patch = apiKeyPatchFromForm(form, current);
	const changed = changedFieldLabels(patch);

	// Every raw numeric must parse, and the projection must ask for something.
	const rawValid = ([form.rate_limit_rps, form.burst_size, form.tokens_per_min] as string[])
		.every(raw => evaluateNumericField(raw, RATE_FIELD_SPEC).valid);
	const isValid = rawValid && !apiKeyPatchIsEmpty(patch) && validateApiKeyPatch(patch).length === 0;

	const push = (next: IApiKeyPatchFormState) => {
		setForm(next);
		const nextPatch = apiKeyPatchFromForm(next, current);
		const nextRawValid = ([next.rate_limit_rps, next.burst_size, next.tokens_per_min] as string[])
			.every(raw => evaluateNumericField(raw, RATE_FIELD_SPEC).valid);
		onChange({
			...nextPatch,
			isValid: nextRawValid && !apiKeyPatchIsEmpty(nextPatch) && validateApiKeyPatch(nextPatch).length === 0,
		});
	};

	const handleText = (field: keyof IApiKeyPatchFormState) => (value: string) => push({...form, [field]: value});

	const numericHelp = (raw: string): string | undefined => {
		const state = evaluateNumericField(raw, RATE_FIELD_SPEC);
		if (!state.valid) return state.error;
		if (raw.trim().length === 0) return t('Leave blank to keep the stored value.');
		return undefined;
	};

	return (
		<NewBox item_name={t('AI API Key')} isEdit>
			<Stack spacing={2}>
				<Typography variant="body2" color="text.secondary">
					{t('Key')}: {current.key_id ?? t('Unknown')}
					{current.tenant_id ? ` · ${t('Tenant')}: ${current.tenant_id}` : ''}
				</Typography>

				{/* ⚠️ Stated up front, not after a failure: this is not one
				    atomic write, so an operator changing several fields should
				    know a partial result is possible. */}
				<Alert severity="info">
					{t('Only the fields you change are sent. The gateway applies the model and enabled fields separately from the rate limits and does not wrap them in a transaction, so a rejected value can leave an earlier change already saved.')}
				</Alert>

				<ParamBox
					label={t('Allowed Models (comma-separated)')}
					value={form.allowed_models}
					onChange={handleText('allowed_models')}
					param_desc={{type: 'string', description: 'Model identifiers this key may access. Clearing the field removes the restriction and allows all models. A name cannot contain a comma: the store joins the list with commas and would split it into two names.'}}
				/>

				<FormControlLabel
					control={<Switch checked={form.enabled} onChange={event => push({...form, enabled: event.target.checked})} />}
					label={t('Enabled')}
				/>

				<Divider />

				<Grid2 container spacing={2}>
					<ParamBox
						label={t('Rate Limit (req/s)')}
						value={form.rate_limit_rps}
						onChange={handleText('rate_limit_rps')}
						raw
						error={!evaluateNumericField(form.rate_limit_rps, RATE_FIELD_SPEC).valid}
						helperText={numericHelp(form.rate_limit_rps)}
						param_desc={{type: 'integer', description: 'Requests per second allowed on this key. 0 is an explicit "no per-key request limit", not "unset". The data plane rebuilds the bucket when the limit changes, so the next request is decided against the new value with a full bucket.'}}
					/>
					<ParamBox
						label={t('Burst Size')}
						value={form.burst_size}
						onChange={handleText('burst_size')}
						raw
						error={!evaluateNumericField(form.burst_size, RATE_FIELD_SPEC).valid}
						helperText={numericHelp(form.burst_size)}
						param_desc={{type: 'integer', description: 'Total request-bucket capacity for the per-second limit, NOT additional capacity above it. 0 makes the enforcement path fall back to the requests-per-second value, so burst equals one second of allowance.'}}
					/>
					<ParamBox
						label={t('Tokens per Minute')}
						value={form.tokens_per_min}
						onChange={handleText('tokens_per_min')}
						raw
						error={!evaluateNumericField(form.tokens_per_min, RATE_FIELD_SPEC).valid}
						helperText={numericHelp(form.tokens_per_min)}
						param_desc={{type: 'integer', description: 'LLM tokens per minute allowed on this key. 0 is an explicit "no per-key token quota". The quota is charged after a response is served, so a charge that puts the bucket in debt denies the NEXT request rather than truncating the one in flight. Lowering it does not re-price spend already charged.'}}
					/>
				</Grid2>

				{/* The honest read-back: exactly what the request will name. */}
				<Typography variant="body2" color={isValid ? 'text.secondary' : 'text.disabled'}>
					{changed.length > 0
						? t('Will be sent: {{fields}}', {fields: changed.join(', ')})
						: t('Nothing has changed yet, so there is nothing to send.')}
				</Typography>
			</Stack>
		</NewBox>
	);
}
