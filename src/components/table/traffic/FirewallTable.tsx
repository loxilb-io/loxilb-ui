//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import protocols from 'assets/json/protocols.json';
import DataTable from 'components/table/DataTable';
import {useMemo} from 'react';
import {IFirewallRules} from 'types/firewall';
import {IDataTableColumnDef, IEnumItem} from 'types/global';

const protocol_order = [1, 6, 17, 132];
const protocol_list: IEnumItem[] = protocols;

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function FirewallTable(props: {data: IFirewallRules; selected_rows: number[]; onChangeSelectedRows: any; onAdd?: any; onDelete?: any}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete} = props;

	const sorted_data = useMemo(() => {
		const protocol_map = new Map<number, number>();
		protocol_order.forEach((protocol, index) => {
			protocol_map.set(protocol, index);
		});

		return data.fwAttr.slice().sort((a, b) => {
			const protocol_a = a.ruleArguments.protocol;
			const protocol_b = b.ruleArguments.protocol;
			const order_a = protocol_map.get(protocol_a) ?? protocol_order.length;
			const order_b = protocol_map.get(protocol_b) ?? protocol_order.length;
			return order_a - order_b;
		});
	}, [data.fwAttr]);

	const cols: IDataTableColumnDef[] = [
		{data_key: 'portName', header: 'Port Name'},
		{data_key: 'sourceIP', header: 'Source IP'},
		{data_key: 'destinationIP', header: 'Dest. IP'},
		{data_key: 'sourcePort', header: 'Source Port'},
		{data_key: 'destinationPort', header: 'Dest. Port'},
		{data_key: 'protocol', header: 'Protocol', width: 'medium'},
		{data_key: 'preference', header: 'Preference', width: 'medium'},
		{data_key: 'counter', header: 'Counter', width: 'medium'},
	];

	const rows = sorted_data.map((item, index) => {
		const protocol_id: number = item.ruleArguments.protocol;

		const protocol_name = protocol_list.find(p => p.id === protocol_id)?.name || 'Unknown';
		return {
			id: index,
			portName: item.ruleArguments.portName,
			sourceIP: item.ruleArguments.sourceIP,
			sourcePort: `${item.ruleArguments.minSourcePort}-${item.ruleArguments.maxSourcePort}`, // CIDR format
			destinationIP: item.ruleArguments.destinationIP,
			destinationPort: `${item.ruleArguments.minDestinationPort}-${item.ruleArguments.maxDestinationPort}`, // CIDR format
			protocol: protocol_name,
			preference: item.ruleArguments.preference,
			counter: item.opts.counter,
		};
	});

	return <DataTable name={'Firewall'} columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} />;
}
