//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {get_transfer_amount_str} from 'common';
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IVlanData} from 'types/vlan';
import {PageDataState} from 'components/state/pageState';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function VLANTable(props: {data: IVlanData; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any; onRefresh?: any; state?: PageDataState<unknown>; error?: boolean}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, onRefresh, state, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'vid', header: 'VLAN ID', width: 'wide', type: 'mono'},
		{data_key: 'dev', header: 'Device', width: 'wide'},
		{data_key: 'member', header: 'Members', width: 'super_wide'},
		{data_key: 'inbounds', header: 'Inbounds', type: 'multi-line', align: 'right', width: 'wide'},
		{data_key: 'outbounds', header: 'Outbounds', type: 'multi-line', align: 'right', width: 'wide'},
	];

   // Hash function for VLAN
   const getHashKey = (item: any) => {
	   const str = `${item.vid || ''}_${item.dev || ''}`;
	   let hash = 0;
	   for (let i = 0; i < str.length; i++) {
		   hash = ((hash << 5) - hash) + str.charCodeAt(i);
		   hash |= 0;
	   }
	   return hash >>> 0;
   };

   const rows = data.vlanAttr
	   ? (() => {
		   const sorted = [...data.vlanAttr].sort((a, b) => getHashKey(a) - getHashKey(b));
		   return sorted.map(item => {
			   return {
				   id: getHashKey(item),
				   vid: item.vid,
				   dev: item.dev,
				   member: item.member.map(member => `${member.dev}${member.tagged ? '(tagged)' : '(untagged)'}`).join(', '),
				   inbounds: get_transfer_amount_str(item.vlanStatistic.inBytes, item.vlanStatistic.inPackets),
				   outbounds: get_transfer_amount_str(item.vlanStatistic.outBytes, item.vlanStatistic.outPackets),
				   _uniqueKey: getHashKey(item),
			   };
		   });
	   })()
	   : undefined;

	return <DataTable name={'VLAN'} columns={cols} rows={rows || []} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} onRefresh={onRefresh} state={state} error={error} />;
}
