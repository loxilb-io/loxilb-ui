//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Button, Checkbox, FormControl, InputLabel, ListItemText, MenuItem, Select, Stack, Typography} from '@mui/material';
import actions from 'assets/json/actions.json';
import policyTypes from 'assets/json/policytypes.json';
import ParamBox from 'components/element/ParamBox';
import {request_apply_bgp_policy} from 'connector/instance/bgp';
import useFormWithParams from 'hooks/inputFormHook';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useBGPNeighbors, useBGPPolicyDefs} from 'hooks/query/bgpHooks';
import {t} from 'i18next';
import {IBgpPolicyApply} from 'types/bgp_policy';
import {IEnumItem} from 'types/global';

//---------------------------------------------------------
// Main Component
//---------------------------------------------------------
export default function BGPApplyPage() {
	const inst = useInstanceFromURL();
	const {openPopUp} = usePopUp();

	const {form, params, handleChange} = useFormWithParams<IBgpPolicyApply>('IBgpPolicyApply');

	const {data: neighbor_data, refetch: refetchNeighbors} = useBGPNeighbors(inst);
	const {data: policy_data} = useBGPPolicyDefs(inst);

	const neighbor_list: IEnumItem[] = neighbor_data?.map((neighbor, index) => ({id: index, name: neighbor.ipAddress ?? '', send_value: neighbor.ipAddress ?? ''})) ?? [];
	const policy_list: IEnumItem[] = policy_data?.map((policy, index) => ({id: index, name: policy.name ?? '', send_value: policy.name ?? ''})) ?? [];

	const handleApply = () => {
		if (!inst || !form || !form.ipAddress || form.ipAddress === '') openPopUp(t('Error'), t('Please select a neighbor IP address.'), t('OK'));
		else {
			openPopUp(t('Apply BGP Policy'), t('Are you sure you want to apply the selected BGP policy to this neighbor?'), t('Apply'), t('Cancel'), async () => {
				const res = await request_apply_bgp_policy(inst, form);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Updated successfully.'), t('OK'));
					refetchNeighbors();
				} else openPopUp(t('Error'), t('Failed to update. {{error}}', {error: res.error}), t('OK'));
			});
		}
	};

	if (!form) return null;
	return (
		<Stack spacing={4} maxWidth={600} padding={2}>
			<Typography variant="h6">{t('Apply BGP Policy to Neighbor')}</Typography>

			<ParamBox label={t('BGP Neighbor IP')} value={form.ipAddress} onChange={handleChange('ipAddress')} param_desc={{...params?.ipAddress, enum: neighbor_list}} />

			<ParamBox label={t('Policy Type')} value={form.policyType} onChange={handleChange('policyType')} param_desc={{...params?.policyType, enum: policyTypes}} />

			<FormControl fullWidth size="small">
				<InputLabel>{t('Policy List')}</InputLabel>

				{policy_list.length === 0 ? (
					<Select label={t('Policy List')} value="0" disabled>
						<MenuItem value="0" disabled>
							{t('No policy defined')}
						</MenuItem>
					</Select>
				) : (
					<Select
						multiple
						value={form.policies ?? []}
						onChange={e => handleChange('policies')(e.target.value)}
						renderValue={selected => (selected as string[]).join(', ')}
					>
						{policy_list.map(item => (
							<MenuItem key={item.id} value={item.send_value}>
								<Checkbox checked={form.policies?.includes(item.send_value.toString()) ?? false} />
								<ListItemText primary={item.name} />
							</MenuItem>
						))}
					</Select>
				)}
			</FormControl>

			<ParamBox label={t('Route Action')} value={form.routeAction} onChange={handleChange('routeAction')} param_desc={{...params?.routeAction, enum: actions}} />

			<Box>
				<Button variant="contained" onClick={handleApply} disabled={neighbor_list.length === 0 || policy_list.length === 0}>
					{t('Apply')}
				</Button>
			</Box>
		</Stack>
	);
}
