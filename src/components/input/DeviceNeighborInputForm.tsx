//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {INeighborAttr} from 'types/device_neighbor';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function DeviceNeighborInputForm(props: {onChange: (data: INeighborAttr) => void}) {
	const {onChange} = props;

	const {form, params, handleChange} = useFormWithParams<INeighborAttr>('INeighborAttr', onChange);

	if (!form) return null;
	return (
		<NewBox item_name={t('Device Neighbor')}>
			<ParamBox label={t('IP Address')} value={form.ipAddress} onChange={handleChange('ipAddress')} param_desc={{...params?.ipAddress, type: 'ipaddress'}} />
			<ParamBox label={t('Device Name')} value={form.dev} onChange={handleChange('dev')} param_desc={params?.dev} />
			<ParamBox label={t('MAC Address')} value={form.macAddress} onChange={handleChange('macAddress')} param_desc={{...params?.macAddress, type: 'macaddress'}} />
		</NewBox>
	);
}
