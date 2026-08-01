//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Grid2, Stack} from '@mui/material';
import NewBox from 'components/layout/NewBox';
import ParamBox from 'components/element/ParamBox';
import {t} from 'i18next';
import {ITenantRateLimitMod} from 'types/ai';
import React from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface TenantRateLimitInputFormProps {
	// Pre-fill (edit / upsert of an existing tenant); tenant_id locked when set
	value?: ITenantRateLimitMod;
	onChange: (data: ITenantRateLimitMod & {isValid?: boolean}) => void;
}

export default function TenantRateLimitInputForm(props: TenantRateLimitInputFormProps) {
	const {onChange, value} = props;

	const [form, setForm] = React.useState<ITenantRateLimitMod>(
		value ?? {
			tenant_id: '',
			rps: 0,
			tokens_per_min: 0,
		},
	);

	const validateForm = (data: ITenantRateLimitMod): boolean => {
		if (data.tenant_id.trim().length === 0) return false;
		if ((data.rps ?? 0) < 0 || (data.tokens_per_min ?? 0) < 0) return false;
		return true;
	};

	const handleChange = (field: keyof ITenantRateLimitMod) => (val: any) => {
		const newForm = {...form, [field]: val};
		setForm(newForm);
		onChange({...newForm, tenant_id: newForm.tenant_id.trim(), isValid: validateForm(newForm)});
	};

	React.useEffect(() => {
		onChange({...form, tenant_id: form.tenant_id.trim(), isValid: validateForm(form)});
	}, []);

	return (
		<NewBox item_name={t('AI Tenant Rate Limit')}>
			<Stack spacing={3}>
				<ParamBox
					label={t('Tenant ID')}
					value={form.tenant_id}
					onChange={handleChange('tenant_id')}
					disabled={!!value}
					param_desc={{type: 'string', description: 'Tenant identifier', required: true}}
				/>
				<Grid2 container spacing={2}>
					<ParamBox
						label={t('Rate Limit (req/s)')}
						value={(form.rps ?? 0).toString()}
						onChange={(val: string) => handleChange('rps')(parseInt(val) || 0)}
						param_desc={{type: 'integer', description: 'Maximum requests per second for the tenant (0 = unlimited)'}}
					/>
					<ParamBox
						label={t('Tokens / Minute')}
						value={(form.tokens_per_min ?? 0).toString()}
						onChange={(val: string) => handleChange('tokens_per_min')(parseInt(val) || 0)}
						param_desc={{type: 'integer', description: 'Maximum LLM tokens per minute for the tenant (0 = unlimited)'}}
					/>
				</Grid2>
			</Stack>
		</NewBox>
	);
}
