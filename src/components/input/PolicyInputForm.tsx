//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert} from '@mui/material';
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

	// A two-rate meter (trTCM) needs peak >= committed. The gateway validates
	// each rate against a floor but never their ordering, so a peak below the
	// committed rate is accepted and programmed as an invalid meter. Enforce the
	// ordering here, but only when a peak rate is actually set (srTCM leaves it
	// zero/unused).
	const cir = Number(form?.policyInfo?.committedInfoRate);
	const pir = Number(form?.policyInfo?.peakInfoRate);
	const rateOrderValid = !(pir > 0 && cir > 0 && pir < cir);
	const formValid = isValid && rateOrderValid;

	// Notify parent of validation state and form data
	React.useEffect(() => {
		if (form) {
			onChange({ ...form, isValid: formValid, errors });
		}
		if (onValidation) {
			onValidation(formValid);
		}
	}, [form, formValid, errors, onChange, onValidation]);

	if (!form) return null;
	return (
		<NewBox item_name={t('Policy')}>
		   <ParamBox label={t('Policy Identifier')} value={form?.policyIdent ?? ''} onChange={handleChange('policyIdent')} param_desc={params?.policyIdent} />
		   <PolicyInfoInputForm value={form?.policyInfo ?? {}} onChange={handleChange('policyInfo')} params={params?.policyInfo} />
		   <TargetObjectInputForm value={form?.targetObject ?? {}} onChange={handleChange('targetObject')} params={params?.targetObject} />
		   {!rateOrderValid && (
			   <Alert severity="warning">{t('Peak Info Rate must be greater than or equal to Committed Info Rate.')}</Alert>
		   )}
		</NewBox>
	);
}
