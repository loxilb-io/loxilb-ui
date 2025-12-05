//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IMirrorAttribute} from 'types/mirror';
import MirrorInfoInputForm from './subforms/MirrorInfoInputForm';
import MirrorObjectInputForm from './subforms/MirrorObjInputForm';
import React from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface MirrorInputFormProps {
	onChange: (data: IMirrorAttribute & { isValid?: boolean; errors?: any }) => void;
	onValidation?: (isValid: boolean) => void;
}

export default function MirrorInputForm(props: MirrorInputFormProps) {
	const {onChange, onValidation} = props;
	const {form, params, handleChange, errors, isValid} = useFormWithParams<IMirrorAttribute>('IMirrorAttribute');
	

	// Notify parent of validation state and form data
	React.useEffect(() => {
		if (form) {
			// Custom validation: check if required fields have actual values
			// Note: port and mirrObjName will be set by subforms after type/attachment are set
			const hasBasicFields = 
				!!form.mirrorIdent && 
				form.mirrorIdent.trim() !== '' &&
				form.mirrorInfo?.type !== undefined &&
				form.targetObject?.attachment !== undefined;

			// Only validate port and mirrObjName if the basic fields are set
			// This allows subforms to initialize these values asynchronously
			const customIsValid = hasBasicFields && (
				// If type is set, port should eventually be set by MirrorInfoInputForm
				(form.mirrorInfo?.type !== undefined ? !!form.mirrorInfo?.port : true) &&
				// If attachment is set, mirrObjName should eventually be set by TargetObjectInputForm
				(form.targetObject?.attachment !== undefined ? !!form.targetObject?.mirrObjName : true)
			);
			
			onChange({ ...form, isValid: customIsValid, errors });
		}
		if (onValidation) {
			onValidation(isValid);
		}
	}, [form, isValid, errors, onChange, onValidation]);

   if (!form) return null;
   return (
	   <NewBox item_name={t('Mirror')}>
		   <ParamBox label={t('Mirror Identifier')} value={form?.mirrorIdent ?? ''} onChange={handleChange('mirrorIdent')} param_desc={params?.mirrorIdent} />
		   <MirrorInfoInputForm value={form?.mirrorInfo ?? {}} onChange={handleChange('mirrorInfo')} params={params?.mirrorInfo} />
		   <MirrorObjectInputForm value={form?.targetObject ?? {}} onChange={handleChange('targetObject')} params={params?.targetObject} />
	   </NewBox>
   );
}
