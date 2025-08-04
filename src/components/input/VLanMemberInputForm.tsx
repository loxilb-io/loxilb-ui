//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IVlanMemberInput} from 'types/vlan';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function VlanMemberInputForm(props: {onChange: (data: IVlanMemberInput) => void}) {
	const {onChange} = props;

	const {form, params, handleChange} = useFormWithParams<IVlanMemberInput>('IVlanMemberInput', onChange);

	if (!form) return null;
	return (
		<NewBox item_name={t('VLAN Member')}>
			<HorizontalStack>
				<ParamBox label={t('Device Name')} value={form.dev} param_desc={params?.dev} onChange={handleChange('dev')} />
				<ParamBox label={t('Tagged')} value={form.tagged} param_desc={params?.tagged} onChange={handleChange('tagged')} />
			</HorizontalStack>
		</NewBox>
	);
}
