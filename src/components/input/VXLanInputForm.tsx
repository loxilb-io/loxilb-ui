//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IVxlanInput} from 'types/vxlan';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function VxlanInputForm(props: {onChange: (data: IVxlanInput) => void}) {
	const {onChange} = props;

	const {form, params, handleChange} = useFormWithParams<IVxlanInput>('IVxlanInput', onChange);

	if (!form) return null;

	// A VNI is a 24-bit field; the gateway does not range-check it and would
	// try to create an impossible tunnel id.
	const vni = Number(form?.vxlanID);
	const vniOutOfRange = !!form?.vxlanID && !(vni >= 1 && vni <= 16777215);

	return (
		<NewBox item_name={t('VxLAN')}>
			<HorizontalStack>
				<ParamBox label={t('Endpoint Interface')} value={form.epIntf} param_desc={params?.epIntf} onChange={handleChange('epIntf')} />
				<ParamBox label={t('VXLAN ID')} value={form.vxlanID} param_desc={params?.vxlanID} onChange={handleChange('vxlanID')} />
			</HorizontalStack>
			{vniOutOfRange && (
				<Alert severity="warning">{t('VXLAN ID must be between 1 and 16777215.')}</Alert>
			)}
		</NewBox>
	);
}
