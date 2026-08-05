//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import protocols from 'assets/json/protocols.json';
import { getStableHash } from 'common';
import DataTable from 'components/table/DataTable';
import {useMemo} from 'react';
import {IFirewallRules} from 'types/firewall';
import {IDataTableColumnDef, IEnumItem} from 'types/global';

const protocol_order = [1, 6, 17, 132];
const protocol_list: IEnumItem[] = protocols;

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function FirewallTable(props: {data: IFirewallRules; selected_rows: number[]; onChangeSelectedRows: any; onAdd?: any; onDelete?: any; onRefresh?: any; error?: boolean}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, onRefresh, error} = props;

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
		{data_key: 'sourceIP', header: 'Source IP', type: 'mono'},
		{data_key: 'destinationIP', header: 'Dest. IP', type: 'mono'},
		{data_key: 'sourcePort', header: 'Source Port', type: 'mono'},
		{data_key: 'destinationPort', header: 'Dest. Port', type: 'mono'},
		{data_key: 'protocol', header: 'Protocol', width: 'medium', type: 'tag'},
		{data_key: 'preference', header: 'Preference', width: 'medium', align: 'right', type: 'mono', tooltip: 'User preference for ordering. (Lower value indicates higher priority)	'},
		{data_key: 'counter', header: 'Counter', width: 'medium', align: 'right', type: 'mono', tooltip: 'Packet:Byte counter for the rule'},
	];

   // Hash function for firewall rule
   const getHashKey = (item: any) => {
	   const str = `${item.ruleArguments.portName || ''}_${item.ruleArguments.sourceIP || ''}_${item.ruleArguments.minSourcePort || ''}_${item.ruleArguments.maxSourcePort || ''}_${item.ruleArguments.destinationIP || ''}_${item.ruleArguments.minDestinationPort || ''}_${item.ruleArguments.maxDestinationPort || ''}_${item.ruleArguments.protocol || ''}`;
	   return getStableHash(str);
   };

   const rows = data.fwAttr
	   ? (() => {
		   const sorted = [...data.fwAttr].sort((a, b) => getHashKey(a) - getHashKey(b));
		   return sorted.map(item => {
			   const protocol_id: number = item.ruleArguments.protocol;
			   const protocol_name = protocol_list.find(p => p.id === protocol_id)?.name || 'Unknown';
			   const minSourcePort = item.ruleArguments.minSourcePort ? item.ruleArguments.minSourcePort.toString() : '';
			   const maxSourcePort = item.ruleArguments.maxSourcePort ? item.ruleArguments.maxSourcePort.toString() : '';
			   const minDestinationPort = item.ruleArguments.minDestinationPort ? item.ruleArguments.minDestinationPort.toString() : '';
			   const maxDestinationPort = item.ruleArguments.maxDestinationPort ? item.ruleArguments.maxDestinationPort.toString() : '';

			   return {
				   id: getHashKey(item),
				   portName: item.ruleArguments.portName ? item.ruleArguments.portName : '',
				   sourceIP: item.ruleArguments.sourceIP ? item.ruleArguments.sourceIP : '',
				   sourcePort: `${minSourcePort}-${maxSourcePort}`,
				   destinationIP: item.ruleArguments.destinationIP,
				   destinationPort: `${minDestinationPort}-${maxDestinationPort}`,
				   protocol: protocol_name,
				   preference: item.ruleArguments.preference ? item.ruleArguments.preference.toString() : '',
				   counter: item.opts.counter ? item.opts.counter : '',
				   _uniqueKey: getHashKey(item),
			   };
		   });
	   })()
	   : undefined;

	return <DataTable name={'Firewall'} columns={cols} rows={rows || []} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} onRefresh={onRefresh} error={error} />;
}
