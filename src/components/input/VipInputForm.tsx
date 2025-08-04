//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IVipAttribute} from 'types/ha';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function VipInputForm(props: {onChange: (data: IVipAttribute) => void}) {
	const {onChange} = props;

	const {form, params, handleChange} = useFormWithParams<IVipAttribute>('IVipAttribute', onChange);

	if (!form) return null;
	return (
		<NewBox item_name={t('HA VIP')}>
			<ParamBox label={t('Instance Name')} value={form.instance} param_desc={params?.instance} onChange={handleChange('instance')} />
			<ParamBox label={t('State')} value={form.state} param_desc={params?.state} onChange={handleChange('state')} />
			<ParamBox label={t('VIP Address')} value={form.vip} param_desc={params?.vip} onChange={handleChange('vip')} />
		</NewBox>
	);
}
