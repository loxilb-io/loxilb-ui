//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {get_transfer_amount_str} from 'common';
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IVlanData} from 'types/vlan';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function VLANTable(props: {data: IVlanData; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'vid', header: 'VLAN ID', width: 'wide'},
		{data_key: 'dev', header: 'Device', width: 'wide'},
		{data_key: 'member', header: 'Members', width: 'super_wide'},
		{data_key: 'inbounds', header: 'Inbounds', type: 'multi-line', align: 'right', width: 'wide'},
		{data_key: 'outbounds', header: 'Outbounds', type: 'multi-line', align: 'right', width: 'wide'},
	];

	const rows = data.vlanAttr.map((item, index) => {
		return {
			id: index,
			vid: item.vid,
			dev: item.dev,
			member: item.member.map(member => `${member.dev}${member.tagged ? '(tagged)' : '(untagged)'}`).join(', '),
			inbounds: get_transfer_amount_str(item.vlanStatistic.inBytes, item.vlanStatistic.inPackets),
			outbounds: get_transfer_amount_str(item.vlanStatistic.outBytes, item.vlanStatistic.outPackets),
		};
	});

	return <DataTable name={'VLAN'} columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} />;
}
