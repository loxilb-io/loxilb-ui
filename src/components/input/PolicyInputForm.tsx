//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IPolicyAttribute} from 'types/qos';
import PolicyInfoInputForm from './subforms/PolicyInfoInputForm';
import TargetObjectInputForm from './subforms/PolicyObjInputForm';
import React from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface PolicyInputFormProps {
	onChange: (data: IPolicyAttribute & { isValid?: boolean; errors?: any }) => void;
	onValidation?: (isValid: boolean) => void;
}

export default function PolicyInputForm(props: PolicyInputFormProps) {
	const {onChange, onValidation} = props;
	const {form, params, handleChange, errors, isValid} = useFormWithParams<IPolicyAttribute>('IPolicyAttribute');

	// Notify parent of validation state and form data
	React.useEffect(() => {
		if (form) {
			onChange({ ...form, isValid, errors });
		}
		if (onValidation) {
			onValidation(isValid);
		}
	}, [form, isValid, errors, onChange, onValidation]);

	if (!form) return null;
	return (
		<NewBox item_name={t('Policy')}>
		   <ParamBox label={t('Policy Identifier')} value={form?.policyIdent ?? ''} onChange={handleChange('policyIdent')} param_desc={params?.policyIdent} />
		   <PolicyInfoInputForm value={form?.policyInfo ?? {}} onChange={handleChange('policyInfo')} params={params?.policyInfo} />
		   <TargetObjectInputForm value={form?.targetObject ?? {}} onChange={handleChange('targetObject')} params={params?.targetObject} />
		</NewBox>
	);
}
