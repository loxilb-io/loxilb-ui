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

	// const sorted_data = useMemo(() => {
	// 	const protocol_map = new Map<number, number>();
	// 	protocol_order.forEach((protocol, index) => {
	// 		protocol_map.set(protocol, index);
	// 	});

	// 	return data.fwAttr.slice().sort((a, b) => {
	// 		const protocol_a = a.ruleArguments.protocol;
	// 		const protocol_b = b.ruleArguments.protocol;
	// 		const order_a = protocol_map.get(protocol_a) ?? protocol_order.length;
	// 		const order_b = protocol_map.get(protocol_b) ?? protocol_order.length;
	// 		return order_a - order_b;
	// 	});
	// }, [data.fwAttr]);

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

	const getUniqueKey = (item: any) => {
		return [
			item.ruleArguments.portName || '',
			item.ruleArguments.sourceIP || '',
			item.ruleArguments.minSourcePort || '',
			item.ruleArguments.maxSourcePort || '',
			item.ruleArguments.destinationIP || '',
			item.ruleArguments.minDestinationPort || '',
			item.ruleArguments.maxDestinationPort || '',
			item.ruleArguments.protocol || ''
		].join('-');
	};

	const rows = data.fwAttr
		? [...data.fwAttr]
			.sort((a, b) => {
				const keyA = getUniqueKey(a);
				const keyB = getUniqueKey(b);
				return keyA.localeCompare(keyB);
			})
			.map((item, index) => {
				const protocol_id: number = item.ruleArguments.protocol;
				const protocol_name = protocol_list.find(p => p.id === protocol_id)?.name || 'Unknown';
				const minSourcePort = item.ruleArguments.minSourcePort ? item.ruleArguments.minSourcePort.toString() : '';
				const maxSourcePort = item.ruleArguments.maxSourcePort ? item.ruleArguments.maxSourcePort.toString() : '';
				const minDestinationPort = item.ruleArguments.minDestinationPort ? item.ruleArguments.minDestinationPort.toString() : '';
				const maxDestinationPort = item.ruleArguments.maxDestinationPort ? item.ruleArguments.maxDestinationPort.toString() : '';

				return {
					id: index,
					portName: item.ruleArguments.portName ? item.ruleArguments.portName : '',
					sourceIP: item.ruleArguments.sourceIP ? item.ruleArguments.sourceIP : '',
					sourcePort: `${minSourcePort}-${maxSourcePort}`, // CIDR format
					destinationIP: item.ruleArguments.destinationIP,
					destinationPort: `${minDestinationPort}-${maxDestinationPort}`, // CIDR format
					protocol: protocol_name,
					preference: item.ruleArguments.preference ? item.ruleArguments.preference.toString() : '',
					counter: item.opts.counter ? item.opts.counter : '',
				};
			})
		: undefined

	return <DataTable name={'Firewall'} columns={cols} rows={rows || []} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} />;
}
