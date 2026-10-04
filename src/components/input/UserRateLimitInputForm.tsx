import {Add, DeleteOutline} from '@mui/icons-material';
import {Alert, Button, Grid2, IconButton, Stack, Typography} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import {t} from 'i18next';
import React from 'react';
import {IUserRateLimitMod, normalizeUserRateLimit, userRateLimitIsAllZero, validateUserRateLimit} from 'types/ai';

//---------------------------------------------------------
// Per-user rate limits (Stage 4.2)
//---------------------------------------------------------
// ⚠️⚠️ THIS IS NOT THE TENANT FORM WITH DIFFERENT LABELS. Two things differ,
// and both are the kind that lose data quietly.
//
// 1. MODEL ROWS ARE REPLACED AS A SET, not merged. The tenant upsert leaves a
//    missing model unchanged and needs zero-valued TOMBSTONES to remove one
//    (`reconcileTenantModelLimits` exists for exactly that). The user upsert
//    replaces: a model the body does not name is DELETED, and a body with no
//    `model_limits` clears them all. Verified against the running gateway —
//    posting two quotas then re-posting only one left only that one, and
//    re-posting with the field absent returned `model_limits: null`.
//    ⇒ Never reuse the tenant reconciliation here: it is unnecessary, and the
//    assumption behind it (missing = preserved) is the opposite of the truth.
//
// 2. ZERO MEANS INHERIT, NOT UNLIMITED. A zero field "constrains nothing and
//    falls through to the configured defaults", so an entry whose limits are
//    all zero asks for nothing and the gateway REFUSES it:
//    "a user rate-limit entry must set at least one non-zero limit (zero falls
//    through the ladder; use DELETE to remove limits)".
//    ⇒ The remedy for "remove this user's limits" is Delete, not zeros, and
//    the form says so rather than letting the operator discover it as a 400.
//
// ⭐ Because the set is replaced, this form must be opened with the PER-USER
// read, never a row from the tenant list: the list omits model limits, and
// saving from it would clear every model quota the user has.

interface ModelLimitDraft {
	model: string;
	tokens_per_min: string;
}

interface UserRateLimitDraft {
	tenant_id: string;
	user_id: string;
	rps: string;
	burst_size: string;
	tokens_per_min: string;
	model_limits: ModelLimitDraft[];
}

interface UserRateLimitInputFormProps {
	// The per-user entry being edited, or a tenant-only seed when adding.
	value?: IUserRateLimitMod;
	// Locks the identity fields when editing: tenant+user are the primary key,
	// so changing them would silently create a second entry instead of
	// renaming this one.
	identityLocked?: boolean;
	onChange: (data: IUserRateLimitMod & {isValid?: boolean; errors?: string[]}) => void;
}

function draftFromValue(value?: IUserRateLimitMod): UserRateLimitDraft {
	// ⚠️ An absent scalar shows as 0, which on this endpoint reads as "inherit
	// the default" — the same thing absence means. The gateway omits zeros from
	// its read-back, so absent and 0 are genuinely the same state here.
	return {
		tenant_id: value?.tenant_id ?? '',
		user_id: value?.user_id ?? '',
		rps: String(value?.rps ?? 0),
		burst_size: String(value?.burst_size ?? 0),
		tokens_per_min: String(value?.tokens_per_min ?? 0),
		model_limits: (value?.model_limits ?? []).map(limit => ({
			model: limit.model ?? '',
			tokens_per_min: limit.tokens_per_min === undefined ? '' : String(limit.tokens_per_min),
		})),
	};
}

export function parseUserLimitIntegerDraft(raw: string): number | undefined {
	if (!/^\d+$/.test(raw)) return undefined;
	const value = Number(raw);
	return Number.isSafeInteger(value) ? value : undefined;
}

export function userDraftToWire(draft: UserRateLimitDraft): IUserRateLimitMod {
	return normalizeUserRateLimit({
		tenant_id: draft.tenant_id,
		user_id: draft.user_id,
		rps: parseUserLimitIntegerDraft(draft.rps),
		burst_size: parseUserLimitIntegerDraft(draft.burst_size),
		tokens_per_min: parseUserLimitIntegerDraft(draft.tokens_per_min),
		// ⭐ Sent verbatim as the complete desired set — no tombstones, because
		// the endpoint replaces rather than merges.
		model_limits: draft.model_limits.map(limit => ({
			model: limit.model.trim(),
			tokens_per_min: parseUserLimitIntegerDraft(limit.tokens_per_min),
		})),
	});
}

function validateDraft(draft: UserRateLimitDraft, wire: IUserRateLimitMod): string[] {
	const errors = validateUserRateLimit(wire);
	// Raw-text checks the wire projection cannot make: a half-typed value
	// parses to undefined, which must never be read as an intentional 0.
	if (parseUserLimitIntegerDraft(draft.rps) === undefined) errors.push('User requests per second must contain digits only.');
	if (parseUserLimitIntegerDraft(draft.burst_size) === undefined) errors.push('User burst size must contain digits only.');
	if (parseUserLimitIntegerDraft(draft.tokens_per_min) === undefined) errors.push('User tokens per minute must contain digits only.');
	draft.model_limits.forEach((limit, index) => {
		if (parseUserLimitIntegerDraft(limit.tokens_per_min) === undefined) {
			errors.push(`Model quota row ${index + 1} tokens per minute must contain digits only.`);
		}
	});
	return Array.from(new Set(errors));
}

export default function UserRateLimitInputForm({onChange, value, identityLocked}: UserRateLimitInputFormProps) {
	const [draft, setDraft] = React.useState<UserRateLimitDraft>(() => draftFromValue(value));

	const wire = React.useMemo(() => userDraftToWire(draft), [draft]);
	const errors = React.useMemo(() => validateDraft(draft, wire), [draft, wire]);

	const push = (next: UserRateLimitDraft) => {
		setDraft(next);
		const nextWire = userDraftToWire(next);
		const nextErrors = validateDraft(next, nextWire);
		onChange({...nextWire, isValid: nextErrors.length === 0, errors: nextErrors});
	};

	const update = (field: keyof UserRateLimitDraft) => (newValue: string) => push({...draft, [field]: newValue});

	const updateModel = (index: number, field: keyof ModelLimitDraft) => (newValue: string) => {
		const model_limits = draft.model_limits.map((limit, i) => (i === index ? {...limit, [field]: newValue} : limit));
		push({...draft, model_limits});
	};

	const addModel = () => push({...draft, model_limits: [...draft.model_limits, {model: '', tokens_per_min: '0'}]});

	const removeModel = (index: number) => push({...draft, model_limits: draft.model_limits.filter((_, i) => i !== index)});

	const allZero = userRateLimitIsAllZero(wire);

	return (
		<NewBox item_name={t('User Rate Limit')} isEdit={identityLocked}>
			<Stack spacing={2}>
				{/* The ladder, stated once. Without it a zero looks like a way to
				    switch a limit off, which is what the gateway refuses. */}
				<Alert severity="info">
					{t('A zero does not mean unlimited here: it falls through to the configured defaults, and then to unlimited if none are set. To remove this user\'s limits entirely, delete the entry instead of zeroing it.')}
				</Alert>

				<Grid2 container spacing={2}>
					<ParamBox
						label={t('Tenant ID')}
						value={draft.tenant_id}
						onChange={update('tenant_id')}
						disabled={identityLocked}
						param_desc={{type: 'string', description: 'Tenant that owns this user. Cannot contain "|" or begin with a reserved rate-limit scope prefix.', required: true}}
					/>
					<ParamBox
						label={t('User ID')}
						value={draft.user_id}
						onChange={update('user_id')}
						disabled={identityLocked}
						param_desc={{type: 'string', description: "The verified identity's subject, as the gateway attributes it from a validated bearer token. Cannot contain \"|\" or begin with a reserved rate-limit scope prefix.", required: true}}
					/>
				</Grid2>

				<Grid2 container spacing={2}>
					<ParamBox
						label={t('Rate Limit (req/s)')}
						value={draft.rps}
						onChange={update('rps')}
						raw
						param_desc={{type: 'integer', description: 'Requests per second for this user. 0 falls through to the configured default.'}}
					/>
					<ParamBox
						label={t('Burst Size')}
						value={draft.burst_size}
						onChange={update('burst_size')}
						raw
						param_desc={{type: 'integer', description: 'Request burst size; 0 defaults to the requests-per-second value.'}}
					/>
					<ParamBox
						label={t('Tokens per Minute')}
						value={draft.tokens_per_min}
						onChange={update('tokens_per_min')}
						raw
						param_desc={{type: 'integer', description: 'LLM tokens per minute for this user. 0 falls through to the configured default.'}}
					/>
				</Grid2>

				<Stack spacing={1}>
					<Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
						<Typography variant="subtitle2">{t('Per-model token quotas')}</Typography>
						<Button size="small" startIcon={<Add />} onClick={addModel}>
							{t('Add')}
						</Button>
					</Stack>
					{/* ⚠️ Said plainly because the gateway deletes silently: the rows
					    shown here become the user's ENTIRE model quota set. */}
					<Alert severity="warning">
						{t('These rows replace the user\'s model quotas as a whole set. A model removed from this list is deleted, and saving with no rows clears them all.')}
					</Alert>
					{draft.model_limits.length === 0 && (
						<Typography variant="body2" color="text.secondary">
							{t('No per-model quota. This user\'s token limit applies across all models.')}
						</Typography>
					)}
					{draft.model_limits.map((limit, index) => (
						<Stack direction="row" spacing={1} alignItems="flex-start" key={index}>
							<ParamBox
								label={t('Model')}
								value={limit.model}
								onChange={updateModel(index, 'model')}
								param_desc={{type: 'string', description: 'Model name this quota applies to', required: true}}
							/>
							<ParamBox
								label={t('Tokens per Minute')}
								value={limit.tokens_per_min}
								onChange={updateModel(index, 'tokens_per_min')}
								raw
								param_desc={{type: 'integer', description: 'Maximum LLM tokens per minute for this user and model'}}
							/>
							<IconButton aria-label={t('Delete')} onClick={() => removeModel(index)}>
								<DeleteOutline />
							</IconButton>
						</Stack>
					))}
				</Stack>

				{/* The all-zero case gets its own wording: it is the one error an
				    operator reaches by doing something that looks reasonable. */}
				{allZero && (
					<Alert severity="warning">
						{t('Every limit is zero, so this entry would constrain nothing and the gateway refuses it. Set at least one non-zero limit, or delete the entry to fall back to the defaults.')}
					</Alert>
				)}
				{errors.length > 0 && !allZero && (
					<Alert severity="error">
						<Stack>
							{errors.map(error => (
								<Typography variant="body2" key={error}>
									{t(error)}
								</Typography>
							))}
						</Stack>
					</Alert>
				)}
			</Stack>
		</NewBox>
	);
}
