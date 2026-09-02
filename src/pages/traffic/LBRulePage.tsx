//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
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
import {query_get_load_balancer_config_all, request_create_load_balancer_config, request_delete_lb_by_full_key, request_delete_lb_by_name, request_patch_load_balancer_config} from 'connector/instance/load_balancer';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {InstanceFlavor} from 'api/capabilities';
import {useInstanceCapabilities} from 'hooks/query/flavorHook';
import {usePopUp} from 'hooks/popupHook';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {useLoadBalancerConfig, useMirrors, useQOSPolicies} from 'hooks/query/queryHooks';
import {fromQueryRefetch} from 'hooks/query/reconcile';
import {useReconcileReporter} from 'hooks/query/reconcileReport';
import {lbRuleAppeared, lbRulesGone} from 'hooks/query/confirmPredicates';
import {t} from 'i18next';
import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {IEndpoint, ILBData, IServiceConfiguration} from 'types/load_balancer';
import {lbRuleRowId} from 'types/lb_identity';
import {IMirrorConfiguration} from 'types/mirror';
import {buildQoSRuleTarget, IPolicyConfiguration} from 'types/qos';
import {toPageState} from 'components/state/pageState';

export type LBEditStrategy = 'create' | 'merge-patch' | 'reconcile' | 'block-fullproxy';

export function selectLBEditStrategy({
	keyChanged,
	hasCompositeKey,
	mode,
	canMergePatch,
}: {
	keyChanged: boolean;
	hasCompositeKey: boolean;
	mode?: number;
	canMergePatch: boolean;
}): LBEditStrategy {
	if (keyChanged || !hasCompositeKey) return 'create';
	// The Gateway registers the tuple PATCH route for L4 rules, but explicitly
	// rejects fullproxy/L7 rules (mode 4). Those rules have no safe in-place
	// update operation: delete + create would interrupt active AI traffic.
	if (mode === 4) return 'block-fullproxy';
	return canMergePatch ? 'merge-patch' : 'reconcile';
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function LBRulePage() {
	const inst = useInstanceFromURL();
	const caps = useInstanceCapabilities();
	// Writes must fail toward the smaller OSS contract until /version positively
	// identifies IGW. The IGW-only controls are also hidden while unresolved, so
	// this fallback cannot discard an operator-visible Gateway setting.
	const effectiveFlavor: InstanceFlavor = caps.flavor ?? 'loxilb';

	const [searchParams] = useSearchParams();
	const servName = searchParams.get('servName');
	const qosTarget = searchParams.get('qosTarget');

	const lb_query = useLoadBalancerConfig(inst);
	const {data: lb_data, refetch} = lb_query;
	const lb_info: ILBData = useMemo(() => ({lbAttr: lb_data ?? []}), [lb_data]);

	const {data: data_qos} = useQOSPolicies(inst);
	const qos_info: IPolicyConfiguration = useMemo(() => ({polAttr: data_qos ?? []}), [data_qos]);
	const {data: data_mirror} = useMirrors(inst);
	const mirror_info: IMirrorConfiguration = useMemo(() => ({mirrAttr: data_mirror ?? []}), [data_mirror]);

	const [selected_rows, set_selected_rows] = useState<(string | number)[]>([]); // holds opaque/full rule identities
	const [cur_tab_idx, set_cur_tab_idx] = useState(0);

	// Appended at the END: existing tab indices (and the E2E tab-name queries
	// that depend on them) stay stable.
	const tabs = ['Settings', 'Endpoints', 'Secondary IPs', 'Allowed Sources', 'Conntrack', 'QoS', 'Mirror', 'AI Gateway'];

	// Resolve selected items by matching stable hash ids against the raw data
	const selectedItems = useMemo(
		() =>
			selected_rows
				.map(h => lb_info.lbAttr.find(a => lbRuleRowId(a) === h))
				.filter((x): x is IServiceConfiguration => x != null),
		[selected_rows, lb_info],
	);
	const selectedItem: IServiceConfiguration | null = selectedItems.length === 1 ? selectedItems[0] : null;
	const rule_name = selectedItem ? selectedItem.serviceArguments.name || 'unnamed' : null;
	const lb_target = selectedItem ? buildQoSRuleTarget(selectedItem.serviceArguments) : null;

	// Selection handler: store the stable hash ids directly
	const handleSelectionChange = (identities: (string | number)[]) => set_selected_rows(identities);

	// Reset the detail tab whenever the selection changes
	useEffect(() => {
		set_cur_tab_idx(0);
	}, [selected_rows]);

	const {openPopUp, enableYes} = usePopUp();
	const {errorPopup, showAddError, showUpdateError, showDeleteError, closeErrorPopup} = useErrorPopup();
	const {report, reconcile} = useReconcileReporter();

	const handleDelete = useCallback(async () => {
		if (!inst || selectedItems.length === 0) return;

		// Delete multiple selected load balancers
		const deletePromises = selectedItems.map(async (selectedLB) => {
			// Name-delete works for every mode; the tuple endpoints 404 on
			// fullproxy/L7 rules (gateway keys those differently).
			if (selectedLB.serviceArguments.name) {
				return request_delete_lb_by_name(inst, selectedLB.serviceArguments.name);
			}

			return request_delete_lb_by_full_key(inst, selectedLB);
		});

		const results = await Promise.all(deletePromises);
		// {result:"fail"} envelopes now map to failed — a dataplane-rejected
		// delete can no longer be counted as succeeded.
		const failures = results.filter(res => res.status !== 'confirmed');

		if (failures.length === 0) {
			set_selected_rows([]);
			// Confirmation is "the rules are gone from the list", not "the DELETE
			// was accepted" — a dataplane that rejects after acceptance leaves
			// the rows in place, which the operator must be told about.
			await report({refetch: fromQueryRefetch(refetch), confirm: lbRulesGone(selectedItems)}, t('Deleted {{count}} item(s) successfully.', {count: selectedItems.length}));
		} else if (failures.length < results.length) {
			// Partial success: the error popup already carries the outcome, so
			// reconcile silently — but only against the rules that actually
			// went (Promise.all preserves order, so results[i] is selectedItems[i]).
			showDeleteError('load balancer rule(s)', t('{{succeeded}} succeeded, {{failed}} failed. {{error}}', {succeeded: results.length - failures.length, failed: failures.length, error: t(failures[0].localeKey)}));
			const deleted = selectedItems.filter((_, i) => results[i].status === 'confirmed');
			await reconcile({refetch: fromQueryRefetch(refetch), confirm: lbRulesGone(deleted)});
		} else {
			// All failed
			showDeleteError('load balancer rule(s)', t(failures[0].localeKey));
		}
	}, [inst, selectedItems, showDeleteError, refetch, report, reconcile]);

	const instanceRef = useRef<IServiceConfiguration | null>(null);
	const handleAdd = useCallback(() => {
		if (!inst || !caps.resolved) return;

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

				const submitted = instanceRef.current;
				const res = await request_create_load_balancer_config(inst, submitted, effectiveFlavor);
				if (res.status === 'confirmed') {
					await report({refetch: fromQueryRefetch(refetch), confirm: lbRuleAppeared(submitted)}, t('Added successfully.'));
				} else {
					// Localized mapped message; raw prose stays in diagnostics.
					showAddError('load balancer rule', t(res.localeKey));
				}
			},
			true,
		);
	// Flavor resolves asynchronously. Rebuild this callback when it changes so
	// an IGW dialog cannot submit through the initial OSS-safe projection and
	// silently strip the Gateway-only fields the operator just entered.
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	}, [inst, caps.resolved, effectiveFlavor, showAddError, refetch, enableYes]);

	// Update handler for LB rules
	const updateFormRef = useRef<(IServiceConfiguration & {isValid?: boolean; errors?: any}) | null>(null);
	const handleUpdate = useCallback(() => {
		if (!inst || !caps.resolved || !selectedItem) return;

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
				const editStrategy = selectLBEditStrategy({
					keyChanged,
					hasCompositeKey: Boolean(osa.externalIP && osa.port != null && osa.protocol),
					mode: osa.mode,
					canMergePatch,
				});

				let res;
				if (editStrategy === 'create') {
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
						const FORM_DEFAULTS: Record<string, unknown> = {
							probeTimeout: 1800,
							path_match_mode: 'disabled',
							backend_protocol: 'http1',
							chwbl_prefix_hash_level: 1,
						};
						const isFormDefault = (key: string, value: unknown): boolean => {
							if (value === FORM_DEFAULTS[key]) return true;
							// The mTLS dropdown materializes the Swagger default on mount,
							// even when the persisted rule omitted the whole object.
							if (key === 'mtls_frontend' && value && typeof value === 'object') {
								const mtls = value as Record<string, unknown>;
								return mtls.client_cert_mode === 'disabled' && Object.entries(mtls).every(([field, nested]) =>
									field === 'client_cert_mode' || isZero(nested),
								);
							}
							return false;
						};
						const saPatch: Record<string, any> = {};
						Object.entries(sa).forEach(([k, v]) => {
							if (IMMUTABLE.has(k)) return;
							const prev = (osa as any)[k];
							if (prev === undefined && (isZero(v) || isFormDefault(k, v))) return;
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

						if (editStrategy === 'block-fullproxy') {
							const changedFields = [
								...Object.keys(saPatch).map(field => `serviceArguments.${field}`),
								...(endpointsChanged ? ['endpoints'] : []),
								...(secondaryChanged ? ['secondaryIPs'] : []),
								...(allowedChanged ? ['allowedSources'] : []),
							];
							showUpdateError(
								'load balancer rule',
								t(
									'Fullproxy (mode 4) rules cannot be updated in place. Create and verify a replacement rule with a different VIP, port, or protocol, then remove the original rule. Changed fields: {{fields}}.',
									{fields: changedFields.join(', ')},
								),
							);
						return;
					}

					if (editStrategy === 'merge-patch') {
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
								: await request_delete_lb_by_full_key(inst, selectedLB);
							if (del.status !== 'confirmed') {
								showUpdateError('load balancer rule', t(del.localeKey));
								return;
							}
						}
						res = await request_create_load_balancer_config(inst, upsert, effectiveFlavor);
					}
				}
				if (res.status === 'confirmed') {
					// The delete+re-create strategy can move the rule's key, so
					// confirm against the EDITED identity, not the original row.
					await report({refetch: fromQueryRefetch(refetch), confirm: lbRuleAppeared(serviceConfig)}, t('Load balancer rule updated successfully.'));
				} else {
					// Localized mapped message; raw prose stays in diagnostics.
					showUpdateError('load balancer rule', t(res.localeKey));
				}
			},
			true,
		);
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	}, [inst, caps, selectedItem, showUpdateError, refetch, enableYes]);

	const handleRefresh = () => {
		set_selected_rows([]);
		refetch();
	};

	useEffect(() => {
		if ((!servName && !qosTarget) || !lb_info || lb_info.lbAttr.length === 0) return;
		const match = lb_info.lbAttr.find(attr =>
			servName
				? attr.serviceArguments.name === servName
				: buildQoSRuleTarget(attr.serviceArguments) === qosTarget,
		);
		if (match) {
			set_selected_rows([lbRuleRowId(match)]);
			set_cur_tab_idx(0);
		}
	}, [servName, qosTarget, lb_info]);

	return lb_info && inst ? (
		<Fragment>
			<LBTable
				data={lb_info}
				selected_rows={selected_rows}
				onChangeSelectedRows={handleSelectionChange}
				// Do not open a mutation dialog until /version has selected the exact
				// OSS or IGW write contract. A popup stores its submit callback at open
				// time; opening during the unresolved OSS-safe fallback can otherwise
				// strip IGW fields even if the controls appear a moment later.
				onAdd={caps.resolved ? handleAdd : undefined}
				onDelete={handleDelete}
				onUpdate={caps.resolved ? handleUpdate : undefined}
					onRefresh={handleRefresh}
					state={toPageState(lb_query, {op: 'lb.list'})}
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
							{cur_tab_idx === 5 && lb_target && <QoSPanel data={qos_info} lb_target={lb_target} />}
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
