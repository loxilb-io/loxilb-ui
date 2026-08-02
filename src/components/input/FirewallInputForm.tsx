//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert, Divider} from '@mui/material';
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

	// Gateway accepts min>max port ranges, so the form must block them.
	const ra = form?.ruleArguments;
	const opts = form?.opts;
	const portRangesValid =
		!getPortRangeError(ra?.minSourcePort, ra?.maxSourcePort) && !getPortRangeError(ra?.minDestinationPort, ra?.maxDestinationPort);

	// allow/drop/redirect/trap/doSnat are mutually exclusive verdicts. The
	// gateway resolves them by a fixed priority order and silently discards the
	// rest, so a rule marked both Allow and Drop would be stored as Allow with
	// no error — block more than one verdict here.
	const verdictCount = [opts?.allow, opts?.drop, opts?.redirect, opts?.trap, opts?.doSnat].filter(Boolean).length;
	const verdictValid = verdictCount <= 1;

	// SNAT requires a target. The gateway rejects an empty/blank To IP with a
	// 400 malformed-args, so gate it client-side rather than round-tripping a
	// request that can only fail.
	const snatValid = !opts?.doSnat || (!!opts?.toIP && isValidIPAddress(opts.toIP));

	// A rule with no match criteria is defaulted by the gateway to a
	// 0.0.0.0/0 -> 0.0.0.0/0 catch-all, which is easy to create by accident
	// from a blank form. Require an explicit source or destination so a
	// catch-all must be entered deliberately (e.g. 0.0.0.0/0).
	const hasMatchCriteria = !!ra?.sourceIP?.trim() || !!ra?.destinationIP?.trim();

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
	const formValid =
		isValid && portRangesValid && srcIpValid && dstIpValid && toIpValid && verdictValid && snatValid && hasMatchCriteria;

	// Notify parent of validation state and form data
	React.useEffect(() => {
		if (form) {
			onChange({ ...form, isValid: formValid, errors });
		}
		if (onValidation) {
			onValidation(formValid);
		}
	}, [form, formValid, errors, onChange, onValidation]);

	// Surface the reason submit is blocked (a silently-disabled button reads as
	// a UI bug). Only cross-field gates that no single field renders itself.
	const blockingReasons: string[] = [];
	if (!hasMatchCriteria) blockingReasons.push(t('Specify at least a Source or Destination IP (use 0.0.0.0/0 for an explicit catch-all).'));
	if (!verdictValid) blockingReasons.push(t('Choose only one action — Allow, Drop, Redirect, Trap and Do SNAT are mutually exclusive.'));
	if (!snatValid) blockingReasons.push(t('Do SNAT requires a valid To IP.'));

	if (!form) return null;
	return (
		<NewBox item_name={t('Firewall Rule')}>
		   <FirewallRuleArgsForm value={form?.ruleArguments ?? {}} onChange={handleChange('ruleArguments')} params={params?.ruleArguments} />
		   <Divider />
		   <FirewallOptionsForm value={form?.opts ?? {}} onChange={handleChange('opts')} params={params?.opts} />
		   {blockingReasons.length > 0 && (
			   <Alert severity="warning" sx={{mt: 1}}>
				   {blockingReasons.map(r => (
					   <div key={r}>{r}</div>
				   ))}
			   </Alert>
		   )}
		</NewBox>
	);
}
