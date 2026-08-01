//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Divider} from '@mui/material';
import {isValidIPAddress, isValidIPAddressCidr} from 'common';
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

	// IP-format gate. useFormWithParams' validateForm only checks required/
	// integer/enum — it does NOT validate ipaddress/ipaddress_cidr string
	// formats, and IPAddressBox forwards an invalid value on onChange (it only
	// shows a red helper). Every other IP-bearing form (IPFilter/IPsec/LB/
	// Endpoint/Vip) gates submit on isValidIPAddress; the Firewall form was the
	// lone omission, so a garbage Source/Destination IP or SNAT To IP could be
	// POSTed to the gateway. Optional fields: only reject a NON-empty malformed
	// value (an empty field is a legitimately-unset rule key).
	const srcIpValid = !ra?.sourceIP || isValidIPAddress(ra.sourceIP) || isValidIPAddressCidr(ra.sourceIP);
	const dstIpValid = !ra?.destinationIP || isValidIPAddress(ra.destinationIP) || isValidIPAddressCidr(ra.destinationIP);
	const toIpValid = !form?.opts?.toIP || isValidIPAddress(form.opts.toIP);
	const formValid = isValid && portRangesValid && srcIpValid && dstIpValid && toIpValid;

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
