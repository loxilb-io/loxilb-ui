//---------------------------------------------------------
// JWT auth profile form (J1)
//---------------------------------------------------------
// A profile is a named issuer configuration — an IdP, its keys, and the claim
// schema to read identity out of a token.
//
// Basic carries the eight fields the gateway's own cicd scenario exercises;
// Advanced holds the nine claim-path / algorithm fields whose Keycloak-shaped
// defaults carry most deployments. The split is presentation only — an edit
// still sends the WHOLE entry, because POST is create-or-replace with no PATCH
// and a partial body reverts every field it omits.
//
// Two fields are security-relevant when left blank and are labelled as such
// rather than reading as innocuous: empty audiences SKIPS the audience check,
// and an empty default tenant DENIES tokens whose tenant claim is absent.

import {Accordion, AccordionDetails, AccordionSummary, Alert, Chip, FormControl, FormControlLabel, InputLabel, MenuItem, OutlinedInput, Select, Stack, Switch, TextField, Typography} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import NewBox from 'components/layout/NewBox';
import {evaluateNumericField} from 'components/input/numericField';
import {t} from 'i18next';
import React from 'react';
import {
	IJWTAuthProfileEntry,
	JWT_ALG_OPTIONS,
	JWT_PROFILE_DEFAULTS,
	JWTModelAuthz,
	normalizeJWTAuthProfile,
	validateJWTAuthProfile,
} from 'types/ai_jwt';

export interface IJWTProfileFormState {
	name: string;
	issuer: string;
	jwks_url: string;
	audiences: string; // comma-separated in the form
	algs: string[];
	// Numerics are held as RAW TEXT: a half-typed or invalid entry must never
	// silently become 0, which on these fields means "use the default".
	leeway_sec: string;
	refresh_sec: string;
	tenant_claim: string;
	user_claim: string;
	models_claim: string;
	roles_claim: string;
	model_role_prefix: string;
	username_claim: string;
	model_authz: JWTModelAuthz;
	default_tenant: string;
	forward_identity: boolean;
	authorization_passthrough: boolean;
}

// Blank everywhere it means "default". Never pre-fill a default as a literal
// value: doing so would pin a setting the operator never chose, and the
// placeholders already say what the gateway will apply.
export const INITIAL_JWT_FORM: IJWTProfileFormState = {
	name: '', issuer: '', jwks_url: '', audiences: '', algs: [],
	leeway_sec: '', refresh_sec: '',
	tenant_claim: '', user_claim: '', models_claim: '', roles_claim: '',
	model_role_prefix: '', username_claim: '',
	model_authz: 'claims-required',
	default_tenant: '',
	forward_identity: false,
	authorization_passthrough: false,
};

const SEC_SPEC = {required: false, min: 0};

/** Load an existing entry into form state for a replace. */
export function jwtProfileToForm(entry: IJWTAuthProfileEntry): IJWTProfileFormState {
	return {
		...INITIAL_JWT_FORM,
		name: entry.name ?? '',
		issuer: entry.issuer ?? '',
		jwks_url: entry.jwks_url ?? '',
		// An entry with an explicitly EMPTY audience list round-trips as a
		// blank field, which sends nothing and means the same thing upstream:
		// no accept-list, so the audience check is skipped.
		audiences: (entry.audiences ?? []).join(', '),
		algs: [...(entry.algs ?? [])],
		// A stored default must not render as a literal — blank shows the
		// placeholder instead, so an untouched field stays untouched.
		leeway_sec: entry.leeway_sec === undefined ? '' : String(entry.leeway_sec),
		refresh_sec: entry.refresh_sec === undefined ? '' : String(entry.refresh_sec),
		tenant_claim: entry.tenant_claim ?? '',
		user_claim: entry.user_claim ?? '',
		models_claim: entry.models_claim ?? '',
		roles_claim: entry.roles_claim ?? '',
		model_role_prefix: entry.model_role_prefix ?? '',
		username_claim: entry.username_claim ?? '',
		model_authz: entry.model_authz ?? 'claims-required',
		default_tenant: entry.default_tenant ?? '',
		forward_identity: entry.forward_identity ?? false,
		authorization_passthrough: entry.authorization_passthrough ?? false,
	};
}

export function jwtProfileFormToEntry(form: IJWTProfileFormState): IJWTAuthProfileEntry {
	const audiences = form.audiences.split(',').map(a => a.trim()).filter(a => a.length > 0);
	const leeway = evaluateNumericField(form.leeway_sec, SEC_SPEC).parsed;
	const refresh = evaluateNumericField(form.refresh_sec, SEC_SPEC).parsed;

	// normalize applies the zero-is-never-meaningful rule and the two
	// empty-is-meaningful exemptions; everything here just shapes the draft.
	return normalizeJWTAuthProfile({
		name: form.name,
		issuer: form.issuer,
		jwks_url: form.jwks_url,
		...(audiences.length > 0 && {audiences}),
		...(form.algs.length > 0 && {algs: form.algs}),
		...(leeway !== undefined && {leeway_sec: leeway}),
		...(refresh !== undefined && {refresh_sec: refresh}),
		tenant_claim: form.tenant_claim,
		user_claim: form.user_claim,
		models_claim: form.models_claim,
		roles_claim: form.roles_claim,
		model_role_prefix: form.model_role_prefix,
		username_claim: form.username_claim,
		model_authz: form.model_authz,
		...(form.default_tenant.trim().length > 0 && {default_tenant: form.default_tenant.trim()}),
		forward_identity: form.forward_identity,
		authorization_passthrough: form.authorization_passthrough,
	});
}

export function isJWTProfileFormValid(form: IJWTProfileFormState): boolean {
	if (!evaluateNumericField(form.leeway_sec, SEC_SPEC).valid) return false;
	if (!evaluateNumericField(form.refresh_sec, SEC_SPEC).valid) return false;
	return validateJWTAuthProfile(jwtProfileFormToEntry(form)).isValid;
}

interface Props {
	initial?: IJWTAuthProfileEntry;
	onChange: (data: IJWTAuthProfileEntry & {isValid?: boolean}) => void;
	onDispose?: () => void;
}

export default function JWTAuthProfileInputForm(props: Props) {
	const {initial, onChange, onDispose} = props;
	const isEdit = initial !== undefined;
	const [form, setForm] = React.useState<IJWTProfileFormState>(initial ? jwtProfileToForm(initial) : INITIAL_JWT_FORM);

	const emit = (next: IJWTProfileFormState) => {
		setForm(next);
		onChange({...jwtProfileFormToEntry(next), isValid: isJWTProfileFormValid(next)});
	};
	const set = (field: keyof IJWTProfileFormState) => (value: any) => emit({...form, [field]: value});

	React.useEffect(() => {
		onChange({...jwtProfileFormToEntry(form), isValid: isJWTProfileFormValid(form)});
		return () => onDispose?.();
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	}, []);

	const errors = validateJWTAuthProfile(jwtProfileFormToEntry(form)).errors;
	const leewayState = evaluateNumericField(form.leeway_sec, SEC_SPEC);
	const refreshState = evaluateNumericField(form.refresh_sec, SEC_SPEC);
	const touched = (v: string) => v.trim().length > 0;

	const text = (field: keyof IJWTProfileFormState, label: string, opts: {placeholder?: string; helper?: string; error?: string; required?: boolean} = {}) => (
		<TextField
			label={opts.required ? `${label} *` : label}
			value={form[field] as string}
			onChange={e => set(field)(e.target.value)}
			placeholder={opts.placeholder}
			error={opts.error !== undefined && touched(form[field] as string)}
			helperText={(opts.error !== undefined && touched(form[field] as string) ? t(opts.error) : opts.helper) ?? ''}
			size="small"
			fullWidth
		/>
	);

	return (
		<NewBox item_name={t('JWT Auth Profile')} isEdit={isEdit}>
			<Stack spacing={2}>
				{isEdit && (
					<Alert severity="info">
						{t('Saving replaces the whole profile and restarts its key lifecycle: it fails closed until the first JWKS fetch against the new configuration succeeds.')}
					</Alert>
				)}

				{text('name', t('Name'), {
					required: true,
					error: errors.name,
					helper: t('Referenced by LB rules. Maximum 63 bytes.'),
				})}
				{text('issuer', t('Issuer'), {
					required: true,
					error: errors.issuer,
					placeholder: 'https://idp.example.com/realms/main',
					helper: t('Exact match for the token iss claim. Also the OIDC discovery base when no JWKS URL is set.'),
				})}
				{text('jwks_url', t('JWKS URL'), {
					error: errors.jwks_url,
					helper: t('Overrides OIDC discovery. Leave blank to discover from the issuer.'),
				})}

				{text('audiences', t('Audiences'), {
					placeholder: 'api://gateway, account',
					helper: t('Comma-separated accept-list matched against aud and azp.'),
				})}
				{!touched(form.audiences) && (
					<Alert severity="warning">{t('No audiences listed: the audience check is skipped and any valid token from this issuer is accepted.')}</Alert>
				)}

				<Stack direction="row" spacing={2}>
					{/*
					  ⚠️ helperText must fall back to the FIELD ERROR, not stay on the
					  hint. Showing only "Blank uses the default (30)." while `error`
					  paints the control red tells the operator that something is
					  wrong but never what — observed live: a typo'd "3o" disabled
					  Save with the red text still reading as an ordinary hint. The
					  sibling ApiKeyInputForm already surfaces `.error` this way.
					*/}
					<TextField
						label={t('Clock skew (s)')}
						value={form.leeway_sec}
						onChange={e => set('leeway_sec')(e.target.value)}
						placeholder={String(JWT_PROFILE_DEFAULTS.leeway_sec)}
						error={!leewayState.valid}
						helperText={leewayState.error ?? t('Blank uses the default ({{value}}).', {value: JWT_PROFILE_DEFAULTS.leeway_sec})}
						size="small"
						fullWidth
					/>
					<TextField
						label={t('JWKS refresh (s)')}
						value={form.refresh_sec}
						onChange={e => set('refresh_sec')(e.target.value)}
						placeholder={String(JWT_PROFILE_DEFAULTS.refresh_sec)}
						error={!refreshState.valid}
						helperText={refreshState.error ?? t('Blank uses the default ({{value}}).', {value: JWT_PROFILE_DEFAULTS.refresh_sec})}
						size="small"
						fullWidth
					/>
				</Stack>

				<FormControlLabel
					control={<Switch checked={form.forward_identity} onChange={e => set('forward_identity')(e.target.checked)} />}
					label={t('Forward verified identity upstream (X-Auth-Tenant / X-Auth-User)')}
				/>
				{form.forward_identity && (
					<Typography variant="caption" color="text.secondary">
						{t('Not injected on chunked requests — a deliberate, deterministic skip.')}
					</Typography>
				)}
				<FormControlLabel
					control={<Switch checked={form.authorization_passthrough} onChange={e => set('authorization_passthrough')(e.target.checked)} />}
					label={t('Leave the client Authorization header on the upstream request')}
				/>

				<Accordion disableGutters>
					<AccordionSummary expandIcon={<ExpandMoreIcon />}>
						<Typography variant="subtitle2">{t('Advanced — claim schema and algorithms')}</Typography>
					</AccordionSummary>
					<AccordionDetails>
						<Stack spacing={2}>
							<Alert severity="warning">
								{t('Model authorization decides what an otherwise-valid token may reach. "Claims required" denies every model when no model list can be derived from the token.')}
							</Alert>
							<FormControl size="small" fullWidth>
								<InputLabel id="jwt-model-authz">{t('Model authorization')}</InputLabel>
								<Select
									labelId="jwt-model-authz"
									label={t('Model authorization')}
									value={form.model_authz}
									onChange={e => set('model_authz')(e.target.value as JWTModelAuthz)}
								>
									<MenuItem value="claims-required">{t('Claims required (deny when no model list)')}</MenuItem>
									<MenuItem value="allow-all">{t('Allow all models for a valid token')}</MenuItem>
								</Select>
							</FormControl>

							<FormControl size="small" fullWidth error={errors.algs !== undefined}>
								<InputLabel id="jwt-algs">{t('Signature algorithms')}</InputLabel>
								<Select
									labelId="jwt-algs"
									multiple
									value={form.algs}
									onChange={e => set('algs')(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
									input={<OutlinedInput label={t('Signature algorithms')} />}
									renderValue={selected => (
										<Stack direction="row" spacing={0.5} flexWrap="wrap">
											{(selected as string[]).map(v => <Chip key={v} label={v} size="small" />)}
										</Stack>
									)}
								>
									{JWT_ALG_OPTIONS.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
								</Select>
								<Typography variant="caption" color="text.secondary" sx={{mt: 0.5}}>
									{t('None selected uses the default ({{value}}). alg=none and HMAC algorithms are rejected by the gateway and cannot be configured.', {value: JWT_PROFILE_DEFAULTS.algs.join(' + ')})}
								</Typography>
							</FormControl>

							{text('default_tenant', t('Default tenant'), {
								helper: t('Used when the tenant claim is absent.'),
							})}
							{!touched(form.default_tenant) && (
								<Alert severity="info">{t('No default tenant: a token whose tenant claim is absent is denied (401), because an unattributable request cannot be metered.')}</Alert>
							)}

							{text('tenant_claim', t('Tenant claim'), {placeholder: JWT_PROFILE_DEFAULTS.tenant_claim, helper: t('Dot-path. Blank uses the default.')})}
							{text('user_claim', t('User claim'), {placeholder: JWT_PROFILE_DEFAULTS.user_claim, helper: t('Dot-path. Blank uses the default.')})}
							{text('models_claim', t('Models claim'), {helper: t('Dot-path to an allowed-models array. Authoritative when present, even when empty. Blank derives models from roles.')})}
							{text('roles_claim', t('Roles claim'), {placeholder: JWT_PROFILE_DEFAULTS.roles_claim, helper: t('Dot-path. Blank uses the default.')})}
							{text('model_role_prefix', t('Model role prefix'), {placeholder: JWT_PROFILE_DEFAULTS.model_role_prefix, helper: t('Prefix turning roles into allowed models.')})}
							{text('username_claim', t('Username claim'), {placeholder: JWT_PROFILE_DEFAULTS.username_claim, helper: t('Display only. Blank uses the default.')})}
						</Stack>
					</AccordionDetails>
				</Accordion>
			</Stack>
		</NewBox>
	);
}
