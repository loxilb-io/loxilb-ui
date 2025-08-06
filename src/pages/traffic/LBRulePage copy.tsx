//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import { getStableHash } from 'common';
import SubTabs from 'components/element/SubTabs';
import LBInputForm from 'components/input/LBInputForm';
import LowerSection from 'components/layout/LowerSection';
import AllowedSourcesPanel from 'components/panel/AllowedSourcePanel';
import ConntrackTablePanel from 'components/panel/ConntrackTablePanel';
import EndpointsPanel from 'components/panel/EndpointPanel';
import MirrorPanel from 'components/panel/MirrorPanel';
import QoSPanel from 'components/panel/QOSPanel';
import SecondaryIPsPanel from 'components/panel/SecondaryIPPanel';
import SettingsPanel from 'components/panel/SettingPanel';
import LBTable from 'components/table/traffic/LBTable';
import {request_create_load_balancer_config, request_delete_lb_by_name} from 'connector/instance/load_balancer';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useLoadBalancerConfig, useMirrors, useQOSPolicies} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {ILBData, IServiceConfiguration} from 'types/load_balancer';
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

	const [rule_name, set_lb_name] = useState<string | null>(null);
	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const [cur_tab_idx, set_cur_tab_idx] = useState(0);

	const tabs = ['Settings', 'Endpoints', 'Secondary IPs', 'Allowed Sources', 'Conntrack', 'QoS', 'Mirror'];
	const instanceRef = useRef<(IServiceConfiguration & { isValid?: boolean; errors?: any }) | null>(null);
	const isFormValidRef = useRef(true);
	
	const {openPopUp, enableYes} = usePopUp();
	
	// Use common getStableHash for composite key
	const getHashKey = (item: any) => {
		if (!item || !item.serviceArguments) return 0;
		const str = `${item.serviceArguments.externalIP || ''}_${item.serviceArguments.port || ''}_${item.serviceArguments.protocol || ''}`;
		return getStableHash(str);
	};

	useEffect(() => {
		if (!lb_info || lb_info.lbAttr.length === 0) return;

		if (selected_rows.length === 1) {
			const selectedHash = selected_rows[0];
			const item = lb_info.lbAttr.find(item => getHashKey(item) === selectedHash);
			const name = item?.serviceArguments?.name;

			if (name !== rule_name) {
				set_lb_name(name ?? null);
				set_cur_tab_idx(0);
			}
		} else if (rule_name !== null) {
			set_lb_name(null);
			set_cur_tab_idx(0);
		}
	}, [lb_info, selected_rows, rule_name]);

	
	const handleDelete = useCallback(async () => {
		if (!inst || selected_rows.length !== 1) return;

		// const lb_name = lb_info.lbAttr[selected_rows[0]].serviceArguments.name;

		const res = await request_delete_lb_by_name(inst, rule_name ?? '');
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			setTimeout(() => {
				refetch();
			}, 1000);
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
	}, [inst, selected_rows, lb_info, openPopUp, refetch]);

	
	const handleAdd = useCallback(() => {
		if (!inst) return;

		const input_form = (
			<LBInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					enableYes(!!data && data.serviceArguments && data.serviceArguments.name !== '');
				}}
			   onValidation={valid => {
				   isFormValidRef.current = valid;
				   enableYes(
					   !!valid &&
					   !!instanceRef.current &&
					   !!instanceRef.current.serviceArguments &&
					   typeof instanceRef.current.serviceArguments.name === 'string' &&
					   instanceRef.current.serviceArguments.name !== ''
				   );
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
				// Validation check: block API if invalid
				if (!isFormValidRef.current || instanceRef.current.isValid === false) {
					openPopUp(t('Error'), t('Validation failed. Please fix errors before submitting.'), t('OK'));
					return;
				}
				const res = await request_create_load_balancer_config(inst, instanceRef.current);
				if (res.status === 'success') {
					openPopUp(t('Success'), t('Added successfully.'), t('OK'));
					setTimeout(() => {
						refetch();
					}, 1000);
				} else openPopUp(t('Error'), t('Failed to add. {{error}}', {error: res.error}), t('OK'));
			},
			true,
		);
	}, [inst, openPopUp, refetch, enableYes]);

	useEffect(() => {
		if (!servName || !lb_info || lb_info.lbAttr.length === 0) return;

		const index = lb_info.lbAttr.findIndex(attr => attr.serviceArguments.name === servName);
		if (index !== -1) {
			set_selected_rows([index]);
			set_lb_name(servName);
			set_cur_tab_idx(0);
		}
	}, [servName, lb_info]);

	return lb_info && inst ? (
		<Fragment>
			<LBTable data={lb_info} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} onAdd={handleAdd} onDelete={handleDelete} />

		   {selected_rows.length === 1 && rule_name && (
			   (() => {
				   // Find the correct lbAttr by rule_name
				   const selectedAttr = lb_info.lbAttr.find(attr => attr?.serviceArguments?.name === rule_name);
				   return (
					   <LowerSection>
						   <Stack spacing={2}>
							   <SubTabs tabs={tabs} onChange={(index: number) => set_cur_tab_idx(index)} />
							   {cur_tab_idx === 0 && <SettingsPanel serviceArguments={selectedAttr?.serviceArguments ?? {name: '', externalIP: '', inactiveTimeOut: 0, port: 0, protocol: ''}} />}
							   {cur_tab_idx === 1 && <EndpointsPanel endpoints={selectedAttr?.endpoints ?? []} />}
							   {cur_tab_idx === 2 && <SecondaryIPsPanel secondaryIPs={selectedAttr?.secondaryIPs ?? []} />}
							   {cur_tab_idx === 3 && <AllowedSourcesPanel allowedSources={selectedAttr?.allowedSources ?? []} />}
							   {cur_tab_idx === 4 && <ConntrackTablePanel lb_name={rule_name} />}
							   {cur_tab_idx === 5 && <QoSPanel data={qos_info} lb_name={rule_name} />}
							   {cur_tab_idx === 6 && <MirrorPanel data={mirror_info} lb_name={rule_name} />}
						   </Stack>
					   </LowerSection>
				   );
			   })()
		   )}
		</Fragment>
	) : null;
}
