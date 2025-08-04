//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IFdbAttribute} from 'types/fdb';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function FdbInputForm(props: {onChange: (data: IFdbAttribute) => void}) {
	const {onChange} = props;

	const {form, params, handleChange} = useFormWithParams<IFdbAttribute>('IFdbAttribute', onChange);

	if (!form) return null;
	return (
		<NewBox item_name={t('FDB Entry')}>
			<ParamBox label={t('Device Name')} value={form.dev} onChange={handleChange('dev')} param_desc={params?.dev} />
			<ParamBox label={t('MAC Address')} value={form.macAddress} onChange={handleChange('macAddress')} param_desc={{...params?.macAddress, type: 'macaddress'}} />
		</NewBox>
	);
}
