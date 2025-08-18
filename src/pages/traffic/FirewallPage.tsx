//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, RadioGroup, FormControlLabel, Radio} from '@mui/material';
import { getStableHash } from 'common';
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
import React from 'react';
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
					<SingleTextField label={t('FW Mark')} value={data.fwMark != null ? data.fwMark.toString() : ""} tooltip='Set a fw mark for any matching LB rule'/>
					<SingleTextField label={t('On Default')} value={data.onDefault != null ? data.onDefault.toString() : "Flase"} />
					<SingleTextField label={t('Record')} value={data.record != null ? data.record.toString() : "False"} tooltip='Record or dump for matching rule'/>
				</ValueBunch>
				<ValueBunch name={t('ACTION: SNAT')}>
					<SingleTextField label={t('Do Snat')} value={data.doSnat != null ? data.doSnat.toString() : "False"} />
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
   // Track selected rule for synchronization
   const [selected_portName, set_selected_portName] = useState<string | null>(null);
   const {openPopUp, enableYes} = usePopUp();
   
   // Hash function for firewall rule
   const getHashKey = (item: IFirewallRule) => {
	   const str = `${item.ruleArguments.portName || ''}_${item.ruleArguments.sourceIP || ''}_${item.ruleArguments.minSourcePort || ''}_${item.ruleArguments.maxSourcePort || ''}_${item.ruleArguments.destinationIP || ''}_${item.ruleArguments.minDestinationPort || ''}_${item.ruleArguments.maxDestinationPort || ''}_${item.ruleArguments.protocol || ''}`;
		return getStableHash(str);
   };
   
   // Sorted firewall rules
   const sortedAttr = fw_info.fwAttr ? [...fw_info.fwAttr].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];
   const instanceRef = useRef<IFirewallRule | null>(null);
   let selected_index = -1;

   if (selected_rows.length === 1 && fw_info.fwAttr) {
	   const original = fw_info.fwAttr[selected_rows[0]];
	   selected_index = sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
   } else if (selected_portName) {
	   selected_index = sortedAttr.findIndex(attr => attr.ruleArguments.portName === selected_portName);
   }
   // Selection handler: map sorted index back to original
   const handleSelectionChange = (indices: number[]) => {
	   if (indices.length === 1 && fw_info.fwAttr) {
		   const sortedItem = sortedAttr[indices[0]];
		   const originalIndex = fw_info.fwAttr.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
		   set_selected_rows(originalIndex !== -1 ? [originalIndex] : []);
	   } else {
		   set_selected_rows([]);
	   }
   };

	const handleDelete = async () => {
		if (!inst) return;

		const item = fw_info.fwAttr[selected_rows[0]];
		const res = await request_delete_all_firewall_rules(inst, {...item.ruleArguments});
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			setTimeout(() => {
				refetch();
			}, 1000);
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
	};

	const handleAdd = () => {
		if (!inst) return;

		const input_form = (
			<FirewallInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					enableYes(data.isValid);
					// enableYes(!!data && data.ruleArguments && data.ruleArguments.portName !== '');
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
					setTimeout(() => {
						refetch();
					}, 1000);
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			},
			true,
		);
	};

   // Synchronize selected_portName with selected_rows
   React.useEffect(() => {
	   if (!fw_info.fwAttr || fw_info.fwAttr.length === 0) return;
	   if (selected_rows.length === 1) {
		   const portName = fw_info.fwAttr[selected_rows[0]].ruleArguments.portName;
		   set_selected_portName(portName);
	   } else if (selected_portName !== null) {
		   set_selected_portName(null);
	   }
   }, [fw_info, selected_rows, selected_portName]);

   return (
	   <Fragment>
		   <FirewallTable
			   data={{fwAttr: sortedAttr}}
			   selected_rows={selected_index !== -1 ? [selected_index] : []}
			   onChangeSelectedRows={handleSelectionChange}
			   onAdd={handleAdd}
			   onDelete={handleDelete}
		   />
		   {selected_index !== -1 && (
			   <LowerSection>
				   <OptionPannel name={""} data={sortedAttr[selected_index].opts} />
			   </LowerSection>
		   )}
	   </Fragment>
   );
}
