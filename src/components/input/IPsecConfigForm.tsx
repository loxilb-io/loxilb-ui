//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {FormControlLabel, Grid2, Stack, Switch} from '@mui/material';
import NewBox from 'components/layout/NewBox';
import ParamBox from 'components/element/ParamBox';
import {t} from 'i18next';
import React from 'react';
import {IIPsecConfig, IIPsecConfigMod} from 'types/ipsec';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface IPsecConfigFormProps {
	value?: IIPsecConfig | null;
	onChange: (data: IIPsecConfigMod & {isValid?: boolean}) => void;
}

export default function IPsecConfigForm(props: IPsecConfigFormProps) {
	const {onChange, value} = props;

	const [form, setForm] = React.useState<IIPsecConfigMod>({
		fastPathEnabled: value?.fastPathEnabled ?? false,
		hwOffloadEnabled: value?.hwOffloadEnabled ?? false,
		hwOffloadType: value?.hwOffloadType ?? 'none',
		antiReplayEnabled: value?.antiReplayEnabled ?? true,
		saLifetimeWarnSeconds: value?.saLifetimeWarnSeconds ?? 300,
		seqOverflowAction: value?.seqOverflowAction ?? 'rekey',
		mtu: value?.mtu ?? 1400,
	});

	const validateForm = (data: IIPsecConfigMod): boolean => {
		if ((data.mtu ?? 0) < 0 || (data.mtu ?? 0) > 65535) return false;
		if ((data.saLifetimeWarnSeconds ?? 0) < 0) return false;
		return true;
	};

	const handleChange = (field: keyof IIPsecConfigMod) => (val: any) => {
		const newForm = {...form, [field]: val};
		setForm(newForm);
		onChange({...newForm, isValid: validateForm(newForm)});
	};

	React.useEffect(() => {
		onChange({...form, isValid: validateForm(form)});
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	}, []);

	return (
		<NewBox item_name={t('IPsec Global Settings')}>
			<Stack spacing={2}>
				<Grid2 container spacing={2}>
					<FormControlLabel
						control={<Switch checked={form.fastPathEnabled ?? false} onChange={e => handleChange('fastPathEnabled')(e.target.checked)} />}
						label={t('eBPF Fast-Path')}
					/>
					<FormControlLabel
						control={<Switch checked={form.hwOffloadEnabled ?? false} onChange={e => handleChange('hwOffloadEnabled')(e.target.checked)} />}
						label={t('Hardware Crypto Offload')}
					/>
					<FormControlLabel
						control={<Switch checked={form.antiReplayEnabled ?? true} onChange={e => handleChange('antiReplayEnabled')(e.target.checked)} />}
						label={t('Anti-Replay Protection')}
					/>
				</Grid2>
				<Grid2 container spacing={2}>
					{form.hwOffloadEnabled && (
						<ParamBox
							label={t('Offload Type')}
							value={form.hwOffloadType ?? 'none'}
							onChange={handleChange('hwOffloadType')}
							param_desc={{type: 'string', enum: ['none', 'qat', 'dpaa2', 'inline'], description: 'Hardware crypto offload engine'}}
						/>
					)}
					<ParamBox
						label={t('Sequence Overflow Action')}
						value={form.seqOverflowAction ?? 'rekey'}
						onChange={handleChange('seqOverflowAction')}
						param_desc={{type: 'string', enum: ['rekey', 'drop', 'continue'], description: 'Action on ESP sequence number overflow'}}
					/>
					<ParamBox
						label={t('SA Expiry Warning (s)')}
						value={(form.saLifetimeWarnSeconds ?? 300).toString()}
						onChange={(v: string) => handleChange('saLifetimeWarnSeconds')(parseInt(v) || 0)}
						param_desc={{type: 'integer', description: 'Warn this many seconds before SA expiry'}}
					/>
					<ParamBox
						label={t('MTU')}
						value={(form.mtu ?? 1400).toString()}
						onChange={(v: string) => handleChange('mtu')(parseInt(v) || 0)}
						param_desc={{type: 'integer', description: 'MTU for IPsec packets (default 1400)'}}
					/>
				</Grid2>
			</Stack>
		</NewBox>
	);
}
