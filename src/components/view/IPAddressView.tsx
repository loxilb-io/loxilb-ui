//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box} from '@mui/material';
import FirewallTable from 'components/table/traffic/FirewallTable';
import MirrorTable from 'components/table/traffic/MirrorTable';
import QoSTable from 'components/table/traffic/QoSTable';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useFirewallRules, useMirrors, useQOSPolicies} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {useEffect, useMemo, useState} from 'react';
import {IFirewallRules} from 'types/firewall';
import {IMirrorConfiguration} from 'types/mirror';
import {IPolicyConfiguration} from 'types/qos';
import TabView from './TabView';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function IPAddressView(props: {device_name: string}) {
	const {device_name} = props;

	const inst = useInstanceFromURL();
	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const [cur_tab_idx, set_cur_tab_idx] = useState(0);
	const tabs = [t('Firewall'), t('Mirror'), t('QoS')];
	const title = t('{{name}} Details', {name: device_name});

	const {data: fw_data} = useFirewallRules(inst);
	const fw_data_filtered: IFirewallRules = useMemo(() => ({fwAttr: fw_data?.filter(item => item.ruleArguments.portName === device_name) ?? []}), [fw_data, device_name]);

	const {data: qos_data} = useQOSPolicies(inst);
	const qos_data_filtered: IPolicyConfiguration = useMemo(
		() => ({polAttr: qos_data?.filter(item => item.targetObject.attachment === 1 && item.targetObject.polObjName === device_name) ?? []}),
		[qos_data, device_name],
	);

	const {data: mirror_data} = useMirrors(inst);
	const mirror_data_filtered: IMirrorConfiguration = useMemo(
		() => ({mirrAttr: mirror_data?.filter(item => item.mirrorInfo.port === device_name) ?? []}),
		[mirror_data, device_name],
	);

	useEffect(() => {
		set_selected_rows([]);
	}, [cur_tab_idx]);

	return (
		<TabView title={title} tabs={tabs} onChangeTab={set_cur_tab_idx}>
			<Box id="tab-pannel" marginTop="20px">
				{cur_tab_idx === 0 && <FirewallTable data={fw_data_filtered} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} />}
				{cur_tab_idx === 1 && <MirrorTable data={mirror_data_filtered} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} />}
				{cur_tab_idx === 2 && <QoSTable data={qos_data_filtered} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} />}
			</Box>
		</TabView>
	);
}
