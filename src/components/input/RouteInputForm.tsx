//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IRouteAttrInput} from 'types/route_attr';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function RouteInputForm(props: {onChange: (data: IRouteAttrInput) => void}) {
	const {onChange} = props;

	const {form, params, handleChange} = useFormWithParams<IRouteAttrInput>('IRouteAttrInput', onChange);

	if (!form) return null;
	return (
		<NewBox item_name={t('Route')}>
			<ParamBox
				label={t('Destination IP/Netmask')}
				value={form.destinationIPNet}
				onChange={handleChange('destinationIPNet')}
				param_desc={{...params?.destinationIPNet, type: 'ipaddress'}}
			/>
			<ParamBox label={t('Gateway')} value={form.gateway} onChange={handleChange('gateway')} param_desc={{...params?.gateway, type: 'ipaddress'}} />
			<ParamBox label={t('Protocol')} value={form.protocol} onChange={handleChange('protocol')} param_desc={params?.protocol} />
		</NewBox>
	);
}
