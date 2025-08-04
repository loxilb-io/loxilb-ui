//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Divider} from '@mui/material';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IFirewallRule} from 'types/firewall';
import FirewallOptionsForm from './subforms/FirewallOptionsForm';
import FirewallRuleArgsForm from './subforms/FirewallRuleArgsForm';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function FirewallInputForm(props: {onChange: (data: IFirewallRule) => void}) {
	const {onChange} = props;

	const {form, params, handleChange} = useFormWithParams<IFirewallRule>('IFirewallRule', onChange);

	if (!form) return null;
	return (
		<NewBox item_name={t('Firewall Rule')}>
			<FirewallRuleArgsForm value={form.ruleArguments} onChange={handleChange('ruleArguments')} params={params?.ruleArguments} />
			<Divider />
			<FirewallOptionsForm value={form.opts} onChange={handleChange('opts')} params={params?.opts} />
		</NewBox>
	);
}
