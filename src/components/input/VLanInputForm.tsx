//---------------------------------------------------------
// Imports
//---------------------------------------------------------
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

	const {form, params, handleChange} = useFormWithParams<IVlanInput>('IVlanInput', onChange);

	if (!form) return null;
	return (
		<NewBox item_name={t('VLAN')}>
			<ParamBox width="150px" label={t('VLAN ID')} value={form.vid} param_desc={params?.vid} onChange={handleChange} />
		</NewBox>
	);
}
