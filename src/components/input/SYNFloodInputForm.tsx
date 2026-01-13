//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Grid2, Stack, Switch, FormControlLabel} from '@mui/material';
import NewBox from 'components/layout/NewBox';
import ParamBox from 'components/element/ParamBox';
import {t} from 'i18next';
import {ISYNFloodConfigMod} from 'types/security';
import React from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface SYNFloodInputFormProps {
	value?: ISYNFloodConfigMod;
	onChange: (data: ISYNFloodConfigMod & {isValid?: boolean}) => void;
}

export default function SYNFloodInputForm(props: SYNFloodInputFormProps) {
	const {onChange, value} = props;

	const [form, setForm] = React.useState<ISYNFloodConfigMod>({
		enabled: value?.enabled !== undefined ? value.enabled : false,
		synThreshold: value?.synThreshold !== undefined ? value.synThreshold : 100,
		cookieThreshold: value?.cookieThreshold !== undefined ? value.cookieThreshold : 50,
		whitelistIps: value?.whitelistIps ?? [],
	});

	const [whitelistInput, setWhitelistInput] = React.useState((value?.whitelistIps ?? []).join(', '));

	const handleChange = (field: keyof ISYNFloodConfigMod) => (value: any) => {
		const newForm = {...form, [field]: value};
		setForm(newForm);
		onChange({...newForm, isValid: validateForm(newForm)});
	};

	const validateForm = (data: ISYNFloodConfigMod): boolean => {
		if (data.enabled && data.cookieThreshold >= data.synThreshold) return false;
		if (data.synThreshold < 0 || data.cookieThreshold < 0) return false;
		return true;
	};

	const handleWhitelistChange = (value: string) => {
		setWhitelistInput(value);
		const ips = value
			.split(',')
			.map(ip => ip.trim())
			.filter(ip => ip.length > 0);
		handleChange('whitelistIps')(ips);
	};

	React.useEffect(() => {
		onChange({...form, isValid: validateForm(form)});
	}, []);	return (
		<NewBox item_name={t('SYN Flood Protection Configuration')}>
			<Stack spacing={3}>
				<FormControlLabel
					control={<Switch checked={form.enabled} onChange={e => handleChange('enabled')(e.target.checked)} />}
					label={t('Enable SYN Flood Protection')}
				/>

				{form.enabled && (
					<Grid2 container spacing={2}>
						<ParamBox
							label={t('SYN Threshold')}
							value={(form.synThreshold ?? 100).toString()}
							onChange={(value: string) => handleChange('synThreshold')(parseInt(value) || 0)}
							param_desc={{type: 'integer', description: 'Maximum SYNs per second per IP (hard drop threshold)', required: true}}
						/>
						<ParamBox
							label={t('Cookie Threshold')}
							value={(form.cookieThreshold ?? 50).toString()}
							onChange={(value: string) => handleChange('cookieThreshold')(parseInt(value) || 0)}
							param_desc={{type: 'integer', description: 'Enable SYN cookies above this rate (must be < synThreshold)', required: true}}
						/>
					</Grid2>
				)}

				<ParamBox
					label={t('Whitelist IPs (comma-separated)')}
					value={whitelistInput}
					onChange={handleWhitelistChange}
					param_desc={{type: 'string', description: 'IP addresses to bypass SYN flood protection (comma-separated)'}}
				/>
			</Stack>
		</NewBox>
	);
}
