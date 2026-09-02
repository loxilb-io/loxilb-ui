//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Visibility, VisibilityOff} from '@mui/icons-material';
import {Divider, FormControlLabel, FormLabel, Grid2, IconButton, InputAdornment, Radio, RadioGroup, Stack, Switch, TextField} from '@mui/material';
import {LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {DateTimePicker} from '@mui/x-date-pickers/DateTimePicker';
import NewBox from 'components/layout/NewBox';
import ParamBox from 'components/element/ParamBox';
import {evaluateNumericField} from 'components/input/numericField';
import dayjs from 'dayjs';
import {t} from 'i18next';
import {IApiKeyCreateRequest} from 'types/ai';
import React from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface ApiKeyInputFormProps {
	onChange: (data: IApiKeyCreateRequest & {isValid?: boolean}) => void;
	onDispose?: () => void;
}

export interface IApiKeyFormState {
	mode: 'generate' | 'import';
	api_key: string;
	tenant_id: string;
	name: string;
	allowed_models: string; // comma-separated in the form
	// Raw text as typed: parsing happens in
	// apiKeyFormToRequest and validity in validateForm — a typo must never
	// silently become 0, which on these fields means UNLIMITED.
	rate_limit_rps: string;
	burst_size: string;
	tokens_per_min: string;
	expires_at: string;
	enabled: boolean;
}

// 0 = unlimited/default, enforced BY OMISSION in the request (key spread only
// when > 0) — the wire shape for valid inputs must stay byte-identical.
const RATE_FIELD_SPEC = {required: false, min: 0};

const INITIAL_FORM: IApiKeyFormState = {
	mode: 'generate',
	api_key: '',
	tenant_id: '',
	name: '',
	allowed_models: '',
	rate_limit_rps: '0',
	burst_size: '0',
	tokens_per_min: '0',
	expires_at: '',
	enabled: true,
};

export function importedApiKeyError(value: string): string | undefined {
	if (value.length < 16 || value.length > 512) return 'Imported key must contain 16 to 512 characters.';
	if (/[^\x21-\x7e]/.test(value)) {
		return 'Imported key must use printable non-space US-ASCII characters only.';
	}
	return undefined;
}

// Validates the optional RFC3339 expiry, e.g. 2027-01-01T00:00:00Z. Returns
// the error message for an invalid value, or undefined when acceptable (empty
// = never expires). A blank string is fine; anything present must parse AND be
// in the future — an already-expired key is a footgun, not a valid request.
function expiryError(value: string): string | undefined {
	const trimmed = value.trim();
	if (trimmed.length === 0) return undefined;
	const ms = Date.parse(trimmed);
	if (isNaN(ms)) return t('Invalid timestamp (use RFC3339, e.g. 2027-01-01T00:00:00Z)');
	if (ms <= Date.now()) return t('Expiry must be in the future');
	return undefined;
}

export function apiKeyFormToRequest(form: IApiKeyFormState): IApiKeyCreateRequest {
	const models = form.allowed_models
		.split(',')
		.map(m => m.trim())
		.filter(m => m.length > 0);

	// Only emit expires_at once it parses — Date.toISOString() throws a
	// RangeError on a half-typed / invalid timestamp, and this runs on every
	// keystroke, so an unguarded conversion crashes the onChange handler.
	const expiryTrim = form.expires_at.trim();
	const expiryValid = expiryTrim.length > 0 && !isNaN(Date.parse(expiryTrim));

	// Raw → integer; an invalid raw never reaches the wire (validateForm blocks
	// submit), and 0/blank keeps today's sentinel-by-omission shape exactly.
	const rps = evaluateNumericField(form.rate_limit_rps, RATE_FIELD_SPEC).parsed;
	const burst = evaluateNumericField(form.burst_size, RATE_FIELD_SPEC).parsed;
	const tpm = evaluateNumericField(form.tokens_per_min, RATE_FIELD_SPEC).parsed;

	// Omit unset optionals so the gateway applies its own defaults
	return {
		tenant_id: form.tenant_id.trim(),
		...(form.mode === 'import' && importedApiKeyError(form.api_key) === undefined && {api_key: form.api_key}),
		...(form.name.trim().length > 0 && {name: form.name.trim()}),
		...(models.length > 0 && {allowed_models: models}),
		...(rps !== undefined && rps > 0 && {rate_limit_rps: rps}),
		...(burst !== undefined && burst > 0 && {burst_size: burst}),
		...(tpm !== undefined && tpm > 0 && {tokens_per_min: tpm}),
		...(expiryValid && {expires_at: new Date(expiryTrim).toISOString()}),
		enabled: form.enabled,
	};
}

export default function ApiKeyInputForm(props: ApiKeyInputFormProps) {
	const {onChange, onDispose} = props;

	const [form, setForm] = React.useState<IApiKeyFormState>(INITIAL_FORM);
	const [showImportedKey, setShowImportedKey] = React.useState(false);
	// The picker owns a dayjs value (kept even while a typed entry is momentarily
	// invalid, so the field text persists); form.expires_at mirrors it as the
	// string the request + validation work on.
	const [expiresAt, setExpiresAt] = React.useState<dayjs.Dayjs | null>(null);

	const handleExpiryChange = (value: dayjs.Dayjs | null) => {
		setExpiresAt(value);
		// null = cleared; a valid instant → ISO; an in-progress invalid entry →
		// a sentinel that expiryError rejects (never call toISOString on it).
		handleChange('expires_at')(value == null ? '' : value.isValid() ? value.toISOString() : 'invalid');
	};

	const validateForm = (data: IApiKeyFormState): boolean => {
		if (data.tenant_id.trim().length === 0) return false;
		if (data.mode === 'import' && importedApiKeyError(data.api_key) !== undefined) return false;
		if (!evaluateNumericField(data.rate_limit_rps, RATE_FIELD_SPEC).valid) return false;
		if (!evaluateNumericField(data.burst_size, RATE_FIELD_SPEC).valid) return false;
		if (!evaluateNumericField(data.tokens_per_min, RATE_FIELD_SPEC).valid) return false;
		if (expiryError(data.expires_at) !== undefined) return false;
		return true;
	};

	const handleChange = (field: keyof IApiKeyFormState) => (value: any) => {
		const newForm = {...form, [field]: value};
		setForm(newForm);
		onChange({...apiKeyFormToRequest(newForm), isValid: validateForm(newForm)});
	};

	React.useEffect(() => {
		onChange({...apiKeyFormToRequest(form), isValid: validateForm(form)});
		return () => onDispose?.();
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	}, []);

	return (
		<NewBox item_name={t('AI API Key')}>
			<Stack spacing={3}>
				<Stack spacing={1}>
					<FormLabel>{t('Key provisioning mode')}</FormLabel>
					<RadioGroup
						row
						value={form.mode}
						onChange={event => {
							const mode = event.target.value as IApiKeyFormState['mode'];
							const newForm = {...form, mode, api_key: ''};
							setForm(newForm);
							setShowImportedKey(false);
							onChange({...apiKeyFormToRequest(newForm), isValid: validateForm(newForm)});
						}}
					>
						<FormControlLabel value="generate" control={<Radio />} label={t('Generate on Gateway')} />
						<FormControlLabel value="import" control={<Radio />} label={t('Import existing key')} />
					</RadioGroup>
					{form.mode === 'import' && (
						<TextField
							label={t('Existing API key')}
							type={showImportedKey ? 'text' : 'password'}
							value={form.api_key}
							onChange={event => handleChange('api_key')(event.target.value)}
							error={form.api_key.length > 0 && importedApiKeyError(form.api_key) !== undefined}
							helperText={form.api_key.length > 0
								? importedApiKeyError(form.api_key)
								: t('16–512 printable non-space US-ASCII characters. This secret stays only in this form and the create request.')}
							inputProps={{minLength: 16, maxLength: 512, autoComplete: 'new-password'}}
							InputProps={{
								endAdornment: (
									<InputAdornment position="end">
										<IconButton
											aria-label={showImportedKey ? t('Hide imported key') : t('Show imported key')}
											onClick={() => setShowImportedKey(previous => !previous)}
											edge="end"
										>
											{showImportedKey ? <VisibilityOff /> : <Visibility />}
										</IconButton>
									</InputAdornment>
								),
							}}
						/>
					)}
				</Stack>

				<Grid2 container spacing={2}>
					<ParamBox
						label={t('Tenant ID')}
						value={form.tenant_id}
						onChange={handleChange('tenant_id')}
						param_desc={{type: 'string', description: 'Tenant identifier that owns this key', required: true}}
					/>
					<ParamBox
						label={t('Name')}
						value={form.name}
						onChange={handleChange('name')}
						param_desc={{type: 'string', description: 'Human-readable label for the API key'}}
					/>
				</Grid2>

				<ParamBox
					label={t('Allowed Models (comma-separated)')}
					value={form.allowed_models}
					onChange={handleChange('allowed_models')}
					param_desc={{type: 'string', description: 'Model identifiers this key may access (empty = all models)'}}
				/>

				<Divider />

				<Grid2 container spacing={2}>
					<ParamBox
						label={t('Rate Limit (req/s)')}
						value={form.rate_limit_rps}
						onChange={handleChange('rate_limit_rps')}
						raw
						error={!evaluateNumericField(form.rate_limit_rps, RATE_FIELD_SPEC).valid}
						helperText={evaluateNumericField(form.rate_limit_rps, RATE_FIELD_SPEC).error}
						param_desc={{type: 'integer', description: 'Maximum requests per second (0 = unlimited)'}}
					/>
					<ParamBox
						label={t('Burst Size')}
						value={form.burst_size}
						onChange={handleChange('burst_size')}
						raw
						error={!evaluateNumericField(form.burst_size, RATE_FIELD_SPEC).valid}
						helperText={evaluateNumericField(form.burst_size, RATE_FIELD_SPEC).error}
						param_desc={{type: 'integer', description: 'Burst capacity above the steady-state RPS limit (0 = default)'}}
					/>
					<ParamBox
						label={t('Tokens / Minute')}
						value={form.tokens_per_min}
						onChange={handleChange('tokens_per_min')}
						raw
						error={!evaluateNumericField(form.tokens_per_min, RATE_FIELD_SPEC).valid}
						helperText={evaluateNumericField(form.tokens_per_min, RATE_FIELD_SPEC).error}
						param_desc={{type: 'integer', description: 'Maximum LLM tokens per minute (0 = unlimited)'}}
					/>
				</Grid2>

				<Divider />

				<Grid2 container spacing={2} alignItems="center">
					<LocalizationProvider dateAdapter={AdapterDayjs}>
						<DateTimePicker
							label={t('Expires At')}
							value={expiresAt}
							onChange={handleExpiryChange}
							disablePast
							slotProps={{
								textField: {
									error: expiryError(form.expires_at) !== undefined,
									helperText: expiryError(form.expires_at) ?? t('Leave empty to never expire'),
								},
								actionBar: {actions: ['clear', 'accept']},
							}}
						/>
					</LocalizationProvider>
					<FormControlLabel
						control={<Switch checked={form.enabled} onChange={e => handleChange('enabled')(e.target.checked)} />}
						label={t('Enabled')}
					/>
				</Grid2>
			</Stack>
		</NewBox>
	);
}
