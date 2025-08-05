//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {get_ip_port_str, get_size_str} from 'common';
import DataTable from 'components/table/DataTable';
import {useInstanceName} from 'hooks/query/instanceHook';
import {ICtData} from 'types/conn_track';
import {IDataTableColumnDef} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function ConntrackTable(props: {data: ICtData; selected_rows: number[]; onChangeSelectedRows: any}) {
	const {data, selected_rows, onChangeSelectedRows} = props;

	const inst_name = useInstanceName();

	const cols: IDataTableColumnDef[] = [
		{data_key: 'servename', header: 'Service Name', type: 'link', width: 'super_wide'},
		{data_key: 'source', header: 'Source', width: 'wide'},
		{data_key: 'destination', header: 'Destination', width: 'wide'},
		{data_key: 'protocol', header: 'Protocol', width: 'medium'},
		{data_key: 'conntrackState', header: 'State', width: 'medium'},
		{data_key: 'conntrackAct', header: 'Act', width: 'wide'},
		{data_key: 'usage', header: 'Usages', align: 'right', width: 'wide'},
	];

	const getUniqueKey = (item: any) => {
		return [
			item.sourceIP || '',
			item.sourcePort || '',
			item.destinationIP || '',
			item.destinationPort || '',
			item.protocol || '',
			item.conntrackState || '',
			item.conntrackAct || ''
		].join('-');
	};

	const rows = data.ctAttr
		? [...data.ctAttr]
			.sort((a, b) => {
				const keyA = getUniqueKey(a);
				const keyB = getUniqueKey(b);
				return keyA.localeCompare(keyB);
			})
			.map((item, index) => {
				return {
					id: index,
					servename: {data: item.servName, url: `/instance/traffic/lb?name=${inst_name}&servName=${item.servName}`, toString: () => item.servName},
					source: get_ip_port_str(item.sourceIP, item.sourcePort),
					destination: get_ip_port_str(item.destinationIP, item.destinationPort),
					protocol: item.protocol,
					conntrackState: item.conntrackState,
					conntrackAct: item.conntrackAct,
					usage: item.bytes && item.packets ? `${get_size_str(item.bytes)} / ${item.packets} pkts` : ' ',
				};
			})
		: undefined;

	return <DataTable name={'Connection Track'} columns={cols} rows={rows || []} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} />;
}
