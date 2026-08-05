//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash} from 'common';
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IVxlanData} from 'types/vxlan';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function VXLANTable(props: {data: IVxlanData; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any; error?: boolean}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'vxlanID', header: 'VxLAN ID', width: 'wide', type: 'mono'},
		{data_key: 'vxlanName', header: 'Name', width: 'wide'},
		{data_key: 'epIntf', header: 'Endpoint', width: 'wide'},
		{data_key: 'peerIP', header: 'Peer IPs', width: 'wide', type: 'mono'},
	];

	const rows = data.vxlanAttr.map(item => {
		return {
			id: getStableHash(String(item.vxlanID ?? '')),
			vxlanID: item.vxlanID,
			vxlanName: item.vxlanName,
			epIntf: item.epIntf,
			peerIP: item.peerIP,
		};
	});

	return <DataTable name={'VxLAN'} columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} onAdd={onAdd} onDelete={onDelete} error={error} />;
}
