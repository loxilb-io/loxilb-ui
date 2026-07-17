//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Grid2, Stack, Switch, FormControlLabel, Divider} from '@mui/material';
import NewBox from 'components/layout/NewBox';
import ParamBox from 'components/element/ParamBox';
import {t} from 'i18next';
import {IApiKeyCreateRequest} from 'types/ai';
import React from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface ApiKeyInputFormProps {
	onChange: (data: IApiKeyCreateRequest & {isValid?: boolean}) => void;
}

interface IApiKeyFormState {
	tenant_id: string;
	name: string;
	allowed_models: string; // comma-separated in the form
	rate_limit_rps: number;
	burst_size: number;
	tokens_per_min: number;
	expires_at: string;
	enabled: boolean;
}

const INITIAL_FORM: IApiKeyFormState = {
	tenant_id: '',
	name: '',
	allowed_models: '',
	rate_limit_rps: 0,
	burst_size: 0,
	tokens_per_min: 0,
	expires_at: '',
	enabled: true,
};

// RFC3339, e.g. 2027-01-01T00:00:00Z
function isValidExpiry(value: string): boolean {
	if (value.length === 0) return true;
	return !isNaN(Date.parse(value));
}

function toRequest(form: IApiKeyFormState): IApiKeyCreateRequest {
	const models = form.allowed_models
		.split(',')
		.map(m => m.trim())
		.filter(m => m.length > 0);

	// Omit unset optionals so the gateway applies its own defaults
	return {
		tenant_id: form.tenant_id.trim(),
		...(form.name.trim().length > 0 && {name: form.name.trim()}),
		...(models.length > 0 && {allowed_models: models}),
		...(form.rate_limit_rps > 0 && {rate_limit_rps: form.rate_limit_rps}),
		...(form.burst_size > 0 && {burst_size: form.burst_size}),
		...(form.tokens_per_min > 0 && {tokens_per_min: form.tokens_per_min}),
		...(form.expires_at.trim().length > 0 && {expires_at: new Date(form.expires_at).toISOString()}),
		enabled: form.enabled,
	};
}

export default function ApiKeyInputForm(props: ApiKeyInputFormProps) {
	const {onChange} = props;

	const [form, setForm] = React.useState<IApiKeyFormState>(INITIAL_FORM);

	const validateForm = (data: IApiKeyFormState): boolean => {
		if (data.tenant_id.trim().length === 0) return false;
		if (data.rate_limit_rps < 0 || data.burst_size < 0 || data.tokens_per_min < 0) return false;
		if (!isValidExpiry(data.expires_at.trim())) return false;
		return true;
	};

	const handleChange = (field: keyof IApiKeyFormState) => (value: any) => {
		const newForm = {...form, [field]: value};
		setForm(newForm);
		onChange({...toRequest(newForm), isValid: validateForm(newForm)});
	};

	React.useEffect(() => {
		onChange({...toRequest(form), isValid: validateForm(form)});
	}, []);

	return (
		<NewBox item_name={t('AI API Key')}>
			<Stack spacing={3}>
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
						value={form.rate_limit_rps.toString()}
						onChange={(value: string) => handleChange('rate_limit_rps')(parseInt(value) || 0)}
						param_desc={{type: 'integer', description: 'Maximum requests per second (0 = unlimited)'}}
					/>
					<ParamBox
						label={t('Burst Size')}
						value={form.burst_size.toString()}
						onChange={(value: string) => handleChange('burst_size')(parseInt(value) || 0)}
						param_desc={{type: 'integer', description: 'Burst capacity above the steady-state RPS limit (0 = default)'}}
					/>
					<ParamBox
						label={t('Tokens / Minute')}
						value={form.tokens_per_min.toString()}
						onChange={(value: string) => handleChange('tokens_per_min')(parseInt(value) || 0)}
						param_desc={{type: 'integer', description: 'Maximum LLM tokens per minute (0 = unlimited)'}}
					/>
				</Grid2>

				<Divider />

				<Grid2 container spacing={2}>
					<ParamBox
						label={t('Expires At (RFC3339)')}
						value={form.expires_at}
						onChange={handleChange('expires_at')}
						param_desc={{type: 'string', description: 'Optional expiry timestamp, e.g. 2027-01-01T00:00:00Z (empty = never expires)'}}
						error={!isValidExpiry(form.expires_at.trim())}
						helperText={!isValidExpiry(form.expires_at.trim()) ? t('Invalid timestamp') : undefined}
					/>
					<FormControlLabel
						control={<Switch checked={form.enabled} onChange={e => handleChange('enabled')(e.target.checked)} />}
						label={t('Enabled')}
					/>
				</Grid2>
			</Stack>
		</NewBox>
	);
}
