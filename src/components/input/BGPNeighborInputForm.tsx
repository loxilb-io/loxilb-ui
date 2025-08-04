//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IBgpNeighborInput} from 'types/bgp_neighbor';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BGPNeighborInputForm(props: {onChange: (data: IBgpNeighborInput) => void}) {
	const {onChange} = props;

	const {form, params, handleChange} = useFormWithParams<IBgpNeighborInput>('IBgpNeighborInput', onChange);

	if (!form) return null;
	return (
		<NewBox item_name={t('BGP Neighbor')}>
			<ParamBox label={t('IP Address')} value={form.ipAddress} onChange={handleChange('ipAddress')} param_desc={{...params?.ipAddress, type: 'ipaddress'}} />
			<ParamBox label={t('Remote AS')} value={form.remoteAs} onChange={handleChange('remoteAs')} param_desc={params?.remoteAs} />
			<ParamBox label={t('Remote Port')} value={form.remotePort} onChange={handleChange('remotePort')} param_desc={{...params?.remotePort, type: 'port'}} />
			<ParamBox label={t('Enable Multi-Hop')} value={form.setMultiHop} onChange={handleChange('setMultiHop')} param_desc={params?.setMultiHop} />
		</NewBox>
	);
}
