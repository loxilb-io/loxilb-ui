//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {ISessionConfiguration} from 'types/session';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function UESessionTable(props: {data: ISessionConfiguration; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'ident', header: 'Name', width: 'wide'},
		{data_key: 'sessionIP', header: 'Session IP', width: 'wide'},
		{data_key: 'access', header: 'Access Net Tunnel', width: 'wide'},
		{data_key: 'core', header: 'Core Net Tunnel', width: 'wide'},
	];

	const rows = data.sessionAttr.map((item, index) => {
		return {
			id: index,
			ident: item.ident,
			sessionIP: item.sessionIP,
			access: `${item.accessNetworkTunnel.TeID} (${item.accessNetworkTunnel.tunnelIP})`,
			core: `${item.coreNetworkTunnel.teID} (${item.coreNetworkTunnel.tunnelIP})`,
		};
	});

	return (
		<DataTable
			name={'User Equipment Session'}
			columns={cols}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onDelete={onDelete}
		/>
	);
}
