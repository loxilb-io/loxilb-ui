//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
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

	useEffect(() => {
		if (!lb_info || lb_info.lbAttr.length === 0) return;

		if (selected_rows.length === 1) {
			const name = lb_info.lbAttr[selected_rows[0]].serviceArguments.name;
			if (name !== rule_name) {
				set_lb_name(name);
				set_cur_tab_idx(0);
			}
		} else if (rule_name !== null) {
			set_lb_name(null);
			set_cur_tab_idx(0);
		}
	}, [lb_info, selected_rows, rule_name]);

	const {openPopUp, enableYes} = usePopUp();

	const handleDelete = useCallback(async () => {
		if (!inst || selected_rows.length !== 1) return;

		const lb_name = lb_info.lbAttr[selected_rows[0]].serviceArguments.name;

		const res = await request_delete_lb_by_name(inst, lb_name);
		if (res.status === 'success') {
			openPopUp(t('Success'), t('Deleted successfully.'), t('OK'));
			set_selected_rows([]);
			refetch();
		} else openPopUp(t('Error'), t('Failed to delete. {{error}}', {error: res.error}), t('OK'));
	}, [inst, selected_rows, lb_info, openPopUp, refetch]);

	const instanceRef = useRef<IServiceConfiguration | null>(null);
	const handleAdd = useCallback(() => {
		if (!inst) return;

		const input_form = (
			<LBInputForm
				key={Date.now()}
				onChange={data => {
					instanceRef.current = data;
					enableYes(!!data && data.serviceArguments && data.serviceArguments.name !== '');
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
					refetch();
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
				<LowerSection>
					<Stack spacing={2}>
						<SubTabs tabs={tabs} onChange={(index: number) => set_cur_tab_idx(index)} />

						{cur_tab_idx === 0 && <SettingsPanel serviceArguments={lb_info.lbAttr[selected_rows[0]].serviceArguments} />}
						{cur_tab_idx === 1 && <EndpointsPanel endpoints={lb_info.lbAttr[selected_rows[0]].endpoints} />}
						{cur_tab_idx === 2 && <SecondaryIPsPanel secondaryIPs={lb_info.lbAttr[selected_rows[0]].secondaryIPs} />}
						{cur_tab_idx === 3 && <AllowedSourcesPanel allowedSources={lb_info.lbAttr[selected_rows[0]].allowedSources} />}
						{cur_tab_idx === 4 && <ConntrackTablePanel lb_name={rule_name} />}
						{cur_tab_idx === 5 && <QoSPanel data={qos_info} lb_name={rule_name} />}
						{cur_tab_idx === 6 && <MirrorPanel data={mirror_info} lb_name={rule_name} />}
					</Stack>
				</LowerSection>
			)}
		</Fragment>
	) : null;
}
