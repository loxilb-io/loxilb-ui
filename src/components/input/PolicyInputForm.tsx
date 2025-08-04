//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IPolicyAttribute} from 'types/qos';
import PolicyInfoInputForm from './subforms/PolicyInfoInputForm';
import TargetObjectInputForm from './subforms/TargetObjInputForm';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function PolicyInputForm(props: {onChange: (data: IPolicyAttribute) => void}) {
	const {onChange} = props;

	const {form, params, handleChange} = useFormWithParams<IPolicyAttribute>('IPolicyAttribute', onChange);

	if (!form) return null;
	return (
		<NewBox item_name={t('Policy')}>
			<ParamBox label={t('Policy Identifier')} value={form.policyIdent} onChange={handleChange('policyIdent')} param_desc={params?.policyIdent} />
			<PolicyInfoInputForm value={form.policyInfo} onChange={handleChange('policyInfo')} params={params?.policyInfo} />
			<TargetObjectInputForm value={form.targetObject} onChange={handleChange('targetObject')} params={params?.targetObject} />
		</NewBox>
	);
}
