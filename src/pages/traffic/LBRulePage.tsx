//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import { getStableHash } from 'common';
import SubTabs from 'components/element/SubTabs';
import LBInputForm from 'components/input/LBInputForm';
import LowerSection from 'components/layout/LowerSection';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import AllowedSourcesPanel from 'components/panel/AllowedSourcePanel';
import ConntrackTablePanel from 'components/panel/ConntrackTablePanel';
import EndpointsPanel from 'components/panel/EndpointPanel';
import MirrorPanel from 'components/panel/MirrorPanel';
import QoSPanel from 'components/panel/QOSPanel';
import SecondaryIPsPanel from 'components/panel/SecondaryIPPanel';
import SettingsPanel from 'components/panel/SettingPanel';
import LBTable from 'components/table/traffic/LBTable';
import {request_create_load_balancer_config, request_delete_lb_by_ip_port_proto, request_delete_lb_by_ip_portrange_proto} from 'connector/instance/load_balancer';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {useLoadBalancerConfig, useMirrors, useQOSPolicies} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {IEndpoint, ILBData, IServiceConfiguration} from 'types/load_balancer';
import {IMirrorConfiguration} from 'types/mirror';
import {IPolicyConfiguration} from 'types/qos';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function LBRulePage() {
	const inst = useInstanceFromURL();

	const [searchParams] = useSearchParams();
	const servName = searchParams.get('servName');

	const {data: lb_data, refetch} = useLoadBalancerConfig(inst);
	const lb_info: ILBData = useMemo(() => ({lbAttr: lb_data ?? []}), [lb_data]);

	const {data: data_qos} = useQOSPolicies(inst);
	const qos_info: IPolicyConfiguration = useMemo(() => ({polAttr: data_qos ?? []}), [data_qos]);
	const {data: data_mirror} = useMirrors(inst);
	const mirror_info: IMirrorConfiguration = useMemo(() => ({mirrAttr: data_mirror ?? []}), [data_mirror]);

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const [selected_key, set_selected_key] = useState<string | null>(null);
	const [rule_name, set_lb_name] = useState<string | null>(null);
	const [cur_tab_idx, set_cur_tab_idx] = useState(0);

	const tabs = ['Settings', 'Endpoints', 'Secondary IPs', 'Allowed Sources', 'Conntrack', 'QoS', 'Mirror'];

	// Hash function for LB rule
	const getHashKey = (item: any) => {
		const str = `${item.serviceArguments.externalIP || ''}_${item.serviceArguments.port || ''}_${item.serviceArguments.protocol || ''}`;
		return getStableHash(str);
	};

	// Sorted LB rules
	const sortedAttr = lb_info.lbAttr ? [...lb_info.lbAttr].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];

	// Find selected index in sortedAttr
	let selected_index = -1;
	if (selected_rows.length === 1 && lb_info.lbAttr) {
		const original = lb_info.lbAttr[selected_rows[0]];
		selected_index = sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
	} else if (selected_key) {
		selected_index = sortedAttr.findIndex(attr => getHashKey(attr).toString() === selected_key);
	}

	// Selection handler: map sorted index back to original
	const handleSelectionChange = (indices: number[]) => {
		if (indices.length === 1 && lb_info.lbAttr) {
			const sortedItem = sortedAttr[indices[0]];
			const originalIndex = lb_info.lbAttr.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
			set_selected_rows(originalIndex !== -1 ? [originalIndex] : []);
		} else {
			set_selected_rows([]);
		}
	};

	useEffect(() => {
		if (!lb_info || lb_info.lbAttr.length === 0) return;
		if (selected_rows.length === 1) {
			const item = lb_info.lbAttr[selected_rows[0]];
			set_selected_key(getHashKey(item).toString());
			set_lb_name(item.serviceArguments.name || 'unnamed');
			set_cur_tab_idx(0);
		} else {
			set_selected_key(null);
			set_lb_name(null);
			set_cur_tab_idx(0);
		}
	}, [lb_info, selected_rows]);

	const {openPopUp, enableYes} = usePopUp();
	const {errorPopup, showAddError, showUpdateError, showDeleteError, closeErrorPopup} = useErrorPopup();

	const handleDelete = useCallback(async () => {
		if (!inst || selected_rows.length !== 1) return;

		const selectedLB = lb_info.lbAttr[selected_rows[0]];
		const externalIP = selectedLB.serviceArguments.externalIP;
		const port = selectedLB.serviceArguments.port;
		const protocol = selectedLB.serviceArguments.protocol;

		// if selectedLB.serviceArguments.portMax exists and is greater than port, use that API
		let res;
		if (selectedLB.serviceArguments.portMax && selectedLB.serviceArguments.portMax > port) {
			res = await request_delete_lb_by_ip_portrange_proto(inst, externalIP, port, selectedLB.serviceArguments.portMax, protocol);
		} else {
			res = await request_delete_lb_by_ip_port_proto(inst, externalIP, port, protocol);
		}
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			setTimeout(() => {
				refetch();
			}, 1000);
		} else {
			// Show formatted error popup
			showDeleteError('load balancer rule', res.error);
		}
	}, [inst, selected_rows, lb_info, showDeleteError, refetch]);

	const instanceRef = useRef<IServiceConfiguration | null>(null);
	const handleAdd = useCallback(() => {
		if (!inst) return;

		const input_form = (
			<LBInputForm
				key={Date.now()}
				onChange={data  => {
					instanceRef.current = data;;
					enableYes(data.isValid); // Only enable if form is valid
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			t('Create'),
			t('Cancel'),
			async () => {
				if (!instanceRef.current) return;

				const res = await request_create_load_balancer_config(inst, instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} else {
					// Show formatted error popup
					showAddError('load balancer rule', res.error);
				}
			},
			true,
		);
	}, [inst, showAddError, refetch, enableYes]);

	// Update handler for LB rules
	const updateFormRef = useRef<(IServiceConfiguration & {isValid?: boolean; errors?: any}) | null>(null);
	const handleUpdate = useCallback(() => {
		if (!inst || selected_rows.length !== 1) return;

		const selectedLB = lb_info.lbAttr[selected_rows[0]];
		
		// Convert selected LB rule to format expected by LBInputForm
		// Exclude fields that are "Not required in Edit" (managed, state, counter)
		const {managed, security, ...editableServiceArguments} = selectedLB.serviceArguments;
		const editableEndpoints = selectedLB.endpoints.map(endpoint => {
			const {state, counter, ...editableEndpoint} = endpoint;
			return editableEndpoint;
		});
		
		const formData: Partial<IServiceConfiguration> = {
			serviceArguments: editableServiceArguments,
			secondaryIPs: selectedLB.secondaryIPs,
			allowedSources: selectedLB.allowedSources,
			endpoints: editableEndpoints as IEndpoint[],
		};
		
		const update_form = (
			<LBInputForm
				key={Date.now()}
				initialData={formData}
				isEdit={true}
				onChange={data => {
					updateFormRef.current = data;
					enableYes(data.isValid);
				}}
			/>
		);

		openPopUp(
			'',
			update_form,
			t('Update'),
			t('Cancel'),
			async () => {
				if (!updateFormRef.current) return;

				// Extract only the service configuration data, excluding validation properties
				const {isValid, errors, ...serviceConfig} = updateFormRef.current as IServiceConfiguration & {isValid?: boolean; errors?: any};
				
				// Use POST API with same function as create (following EndpointPage pattern)
				const res = await request_create_load_balancer_config(inst, serviceConfig);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Load balancer rule updated successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} else {
					// Show formatted error popup
					showUpdateError('load balancer rule', res.error);
				}
			},
			true,
		);
	}, [inst, selected_rows, lb_info, showUpdateError, refetch, enableYes]);

	useEffect(() => {
		if (!servName || !lb_info || lb_info.lbAttr.length === 0) return;
		const index = lb_info.lbAttr.findIndex(attr => attr.serviceArguments.name === servName);
		if (index !== -1) {
			set_selected_rows([index]);
			set_selected_key(getHashKey(lb_info.lbAttr[index]).toString());
			set_lb_name(servName);
			set_cur_tab_idx(0);
		}
	}, [servName, lb_info]);

	return lb_info && inst ? (
		<Fragment>
			<LBTable
				data={{lbAttr: sortedAttr}}
				selected_rows={selected_index !== -1 ? [selected_index] : []}
				onChangeSelectedRows={handleSelectionChange}
				onAdd={handleAdd}
				onDelete={handleDelete}
				onUpdate={handleUpdate}
				onRefresh={refetch}
			/>

			{selected_index !== -1 && (
				<LowerSection>
					<Stack spacing={2}>
						<SubTabs tabs={tabs} onChange={(index: number) => set_cur_tab_idx(index)} />

						{cur_tab_idx === 0 && <SettingsPanel serviceArguments={sortedAttr[selected_index].serviceArguments} />}
						{cur_tab_idx === 1 && <EndpointsPanel endpoints={sortedAttr[selected_index].endpoints} />}
						{cur_tab_idx === 2 && <SecondaryIPsPanel secondaryIPs={sortedAttr[selected_index].secondaryIPs} />}
						{cur_tab_idx === 3 && <AllowedSourcesPanel allowedSources={sortedAttr[selected_index].allowedSources} />}
						{cur_tab_idx === 4 && rule_name && <ConntrackTablePanel lb_name={rule_name} />}
						{cur_tab_idx === 5 && rule_name && <QoSPanel data={qos_info} lb_name={rule_name} />}
						{cur_tab_idx === 6 && rule_name && <MirrorPanel data={mirror_info} lb_name={rule_name} />}
					</Stack>
				</LowerSection>
			)}

			{/* Error Popup */}
			<ErrorPopUp
				isOpen={errorPopup.isOpen}
				onClose={closeErrorPopup}
				title={errorPopup.title}
				mainMessage={errorPopup.mainMessage}
				errorData={errorPopup.errorData}
				buttonText={t('OK')}
			/>
		</Fragment>
	) : null;
}
