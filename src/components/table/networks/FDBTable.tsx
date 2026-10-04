//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import {IFdbData} from 'types/fdb';
import {IDataTableColumnDef} from 'types/global';
import {identifyFdbEntries} from 'types/fdb_identity';
import {GridRowId} from '@mui/x-data-grid';
import {PageDataState} from 'components/state/pageState';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function FDBTable(props: {data: IFdbData; selected_rows: GridRowId[]; onChangeSelectedRows: any; onAdd: any; onDelete: any; onRefresh?: any; state?: PageDataState<unknown>; error?: boolean}) {
	const {data, selected_rows, onChangeSelectedRows, onAdd, onDelete, onRefresh, state, error} = props;

	const cols: IDataTableColumnDef[] = [
		{data_key: 'dev', header: 'Device', width: 'wide'},
		{data_key: 'macAddress', header: 'MAC Address', width: 'wide', type: 'mono'},
	];

	   const rows = data.fdbAttr
		   ? (() => {
			   const identified = identifyFdbEntries(data.fdbAttr).sort((a, b) => a.id.localeCompare(b.id));
			   return identified.map(({id, entry}) => {
				   return {
					   id,
					   dev: entry.dev,
					   macAddress: entry.macAddress,
					   description: '',
					   _uniqueKey: id,
				   };
		   });
	   })()
	   : undefined;

	return (
		<DataTable
			name={'Forwarding Database'}
			columns={cols}
			rows={rows || []}
			selected_rows={selected_rows}
			onChangeSelectedRows={onChangeSelectedRows}
			onAdd={onAdd}
			onDelete={onDelete}
			onRefresh={onRefresh}
			state={state}
			error={error}
		/>
	);
}
