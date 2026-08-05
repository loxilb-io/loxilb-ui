//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IBFDAttribureInfo} from 'types/bfd';
import {IDataTableColumnDef} from 'types/global';
import {getStableHash} from 'common';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BFDTable(props: {data: IBFDAttribureInfo; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any; onRefresh?: any; error?: boolean}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, onRefresh, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'instance', header: 'Instance', width: 'medium', tooltip: 'Displays the instance or node where this service or rule is applied.'},
		{data_key: 'remoteIp', header: 'Remote IP', width: 'wide', type: 'mono', tooltip: 'Target IP address used for the endpoint or destination in load balancing.'},
		{data_key: 'sourceIP', header: 'Source IP', width: 'wide', type: 'mono', tooltip: 'Source IP address used in NAT or filtering rules.'},
		{data_key: 'port', header: 'Port', width: 'medium', align: 'right', type: 'mono', tooltip: 'Network port number used to forward or filter traffic.'},
		{data_key: 'interval', header: 'Interval (ms)', align: 'right', width: 'medium', type: 'mono', tooltip: 'Time interval (in milliseconds) between each health check probe.'},
		{data_key: 'state', header: 'State', type: 'state', width: 'full', tooltip: 'Indicates whether the component or service is active or inactive.'},
	];

   // Use global hash function for BFD entry
   const getHashKey = (item: any) => getStableHash(`${item.instance || ''}_${item.remoteIp || ''}_${item.sourceIP || ''}_${item.port || ''}`);

   const rows = data.Attr && Array.isArray(data.Attr)
	   ? (() => {
		   const sorted = [...data.Attr].sort((a, b) => getHashKey(a) - getHashKey(b));
		   return sorted.map(item => ({
			   id: getHashKey(item),
			   instance: item.instance,
			   remoteIp: item.remoteIp,
			   sourceIP: item.sourceIP,
			   port: item.port,
			   interval: item.interval,
			   state: item.state,
			   _uniqueKey: getHashKey(item),
		   }));
	   })()
	   : [];

	const name = 'Instance of Bidirectional Forwarding Detection';
	return <DataTable name={name} columns={cols} rows={rows || []} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} onRefresh={onRefresh} error={error} />;
}
