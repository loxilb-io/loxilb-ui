//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IVlanInput} from 'types/vlan';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function VLanInputForm(props: {onChange: (data: IVlanInput) => void}) {
   const {onChange} = props;

   const {form, params, handleChange} = useFormWithParams<IVlanInput>('IVlanInput', (data) => {
	   onChange(data);
   });

   if (!form) return null;

   // 802.1Q reserves vid 0 and 4095; the gateway creates a bridge for any
   // number it is given, so bound the id here.
   const vid = Number(form?.vid);
   const vidOutOfRange = !!form?.vid && !(vid >= 1 && vid <= 4094);

   return (
	   <NewBox item_name={t('VLAN')}>
		  <ParamBox
			  width="150px"
			  label={t('VLAN ID')}
			  value={form?.vid ?? ''}
			  param_desc={params?.vid}
			  onChange={(val) => {
				  handleChange('vid')(val);
			  }}
		  />
		  {vidOutOfRange && (
			  <Alert severity="warning">{t('VLAN ID must be between 1 and 4094.')}</Alert>
		  )}
	   </NewBox>
   );
}
