//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import {t} from 'i18next';
import {useEffect, useState} from 'react';
import {IVipAttribute} from 'types/ha';
import {IEnumItem} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function VipInputForm(props: {initialData?: IVipAttribute; onChange: (data: IVipAttribute) => void}) {
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

	// Update parent component when form changes
	useEffect(() => {
		onChange(formData);
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
		   <ParamBox label={t('VIP Address')} value={formData.vip} onChange={handleChange('vip')} />
		</NewBox>
	);
}
