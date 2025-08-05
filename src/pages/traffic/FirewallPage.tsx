//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, RadioGroup, FormControlLabel, Radio} from '@mui/material';
import SingleTextField from 'components/element/SingleTextField';
import ValueBunch from 'components/element/ValueBunch';
import FirewallInputForm from 'components/input/FirewallInputForm';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import FirewallTable from 'components/table/traffic/FirewallTable';
import {request_create_firewall_rule, request_delete_all_firewall_rules} from 'connector/instance/firewall';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useFirewallRules} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useRef, useState} from 'react';
import {IFirewallRule, IFirewallRules, IOptions} from 'types/firewall';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
function OptionPannel(props: {name: string; data: IOptions}) {
	const {name, data} = props;

	return (
		<SubTitlePannel title={t('Details')} sub_title={''}>
			<Stack spacing={2}>
				<ValueBunch name={t('Traffic Action')}>
					<RadioGroup row name="traffic-action" value={(() => {
					  if (data.allow) return 'allow';
					  if (data.drop) return 'drop';
					  if (data.trap) return 'trap';
					  if (data.redirect) return 'redirect';
					  return '';
					})()}>
						<FormControlLabel value="allow" control={<Radio disabled sx={{color: 'black', '&.Mui-checked': {color: 'black'}}} />} label={t('Allow')} sx={{color: 'black', '& .MuiFormControlLabel-label': {color: 'black'}}} />
						<FormControlLabel value="drop" control={<Radio disabled sx={{color: 'black', '&.Mui-checked': {color: 'black'}}} />} label={t('Drop')} sx={{color: 'black', '& .MuiFormControlLabel-label': {color: 'black'}}} />
						<FormControlLabel value="trap" control={<Radio disabled sx={{color: 'black', '&.Mui-checked': {color: 'black'}}} />} label={t('Trap')} sx={{color: 'black', '& .MuiFormControlLabel-label': {color: 'black'}}} />
						<FormControlLabel value="redirect" control={<Radio disabled sx={{color: 'black', '&.Mui-checked': {color: 'black'}}} />} label={t('Redirect')} sx={{color: 'black', '& .MuiFormControlLabel-label': {color: 'black'}}} />
					</RadioGroup>
				</ValueBunch>
				<ValueBunch name={t('Settings')}>
					<SingleTextField label={t('FW Mark')} value={data.fwMark != null ? data.fwMark.toString() : ""} />
					<SingleTextField label={t('On Default')} value={data.onDefault != null ? data.onDefault.toString() : ""} />
					<SingleTextField label={t('Record')} value={data.record != null ? data.record.toString() : ""} />
				</ValueBunch>
				<ValueBunch name={t('ACTION: SNAT')}>
					<SingleTextField label={t('Do Snat')} value={data.doSnat != null ? data.doSnat.toString() : ""} />
					<SingleTextField label={t('To IP')} value={data.toIP != null ? data.toIP : ""} />
					<SingleTextField label={t('To Port')} value={data.toPort != null ? data.toPort.toString() : ""} />
				</ValueBunch>
				<ValueBunch name={t('ACTION: Redirect')}>
					<SingleTextField label={t('Port Name')} value={data.redirectPortName != null ? data.redirectPortName : ""} />
				</ValueBunch>
			</Stack>
		</SubTitlePannel>
	);
}

export default function FirewallPage() {
	const inst = useInstanceFromURL();

	const {data, refetch} = useFirewallRules(inst);
	const fw_info: IFirewallRules = {fwAttr: data ?? []};

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();

	const handleSelectionChange = (selection: any) => set_selected_rows(selection);

	const handleDelete = async () => {
		if (!inst) return;

		const item = fw_info.fwAttr[selected_rows[0]];
		const res = await request_delete_all_firewall_rules(inst, {...item.ruleArguments});
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			refetch();
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
	};

	const instanceRef = useRef<IFirewallRule | null>(null);
	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<FirewallInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					enableYes(!!data && data.ruleArguments && data.ruleArguments.portName !== '');
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			t('Add'),
			t('Cancel'),
			async () => {
				if (!instanceRef.current) return;

				const res = await request_create_firewall_rule(inst, instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					refetch();
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			},
			true,
		);
	};

	return (
		<Fragment>
			<FirewallTable data={fw_info} selected_rows={selected_rows} onChangeSelectedRows={handleSelectionChange} onAdd={handleAdd} onDelete={handleDelete} />

			{selected_rows.length === 1 && (
				<LowerSection>
					<OptionPannel name={""} data={fw_info.fwAttr[selected_rows[0]].opts} />					
				</LowerSection>
			)}
		</Fragment>
	);
}
