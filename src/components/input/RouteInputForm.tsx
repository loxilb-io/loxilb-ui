//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Tooltip} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import DropDownSelectBox from 'components/element/DropDownSelectBox';
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
				value={form?.destinationIPNet ?? ''}
				onChange={handleChange('destinationIPNet')}
				param_desc={{...params?.destinationIPNet, type: 'ipaddress_cidr'}}
		   />
		   <ParamBox label={t('Gateway')} value={form?.gateway ?? ''} onChange={handleChange('gateway')} param_desc={{...params?.gateway, type: 'ipaddress'}} />
		   <Tooltip 
		   	title={t('Select routing protocol. Just static routing can be saved.')} 
		   	arrow 
		   	placement="top"
		   >
			   <div>
				   <DropDownSelectBox
					   label={t('Protocol')}
					   value={form?.protocol ?? ''}
					   onChange={handleChange('protocol')}
					   item_list={[
						   {id: 1, name: 'None', send_value: ''},
						   {id: 2, name: 'Static', send_value: 'static'}
					   ]}
				   />
			   </div>
		   </Tooltip>
		</NewBox>
	);
}
