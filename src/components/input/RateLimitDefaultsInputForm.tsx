import {Alert, Grid2, MenuItem, Stack, TextField, Typography} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import {t} from 'i18next';
import React from 'react';
import {
	IRateLimitDefaultsMod,
	RATE_LIMIT_DEFAULTS_LIMIT_FIELDS,
	RATE_LIMIT_DEFAULTS_SCOPES,
	RateLimitDefaultsScope,
	normalizeRateLimitDefaults,
	rateLimitDefaultsIsAllZero,
	validateRateLimitDefaults,
} from 'types/ai';

//---------------------------------------------------------
// Rate-limit defaults (Stage 4.2b)
//---------------------------------------------------------
// The bottom of the QoS ladder: what applies to an identity with no entry of
// its own. Three things about this endpoint are not guessable from the others
// on this page, and each one loses configuration silently.
//
// 1. ⚠️⚠️ THE POST REPLACES THE WHOLE ROW. It does not merge. Verified against
//    the running gateway: posting `{scope:'global', default_user_tpm:5000}`
//    over a row holding `default_user_rps:7` left `{default_user_tpm:5000}`
//    alone — the request limit was gone, and the 204 said nothing. ⇒ This form
//    always emits all six fields, seeded from the row it opened on, so an
//    operator editing one number cannot delete the other five. That is also
//    why every field is rendered even when zero: a field the form did not show
//    is a field the operator did not know they were about to clear.
//
// 2. ⚠️ ZERO IS INHERITANCE, NOT "UNLIMITED" — it falls through to the next
//    ladder level. An all-zero row therefore asks for nothing and is REFUSED:
//    "a defaults entry must set at least one non-zero limit (zero falls
//    through; use DELETE to remove the row)". The remedy is Delete.
//
// 3. ⚠️ `rule_ident` PRESENCE IS VALIDATED IN BOTH DIRECTIONS, and the read
//    path does not warn you: GET ignores a stray ident on scope `global`, but
//    POST refuses one (400, `fields:["rule_ident"]`). So the control is
//    disabled — not merely ignored — when the scope is global.
//
// ⭐⭐ THE TWO `vip_shared_*` FIELDS ARE ASYMMETRIC AND DELIBERATELY DO NOT
// SHARE ONE WORD OF COPY. `vip_shared_rps` bounds KEYLESS traffic only, while
// `vip_shared_tpm` is charged by every token-metered response on the service,
// credentialed and keyless alike. Describing the pair once as "the keyless
// bucket" — which is how the metric manifest words it — understates the token
// side, whose spend includes traffic the operator believes is governed by
// per-key quotas.

interface RateLimitDefaultsDraft {
	scope: RateLimitDefaultsScope;
	rule_ident: string;
	default_user_rps: string;
	default_user_tpm: string;
	default_tenant_rps: string;
	default_tenant_tpm: string;
	vip_shared_rps: string;
	vip_shared_tpm: string;
}

interface RateLimitDefaultsInputFormProps {
	// The row being edited, or undefined when adding.
	value?: IRateLimitDefaultsMod;
	// Locks scope + service when editing: together they are the primary key,
	// so changing them would write a different row and leave this one standing.
	identityLocked?: boolean;
	onChange: (data: IRateLimitDefaultsMod & {isValid?: boolean; errors?: string[]}) => void;
}

export function parseDefaultsIntegerDraft(raw: string): number | undefined {
	if (!/^\d+$/.test(raw)) return undefined;
	const value = Number(raw);
	return Number.isSafeInteger(value) ? value : undefined;
}

function draftFromValue(value?: IRateLimitDefaultsMod): RateLimitDefaultsDraft {
	// ⚠️ An absent field shows as 0 because that is exactly what it means here:
	// the gateway omits zeros from its read-back, so "absent" and "0" are the
	// same stored state, both meaning "falls through".
	return {
		scope: value?.scope ?? 'global',
		rule_ident: value?.rule_ident ?? '',
		default_user_rps: String(value?.default_user_rps ?? 0),
		default_user_tpm: String(value?.default_user_tpm ?? 0),
		default_tenant_rps: String(value?.default_tenant_rps ?? 0),
		default_tenant_tpm: String(value?.default_tenant_tpm ?? 0),
		vip_shared_rps: String(value?.vip_shared_rps ?? 0),
		vip_shared_tpm: String(value?.vip_shared_tpm ?? 0),
	};
}

export function defaultsDraftToWire(draft: RateLimitDefaultsDraft): IRateLimitDefaultsMod {
	return normalizeRateLimitDefaults({
		scope: draft.scope,
		rule_ident: draft.rule_ident,
		// ⭐ ALL SIX, ALWAYS. The endpoint replaces the row, so an omitted field
		// is a cleared field — see the header.
		default_user_rps: parseDefaultsIntegerDraft(draft.default_user_rps),
		default_user_tpm: parseDefaultsIntegerDraft(draft.default_user_tpm),
		default_tenant_rps: parseDefaultsIntegerDraft(draft.default_tenant_rps),
		default_tenant_tpm: parseDefaultsIntegerDraft(draft.default_tenant_tpm),
		vip_shared_rps: parseDefaultsIntegerDraft(draft.vip_shared_rps),
		vip_shared_tpm: parseDefaultsIntegerDraft(draft.vip_shared_tpm),
	});
}

function validateDraft(draft: RateLimitDefaultsDraft, wire: IRateLimitDefaultsMod): string[] {
	const errors = validateRateLimitDefaults(wire);
	// Raw-text checks the wire projection cannot make: a half-typed value
	// parses to undefined, which must never be read as an intentional 0 — on a
	// replacing endpoint that would clear the field rather than leave it.
	for (const field of RATE_LIMIT_DEFAULTS_LIMIT_FIELDS) {
		if (parseDefaultsIntegerDraft(draft[field]) === undefined) {
			errors.push(`${field} must contain digits only.`);
		}
	}
	return Array.from(new Set(errors));
}

export default function RateLimitDefaultsInputForm({onChange, value, identityLocked}: RateLimitDefaultsInputFormProps) {
	const [draft, setDraft] = React.useState<RateLimitDefaultsDraft>(() => draftFromValue(value));

	const wire = React.useMemo(() => defaultsDraftToWire(draft), [draft]);
	const errors = React.useMemo(() => validateDraft(draft, wire), [draft, wire]);

	const push = (next: RateLimitDefaultsDraft) => {
		setDraft(next);
		const nextWire = defaultsDraftToWire(next);
		const nextErrors = validateDraft(next, nextWire);
		onChange({...nextWire, isValid: nextErrors.length === 0, errors: nextErrors});
	};

	const update = (field: keyof RateLimitDefaultsDraft) => (newValue: string) => push({...draft, [field]: newValue});

	const allZero = rateLimitDefaultsIsAllZero(wire);
	const isRule = draft.scope === 'rule';

	return (
		<NewBox item_name={t('Rate Limit Defaults')} isEdit={identityLocked}>
			<Stack spacing={2}>
				{/* Stated before the fields, because it changes what the operator
				    is looking at: these boxes are not a patch, they are the row. */}
				<Alert severity="warning">
					{t('These six values replace the whole row. A limit left at zero is not left alone — it is cleared, and the identities it governed fall through to the next level.')}
				</Alert>

				<Grid2 container spacing={2}>
					<TextField
						select
						size="small"
						label={t('Scope')}
						value={draft.scope}
						onChange={e => push({...draft, scope: e.target.value as RateLimitDefaultsScope})}
						disabled={identityLocked}
						sx={{minWidth: 200}}
						slotProps={{htmlInput: {'aria-label': t('Scope')}}}
					>
						{RATE_LIMIT_DEFAULTS_SCOPES.map(scope => (
							<MenuItem value={scope} key={scope}>
								{scope === 'global' ? t('Global (everywhere)') : t('Rule (one service)')}
							</MenuItem>
						))}
					</TextField>
					<ParamBox
						label={t('Service')}
						value={draft.rule_ident}
						onChange={update('rule_ident')}
						// ⚠️ Disabled rather than merely ignored on the global scope:
						// the gateway REFUSES a global row that names a service, so a
						// value typed here would fail the save rather than be dropped.
						disabled={identityLocked || !isRule}
						param_desc={{
							type: 'string',
							description: 'Service this defaults row applies to. Required for the rule scope and not permitted for the global one. Cannot contain "|" or begin with a reserved rate-limit scope prefix.',
							required: isRule,
						}}
					/>
				</Grid2>

				<Alert severity="info">
					{isRule
						? t('A rule row overrides the global row field by field for this service, and only where its value is positive. A zero here does not switch a global default off — it leaves the global value in force.')
						: t('The global row applies wherever no rule row overrides it. A zero falls through to unlimited unless something above it in the ladder applies.')}
				</Alert>

				<Stack spacing={1}>
					<Typography variant="subtitle2">{t('Per-identity defaults')}</Typography>
					<Grid2 container spacing={2}>
						<ParamBox
							label={t('User Requests per Second')}
							value={draft.default_user_rps}
							onChange={update('default_user_rps')}
							raw
							param_desc={{type: 'integer', description: 'Requests per second for users without an explicit entry of their own.'}}
						/>
						<ParamBox
							label={t('User Tokens per Minute')}
							value={draft.default_user_tpm}
							onChange={update('default_user_tpm')}
							raw
							param_desc={{type: 'integer', description: 'LLM tokens per minute for users without an explicit entry of their own.'}}
						/>
					</Grid2>
					<Grid2 container spacing={2}>
						<ParamBox
							label={t('Tenant Requests per Second')}
							value={draft.default_tenant_rps}
							onChange={update('default_tenant_rps')}
							raw
							param_desc={{type: 'integer', description: 'Requests per second for tenants without an explicit entry of their own.'}}
						/>
						<ParamBox
							label={t('Tenant Tokens per Minute')}
							value={draft.default_tenant_tpm}
							onChange={update('default_tenant_tpm')}
							raw
							param_desc={{type: 'integer', description: 'LLM tokens per minute for tenants without an explicit entry of their own.'}}
						/>
					</Grid2>
				</Stack>

				<Stack spacing={1}>
					<Typography variant="subtitle2">{t('Shared service bucket')}</Typography>
					{/* ⭐⭐ The asymmetry, said outright. The two halves of this pair
					    bound DIFFERENT traffic, and the manifest's shared "keyless"
					    wording is wrong about the token side. */}
					<Alert severity="info">
						{t('The two halves of this bucket do not bound the same traffic. The request limit applies to keyless traffic only; the token limit is charged by every token-metered response on the service, credentialed requests included.')}
					</Alert>
					<Grid2 container spacing={2}>
						<ParamBox
							label={t('Shared Requests per Second (keyless)')}
							value={draft.vip_shared_rps}
							onChange={update('vip_shared_rps')}
							raw
							param_desc={{type: 'integer', description: 'Requests per second shared by ALL keyless traffic on the service.'}}
						/>
						<ParamBox
							label={t('Shared Tokens per Minute (all traffic)')}
							value={draft.vip_shared_tpm}
							onChange={update('vip_shared_tpm')}
							raw
							param_desc={{
								type: 'integer',
								description: "LLM tokens per minute for the service's shared bucket, charged by every token-metered response on the service — credentialed and keyless alike, measured at response settle. Keyless requests carry no pre-admission reservation, so the bucket's debt denies the NEXT keyless admission once spend crosses the bound.",
							}}
						/>
					</Grid2>
				</Stack>

				{/* The all-zero case gets its own wording: it is the one error an
				    operator reaches by doing something that looks reasonable. */}
				{allZero && (
					<Alert severity="warning">
						{t('Every limit is zero, so this row would constrain nothing and the gateway refuses it. Set at least one non-zero limit, or delete the row to fall through to the next level.')}
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
