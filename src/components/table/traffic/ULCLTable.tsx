//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IDataTableColumnDef} from 'types/global';
import {IUlclConfiguration} from 'types/session_ulcl';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function ULCLTable(props: {data: IUlclConfiguration; selected_rows: number[]; onChangeSelectedRows: any; onAdd: any; onDelete: any}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'ulclIdent', header: 'Name', width: 'wide'},
		{data_key: 'qfi', header: 'QFI', width: 'medium', tooltip: 'QoS Flow specifies one QFI value (QFIs can be assigned from 1 to 255)'},
		{data_key: 'ulclIP', header: 'ULCL IP', width: 'wide', tooltip: 'Apply policies such as allow/block/prioritize based on a specific IP address'},
	];

	const rows = data.ulclAttr.map((item, index) => {
		return {
			id: index,
			ulclIdent: item.ulclIdent,
			qfi: item.ulclArgument.qfi,
			ulclIP: item.ulclArgument.ulclIP,
		};
	});

	return (
		<DataTable
			name={'Uplink Classifier'}
			columns={cols}
			rows={rows}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onDelete={onDelete}
		/>
	);
}
