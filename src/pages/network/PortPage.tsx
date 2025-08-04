//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack} from '@mui/material';
import ChipField from 'components/element/ChipField';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import LowerSection from 'components/layout/LowerSection';
import PortTable from 'components/table/networks/PortTable';
import TabView from 'components/view/TabView';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePortAttr} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {IPortHardwareInfo, IPortInfo, IPortL2Info, IPortL3Info, IPortSoftwareInfo} from 'types/port';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
function SoftwarePanel(props: {sw_info: IPortSoftwareInfo}) {
	const {sw_info} = props;

	return (
		<Stack spacing={2}>
			<ValueBunch>
				<SingleTextBox label={t('OS ID')} value={sw_info.osId} />
			</ValueBunch>

			<ValueBunch>
				<SingleTextBox label={t('Berkeley Packet Filter Loaded')} value={sw_info.bpfLoaded} />
			</ValueBunch>

			<ValueBunch name={t('Port Information')}>
				<SingleTextBox label={t('Type')} value={sw_info.portType} />
				<SingleTextBox label={t('Property')} value={sw_info.portProp} />
				<SingleTextBox label={t('Active')} value={sw_info.portActive} />
			</ValueBunch>
		</Stack>
	);
}

function HardwarePanel(props: {hw_info: IPortHardwareInfo}) {
	const {hw_info} = props;

	return (
		<Stack spacing={2}>
			<ValueBunch>
				<SingleTextBox label={t('MAC Address')} value={hw_info.macAddress} />
				<SingleTextBox label={t('Master')} value={hw_info.master} />
				<SingleTextBox label={t('Real Network')} value={hw_info.real} />
			</ValueBunch>

			<ValueBunch>
				<SingleTextBox label={t('Link')} value={hw_info.link ? t('True') : t('False')} />
				<SingleTextBox label={t('State')} value={hw_info.state ? t('True') : t('False')} />
			</ValueBunch>

			<ValueBunch>
				<SingleTextBox label={t('Maximum Tramission Unit')} value={hw_info.mtu} />
			</ValueBunch>

			<ValueBunch>
				<SingleTextBox label={t('Tunnel ID')} value={hw_info.tunnelId} />
			</ValueBunch>
		</Stack>
	);
}

function Layer2Panel(props: {l2_info: IPortL2Info}) {
	const {l2_info} = props;

	return (
		<Stack spacing={2}>
			<SingleTextBox label={t('VLAN ID')} value={l2_info.vid} />
			<SingleTextBox label={t('is Port VLAN ID')} value={l2_info.isPvid ? t('True') : t('False')} />
		</Stack>
	);
}

function Layer3Panel(props: {l3_info: IPortL3Info}) {
	const {l3_info} = props;

	return (
		<Stack spacing={2}>
			<ChipField label={t('IPv4 Addresses')} item_list={l3_info.IPv4Address} />
			<ChipField label={t('IPv6 Addresses')} item_list={l3_info.IPv6Address} />
			<SingleTextBox label={t('Routed')} value={l3_info.routed ? t('True') : t('False')} />
		</Stack>
	);
}

export default function PortPage() {
	const inst = useInstanceFromURL();

	const {data} = usePortAttr(inst); // IPortAttribute[]
	const port_info: IPortInfo = {portAttr: data ?? []};

	const [searchParams] = useSearchParams();
	const url_param = searchParams.get('port') ?? '';

	const [cur_tab_idx, set_cur_tab_idx] = useState(0);
	const [selected_rows, set_selected_rows] = useState<number[]>([]);

	const tabs = [t('Software'), t('Hardware'), t('Layer 2'), t('Layer 3')];

	const handleChangeRows = (rows: number[]) => {
		if (rows.length === 0) {
			set_selected_rows([]);
			set_cur_tab_idx(0);
		} else {
			const max_idx = port_info.portAttr.length;
			const valid_rows = rows.filter(row => row < max_idx);

			if (valid_rows.length === 0) {
				set_selected_rows([]);
				set_cur_tab_idx(0);
			} else {
				set_selected_rows(valid_rows);
				set_cur_tab_idx(0);
			}
		}
	};

	return (
		<Fragment>
			<PortTable data={port_info} selected_rows={selected_rows} onChangeSelectedRows={handleChangeRows} />

			{selected_rows.length === 1 && port_info.portAttr.length > selected_rows[0] && (
				<LowerSection>
					<TabView title={port_info.portAttr[selected_rows[0]].portName} sub_title={t('Details')} tabs={tabs} onChangeTab={set_cur_tab_idx}>
						<Box id="sub-menu" marginTop="20px" padding="10px">
							<Box role="tabpanel" hidden={cur_tab_idx !== 0}>
								<SoftwarePanel sw_info={port_info.portAttr[selected_rows[0]].portSoftwareInformation} />
							</Box>

							<Box role="tabpanel" hidden={cur_tab_idx !== 1}>
								<HardwarePanel hw_info={port_info.portAttr[selected_rows[0]].portHardwareInformation} />
							</Box>

							<Box role="tabpanel" hidden={cur_tab_idx !== 2}>
								<Layer2Panel l2_info={port_info.portAttr[selected_rows[0]].portL2Information} />
							</Box>

							<Box role="tabpanel" hidden={cur_tab_idx !== 3}>
								<Layer3Panel l3_info={port_info.portAttr[selected_rows[0]].portL3Information} />
							</Box>
						</Box>
					</TabView>
				</LowerSection>
			)}
		</Fragment>
	);
}
