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
import {request_create_load_balancer_config, request_delete_lb_by_ip_port_proto, request_delete_lb_by_ip_portrange_proto, request_patch_load_balancer_config} from 'connector/instance/load_balancer';
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

	// Map selected original indices to sorted indices for display
	const selectedSortedIndices = useMemo(() => {
		if (!lb_info.lbAttr || selected_rows.length === 0) return [];
		
		return selected_rows
			.map(originalIdx => {
				const original = lb_info.lbAttr[originalIdx];
				return sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
			})
			.filter(idx => idx !== -1);
	}, [selected_rows, lb_info.lbAttr, sortedAttr]);

	// Find single selected index for detail panel (backward compatibility with selected_key)
	const selected_index = selectedSortedIndices.length === 1 ? selectedSortedIndices[0] : 
		(selected_key ? sortedAttr.findIndex(attr => getHashKey(attr).toString() === selected_key) : -1);

	// Selection handler: map sorted indices back to original indices
	const handleSelectionChange = (indices: number[]) => {
		if (!lb_info.lbAttr) {
			set_selected_rows([]);
			return;
		}

		if (indices.length === 0) {
			set_selected_rows([]);
			return;
		}

		// Map each sorted index back to original index
		const originalIndices = indices
			.map(sortedIdx => {
				const sortedItem = sortedAttr[sortedIdx];
				return lb_info.lbAttr.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
			})
			.filter(idx => idx !== -1);

		set_selected_rows(originalIndices);
	};

	useEffect(() => {
		if (!lb_info || lb_info.lbAttr.length === 0) return;
		// Only show details panel when exactly one row is selected
		if (selected_rows.length === 1) {
			const item = lb_info.lbAttr[selected_rows[0]];
			set_selected_key(getHashKey(item).toString());
			set_lb_name(item.serviceArguments.name || 'unnamed');
			set_cur_tab_idx(0);
		} else {
			// Clear details when multiple or no rows selected
			set_selected_key(null);
			set_lb_name(null);
			set_cur_tab_idx(0);
		}
	}, [lb_info, selected_rows]);

	const {openPopUp, enableYes} = usePopUp();
	const {errorPopup, showAddError, showUpdateError, showDeleteError, closeErrorPopup} = useErrorPopup();

	const handleDelete = useCallback(async () => {
		if (!inst || selected_rows.length === 0) return;

		// Delete multiple selected load balancers
		const deletePromises = selected_rows.map(async (rowIndex) => {
			const selectedLB = lb_info.lbAttr[rowIndex];
			const externalIP = selectedLB.serviceArguments.externalIP;
			const port = selectedLB.serviceArguments.port;
			const protocol = selectedLB.serviceArguments.protocol;

			// if selectedLB.serviceArguments.portMax exists and is greater than port, use that API
			if (selectedLB.serviceArguments.portMax && selectedLB.serviceArguments.portMax > port) {
				return request_delete_lb_by_ip_portrange_proto(inst, externalIP, port, selectedLB.serviceArguments.portMax, protocol);
			} else {
				return request_delete_lb_by_ip_port_proto(inst, externalIP, port, protocol);
			}
		});

		const results = await Promise.all(deletePromises);
		const failures = results.filter(res => res.status === 'error');

		if (failures.length === 0) {
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: selected_rows.length}), t('OK'));
			set_selected_rows([]);
			setTimeout(() => {
				refetch();
			}, 1000);
		} else if (failures.length < results.length) {
			// Partial success
			showDeleteError('load balancer rule(s)', `${results.length - failures.length} succeeded, ${failures.length} failed: ${failures[0].error}`);
			setTimeout(() => {
				refetch();
			}, 1000);
		} else {
			// All failed
			showDeleteError('load balancer rule(s)', failures[0].error);
		}
	}, [inst, selected_rows, lb_info, showDeleteError, refetch, openPopUp]);

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

				const osa = selectedLB.serviceArguments;
				const sa = serviceConfig.serviceArguments ?? ({} as any);
				const keyChanged = sa.externalIP !== osa.externalIP || sa.port !== osa.port || sa.protocol !== osa.protocol;

				let res;
				if (keyChanged || !osa.externalIP || osa.port == null || !osa.protocol) {
					// The VIP/port/proto composite key is immutable under PATCH —
					// changing it means a different rule, so fall back to re-POST.
					res = await request_create_load_balancer_config(inst, serviceConfig);
				} else {
					// RFC 7386 merge-patch: send only changed, mutable fields.
					// Immutable fields are rejected by the gateway with 400.
					const IMMUTABLE = new Set(['externalIP', 'port', 'protocol', 'mode', 'security', 'egress', 'oper', 'managed']);
					const saPatch: Record<string, any> = {};
					Object.entries(sa).forEach(([k, v]) => {
						if (IMMUTABLE.has(k)) return;
						if (JSON.stringify(v) !== JSON.stringify((osa as any)[k])) saPatch[k] = v;
					});
					const patch: Partial<IServiceConfiguration> = {};
					if (Object.keys(saPatch).length > 0) patch.serviceArguments = saPatch as any;
					if (JSON.stringify(serviceConfig.endpoints) !== JSON.stringify(editableEndpoints)) patch.endpoints = serviceConfig.endpoints;
					if (JSON.stringify(serviceConfig.secondaryIPs) !== JSON.stringify(selectedLB.secondaryIPs)) patch.secondaryIPs = serviceConfig.secondaryIPs;
					if (JSON.stringify(serviceConfig.allowedSources) !== JSON.stringify(selectedLB.allowedSources)) patch.allowedSources = serviceConfig.allowedSources;

					if (Object.keys(patch).length === 0) {
						openPopUp(t('Success'), t('No changes to apply.'), t('OK'));
						return;
					}
					res = await request_patch_load_balancer_config(inst, osa.externalIP, osa.port, osa.protocol, patch);
				}
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

	const handleRefresh = () => {
		set_selected_rows([]);
		set_selected_key(null);
		set_lb_name(null);
		refetch();
	};

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
				selected_rows={selectedSortedIndices}
				onChangeSelectedRows={handleSelectionChange}
				onAdd={handleAdd}
				onDelete={handleDelete}
				onUpdate={handleUpdate}
					onRefresh={handleRefresh}
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
