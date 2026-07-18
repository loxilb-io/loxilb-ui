//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Divider} from '@mui/material';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IFirewallRule} from 'types/firewall';
import FirewallOptionsForm from './subforms/FirewallOptionsForm';
import FirewallRuleArgsForm, {getPortRangeError} from './subforms/FirewallRuleArgsForm';
import React from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface FirewallInputFormProps {
	onChange: (data: IFirewallRule & { isValid?: boolean; errors?: any }) => void;
	onValidation?: (isValid: boolean) => void;
}

export default function FirewallInputForm(props: FirewallInputFormProps) {
	const {onChange, onValidation} = props;
	const {form, params, handleChange, errors, isValid} = useFormWithParams<IFirewallRule>('IFirewallRule');

	// Gateway accepts min>max port ranges, so the form must block them (F4 class).
	const ra = form?.ruleArguments;
	const portRangesValid =
		!getPortRangeError(ra?.minSourcePort, ra?.maxSourcePort) && !getPortRangeError(ra?.minDestinationPort, ra?.maxDestinationPort);
	const formValid = isValid && portRangesValid;

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
		<NewBox item_name={t('Firewall Rule')}>
		   <FirewallRuleArgsForm value={form?.ruleArguments ?? {}} onChange={handleChange('ruleArguments')} params={params?.ruleArguments} />
		   <Divider />
		   <FirewallOptionsForm value={form?.opts ?? {}} onChange={handleChange('opts')} params={params?.opts} />
		</NewBox>
	);
}
