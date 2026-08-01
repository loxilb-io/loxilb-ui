//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {isValidIPAddress} from 'common';
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import {t} from 'i18next';
import {useEffect, useState} from 'react';
import {IVipAttribute} from 'types/ha';
import {IEnumItem} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function VipInputForm(props: {initialData?: IVipAttribute; onChange: (data: IVipAttribute & {isValid?: boolean}) => void}) {
	const {initialData, onChange} = props;

	const [formData, setFormData] = useState<IVipAttribute>({
		instance: initialData?.instance || '',
		state: initialData?.state || 'NOT_DEFINED',
		vip: initialData?.vip || '',
	});

	// HA state options
	const stateOptions: IEnumItem[] = [
		{id: 0, name: 'NOT_DEFINED', send_value: 'NOT_DEFINED'},
		{id: 1, name: 'MASTER', send_value: 'MASTER'},
		{id: 2, name: 'BACKUP', send_value: 'BACKUP'},
	];

	// A VIP is required and must be a real IP (0.0.0.0 = "unset" is allowed).
	// Without this the form accepted 999.999.999.999 and still enabled Update
	// (F-STATUS-3). isValid rides the onChange payload so the page can gate the
	// button; the connector strips it before POST so it never leaks upstream.
	const vipValid = isValidIPAddress(formData.vip);
	const validateForm = (data: IVipAttribute): boolean => !!data.instance && isValidIPAddress(data.vip);

	// Update parent component when form changes
	useEffect(() => {
		onChange({...formData, isValid: validateForm(formData)});
	}, [formData, onChange]);

	// Handle form field changes
	const handleChange = (field: keyof IVipAttribute) => (value: any) => {
		setFormData(prev => ({
			...prev,
			[field]: value,
		}));
	};

	return (
		<NewBox item_name={t('HA VIP')}>
		   <ParamBox label={t('Instance Name')} value={formData.instance} onChange={handleChange('instance')} />
		   <ParamBox label={t('State')} value={formData.state} param_desc={{type: 'string', enum: stateOptions}} onChange={handleChange('state')} />
		   <ParamBox
			   label={t('VIP Address')}
			   value={formData.vip}
			   onChange={handleChange('vip')}
			   param_desc={{type: 'string', format: 'ipv4', description: 'Virtual IP for HA (0.0.0.0 = unset)', required: true}}
			   error={!vipValid}
			   helperText={!vipValid ? t('Enter a valid IP address') : undefined}
		   />
		</NewBox>
	);
}
