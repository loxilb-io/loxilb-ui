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
import React from 'react';
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

	const {data, refetch} = usePortAttr(inst); // IPortAttribute[]
	const port_info: IPortInfo = {portAttr: data ?? []};

	const [searchParams] = useSearchParams();
	const url_param = searchParams.get('port') ?? '';

   const [cur_tab_idx, set_cur_tab_idx] = useState(0);
   const [selected_rows, set_selected_rows] = useState<number[]>([]);
   // Track selected portNo for synchronization
   const [selected_portNo, set_selected_portNo] = useState<number | null>(null);

   const tabs = [t('Software'), t('Hardware'), t('Layer 2'), t('Layer 3')];

   // Hash function for port
   const getHashKey = (item: any) => {
	   const str = `${item.portNo || ''}_${item.portName || ''}`;
	   let hash = 0;
	   for (let i = 0; i < str.length; i++) {
		   hash = ((hash << 5) - hash) + str.charCodeAt(i);
		   hash |= 0;
	   }
	   return hash >>> 0;
   };
   // Sorted ports
   const sortedAttr = port_info.portAttr ? [...port_info.portAttr].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];
   // Find selected index in sortedAttr
   let selected_index = -1;
   if (selected_rows.length === 1 && port_info.portAttr) {
	   const original = port_info.portAttr[selected_rows[0]];
	   selected_index = sortedAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
   } else if (selected_portNo !== null) {
	   selected_index = sortedAttr.findIndex(attr => attr.portNo === selected_portNo);
   }
   // Selection handler: map sorted index back to original
   const handleChangeRows = (indices: number[]) => {
	   if (indices.length === 1 && port_info.portAttr) {
		   const sortedItem = sortedAttr[indices[0]];
		   const originalIndex = port_info.portAttr.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
		   set_selected_rows(originalIndex !== -1 ? [originalIndex] : []);
		   set_cur_tab_idx(0);
	   } else {
		   set_selected_rows([]);
		   set_cur_tab_idx(0);
	   }
   };

   // Synchronize selected_portNo with selected_rows
   // (useEffect required for correct selection after sorting)
   React.useEffect(() => {
	   if (!port_info.portAttr || port_info.portAttr.length === 0) return;
	   if (selected_rows.length === 1) {
		   const portNo = port_info.portAttr[selected_rows[0]].portNo;
		   set_selected_portNo(portNo);
	   } else if (selected_portNo !== null) {
		   set_selected_portNo(null);
	   }
   }, [port_info, selected_rows, selected_portNo]);

   return (
	   <Fragment>
		   <PortTable
			   data={{portAttr: sortedAttr}}
			   selected_rows={selected_index !== -1 ? [selected_index] : []}
			   onChangeSelectedRows={handleChangeRows}
			   onRefresh={refetch}
		   />
		   {selected_index !== -1 && sortedAttr.length > selected_index && (
			   <LowerSection>
				   <TabView title={sortedAttr[selected_index].portName} sub_title={t('Details')} tabs={tabs} onChangeTab={set_cur_tab_idx}>
					   <Box id="sub-menu" marginTop="20px" padding="10px">
						   <Box role="tabpanel" hidden={cur_tab_idx !== 0}>
							   <SoftwarePanel sw_info={sortedAttr[selected_index].portSoftwareInformation} />
						   </Box>

						   <Box role="tabpanel" hidden={cur_tab_idx !== 1}>
							   <HardwarePanel hw_info={sortedAttr[selected_index].portHardwareInformation} />
						   </Box>

						   <Box role="tabpanel" hidden={cur_tab_idx !== 2}>
							   <Layer2Panel l2_info={sortedAttr[selected_index].portL2Information} />
						   </Box>

						   <Box role="tabpanel" hidden={cur_tab_idx !== 3}>
							   <Layer3Panel l3_info={sortedAttr[selected_index].portL3Information} />
						   </Box>
					   </Box>
				   </TabView>
			   </LowerSection>
		   )}
	   </Fragment>
   );
}
