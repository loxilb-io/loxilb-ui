//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import { getStableHash } from 'common';
import SubTabs from 'components/element/SubTabs';
import LBInputForm from 'components/input/LBInputForm';
import LowerSection from 'components/layout/LowerSection';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import AIGatewayPanel from 'components/panel/AIGatewayPanel';
import AllowedSourcesPanel from 'components/panel/AllowedSourcePanel';
import ConntrackTablePanel from 'components/panel/ConntrackTablePanel';
import EndpointsPanel from 'components/panel/EndpointPanel';
import MirrorPanel from 'components/panel/MirrorPanel';
import QoSPanel from 'components/panel/QOSPanel';
import SecondaryIPsPanel from 'components/panel/SecondaryIPPanel';
import SettingsPanel from 'components/panel/SettingPanel';
import LBTable from 'components/table/traffic/LBTable';
import {query_get_load_balancer_config_all, request_create_load_balancer_config, request_delete_lb_by_ip_port_proto, request_delete_lb_by_ip_portrange_proto, request_delete_lb_by_name, request_patch_load_balancer_config} from 'connector/instance/load_balancer';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {InstanceFlavor} from 'api/capabilities';
import {useInstanceCapabilities} from 'hooks/query/flavorHook';
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
	const caps = useInstanceCapabilities();
	// Same fallback the capability helpers use while the /version probe is in
	// flight: assume the gateway, i.e. strip nothing. Guessing "loxilb" instead
	// would silently drop fields a gateway legitimately accepts.
	const effectiveFlavor: InstanceFlavor = caps.flavor ?? 'inference-gateway';

	const [searchParams] = useSearchParams();
	const servName = searchParams.get('servName');

	const {data: lb_data, isError, refetch} = useLoadBalancerConfig(inst);
	const lb_info: ILBData = useMemo(() => ({lbAttr: lb_data ?? []}), [lb_data]);

	const {data: data_qos} = useQOSPolicies(inst);
	const qos_info: IPolicyConfiguration = useMemo(() => ({polAttr: data_qos ?? []}), [data_qos]);
	const {data: data_mirror} = useMirrors(inst);
	const mirror_info: IMirrorConfiguration = useMemo(() => ({mirrAttr: data_mirror ?? []}), [data_mirror]);

	const [selected_rows, set_selected_rows] = useState<number[]>([]); // holds stable hash ids
	const [cur_tab_idx, set_cur_tab_idx] = useState(0);

	// Appended at the END: existing tab indices (and the E2E tab-name queries
	// that depend on them) stay stable.
	const tabs = ['Settings', 'Endpoints', 'Secondary IPs', 'Allowed Sources', 'Conntrack', 'QoS', 'Mirror', 'AI Gateway'];

	// Hash function for LB rule — MUST match LBTable's getHashKey exactly
	const getHashKey = (item: IServiceConfiguration) => {
		const str = `${item.serviceArguments.externalIP || ''}_${item.serviceArguments.port || ''}_${item.serviceArguments.protocol || ''}`;
		return getStableHash(str);
	};

	// Resolve selected items by matching stable hash ids against the raw data
	const selectedItems = useMemo(
		() =>
			selected_rows
				.map(h => lb_info.lbAttr.find(a => getHashKey(a) === h))
				.filter((x): x is IServiceConfiguration => x != null),
		[selected_rows, lb_info],
	);
	const selectedItem: IServiceConfiguration | null = selectedItems.length === 1 ? selectedItems[0] : null;
	const rule_name = selectedItem ? selectedItem.serviceArguments.name || 'unnamed' : null;

	// Selection handler: store the stable hash ids directly
	const handleSelectionChange = (hashes: number[]) => set_selected_rows(hashes);

	// Reset the detail tab whenever the selection changes
	useEffect(() => {
		set_cur_tab_idx(0);
	}, [selected_rows]);

	const {openPopUp, enableYes} = usePopUp();
	const {errorPopup, showAddError, showUpdateError, showDeleteError, closeErrorPopup} = useErrorPopup();

	const handleDelete = useCallback(async () => {
		if (!inst || selectedItems.length === 0) return;

		// Delete multiple selected load balancers
		const deletePromises = selectedItems.map(async (selectedLB) => {
			const externalIP = selectedLB.serviceArguments.externalIP;
			const port = selectedLB.serviceArguments.port;
			const protocol = selectedLB.serviceArguments.protocol;

			// Name-delete works for every mode; the tuple endpoints 404 on
			// fullproxy/L7 rules (gateway keys those differently).
			if (selectedLB.serviceArguments.name) {
				return request_delete_lb_by_name(inst, selectedLB.serviceArguments.name);
			}

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
			openPopUp(t('Success'), t('Deleted {{count}} item(s) successfully.', {count: selectedItems.length}), t('OK'));
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
	}, [inst, selectedItems, showDeleteError, refetch, openPopUp]);

	const instanceRef = useRef<IServiceConfiguration | null>(null);
	const handleAdd = useCallback(() => {
		if (!inst) return;

		const input_form = (
			<LBInputForm
				key={Date.now()}
				onChange={data => {
					// Keep client-side validation state (isValid/errors) out of the
					// POST payload — the gateway schema has no such keys.
					const {isValid, errors, ...serviceConfig} = data;
					instanceRef.current = serviceConfig;
					enableYes(isValid); // Only enable if form is valid
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

				const res = await request_create_load_balancer_config(inst, instanceRef.current, effectiveFlavor);
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
		if (!inst || !selectedItem) return;

		const selectedLB = selectedItem;

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

				// PATCH on the per-VIP path is gateway-only; upstream loxilb
				// answers 405 (capability map, gatewayOnlyMethods).
				const canMergePatch = caps.hasMethod('patch', '/config/loadbalancer/externalipaddress/{ip_address}/port/{port}/protocol/{proto}');

				let res;
				if (keyChanged || !osa.externalIP || osa.port == null || !osa.protocol) {
					// The VIP/port/proto composite key is immutable under PATCH —
					// changing it means a different rule, so fall back to re-POST.
					res = await request_create_load_balancer_config(inst, serviceConfig, effectiveFlavor);
				} else {
					// Change detection shared by both update strategies. Immutable
					// fields are rejected by the gateway's PATCH with 400.
					const IMMUTABLE = new Set(['externalIP', 'port', 'protocol', 'mode', 'security', 'egress', 'oper', 'managed']);
					// Backends omit zero-value fields on read-back while the form
					// emits them as 0/''/false — a form default over an absent
					// field is NOT a change (it would spuriously widen the gateway
					// patch and, on loxilb, escalate endpoint-only edits into a
					// delete + re-create).
					const isZero = (v: any) => v === undefined || v === null || v === 0 || v === '' || v === false;
					// LBInputForm's one non-zero injected default: over an absent
					// read-back field it is form scaffolding, not an operator edit.
					const FORM_DEFAULTS: Record<string, unknown> = {probeTimeout: 1800};
					const saPatch: Record<string, any> = {};
					Object.entries(sa).forEach(([k, v]) => {
						if (IMMUTABLE.has(k)) return;
						const prev = (osa as any)[k];
						if (prev === undefined && (isZero(v) || v === FORM_DEFAULTS[k])) return;
						if (JSON.stringify(v) !== JSON.stringify(prev)) saPatch[k] = v;
					});
					const endpointsChanged = JSON.stringify(serviceConfig.endpoints) !== JSON.stringify(editableEndpoints);
					// Read-back reports empty lists as null; the form emits [] —
					// normalize both sides so that difference is not a "change".
					const listChanged = (a: unknown, b: unknown) => JSON.stringify(a ?? []) !== JSON.stringify(b ?? []);
					const secondaryChanged = listChanged(serviceConfig.secondaryIPs, selectedLB.secondaryIPs);
					const allowedChanged = listChanged(serviceConfig.allowedSources, selectedLB.allowedSources);

					if (Object.keys(saPatch).length === 0 && !endpointsChanged && !secondaryChanged && !allowedChanged) {
						openPopUp(t('Success'), t('No changes to apply.'), t('OK'));
						return;
					}

					if (canMergePatch) {
						// RFC 7386 merge-patch: send only changed, mutable fields.
						const patch: Partial<IServiceConfiguration> = {};
						if (Object.keys(saPatch).length > 0) patch.serviceArguments = saPatch as any;
						if (endpointsChanged) patch.endpoints = serviceConfig.endpoints;
						if (secondaryChanged) patch.secondaryIPs = serviceConfig.secondaryIPs;
						if (allowedChanged) patch.allowedSources = serviceConfig.allowedSources;
						res = await request_patch_load_balancer_config(inst, osa.externalIP, osa.port, osa.protocol, patch);
					} else {
						// Upstream loxilb has no in-place update for serviceArguments:
						// a re-POST reconciles ONLY the endpoint set and 409s
						// ("lbrule-exists") on any other change — verified live
						// 2026-08-13. Endpoint-only edits use that native reconcile;
						// anything else must delete + re-create the rule.
						//
						// The re-POST carries the WHOLE rule, and the dialog may have
						// been built from a cached table row (the query cache survives
						// reloads) — so re-read the rule's current state and lay only
						// the operator's changes on top. Found live: submitting the
						// form body as-is reverted a freshly-set inactiveTimeOut.
						const freshAll = await query_get_load_balancer_config_all(inst);
						const fresh = freshAll.find(
							lb => lb.serviceArguments?.externalIP === osa.externalIP && lb.serviceArguments?.port === osa.port && lb.serviceArguments?.protocol === osa.protocol,
						);
						const base = fresh ?? selectedLB;
						const stripReadFields = (eps: any[]) => (eps ?? []).map(({state, counter, ...ep}: any) => ep);
						const upsert: IServiceConfiguration = {
							serviceArguments: {...base.serviceArguments, ...saPatch} as any,
							endpoints: (endpointsChanged ? serviceConfig.endpoints : stripReadFields(base.endpoints as any[])) as IEndpoint[],
							secondaryIPs: (secondaryChanged ? serviceConfig.secondaryIPs : base.secondaryIPs) ?? [],
							allowedSources: (allowedChanged ? serviceConfig.allowedSources : base.allowedSources) ?? [],
						};
						if (Object.keys(saPatch).length > 0 || secondaryChanged || allowedChanged) {
							const del = osa.name
								? await request_delete_lb_by_name(inst, osa.name)
								: await request_delete_lb_by_ip_port_proto(inst, osa.externalIP, osa.port, osa.protocol);
							if (del.status !== 'success') {
								showUpdateError('load balancer rule', del.error);
								return;
							}
						}
						res = await request_create_load_balancer_config(inst, upsert, effectiveFlavor);
					}
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
	}, [inst, caps, selectedItem, showUpdateError, refetch, enableYes]);

	const handleRefresh = () => {
		set_selected_rows([]);
		refetch();
	};

	useEffect(() => {
		if (!servName || !lb_info || lb_info.lbAttr.length === 0) return;
		const match = lb_info.lbAttr.find(attr => attr.serviceArguments.name === servName);
		if (match) {
			set_selected_rows([getHashKey(match)]);
			set_cur_tab_idx(0);
		}
	}, [servName, lb_info]);

	return lb_info && inst ? (
		<Fragment>
			<LBTable
				data={lb_info}
				selected_rows={selected_rows}
				onChangeSelectedRows={handleSelectionChange}
				onAdd={handleAdd}
				onDelete={handleDelete}
				onUpdate={handleUpdate}
					onRefresh={handleRefresh}
					error={isError}
			/>

			{selectedItem && (
				<LowerSection>
					<Stack spacing={2}>
						<SubTabs tabs={tabs} onChange={(index: number) => set_cur_tab_idx(index)} />

						{cur_tab_idx === 0 && <SettingsPanel serviceArguments={selectedItem.serviceArguments} />}
						{cur_tab_idx === 1 && <EndpointsPanel endpoints={selectedItem.endpoints} />}
						{cur_tab_idx === 2 && <SecondaryIPsPanel secondaryIPs={selectedItem.secondaryIPs} />}
						{cur_tab_idx === 3 && <AllowedSourcesPanel allowedSources={selectedItem.allowedSources} />}
						{cur_tab_idx === 4 && rule_name && <ConntrackTablePanel lb_name={rule_name} />}
						{cur_tab_idx === 5 && rule_name && <QoSPanel data={qos_info} lb_name={rule_name} />}
						{cur_tab_idx === 6 && rule_name && <MirrorPanel data={mirror_info} lb_name={rule_name} />}
						{cur_tab_idx === 7 && <AIGatewayPanel serviceArguments={selectedItem.serviceArguments} />}
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
