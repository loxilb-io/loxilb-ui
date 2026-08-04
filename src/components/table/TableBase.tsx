//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {DataGrid, GridRowSelectionModel} from '@mui/x-data-grid';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export function TableBase(props: {
	columns: any;
	rows: any;
	rowSelectionModel?: GridRowSelectionModel;
	hideIdColumn?: boolean;
	hideCheckbox?: boolean;
	disableSelect?: boolean;
	onSelectionChange?: any;
	defaultSort?: {field: string; sort: 'asc' | 'desc'};
}) {
	const {columns, rows, rowSelectionModel, onSelectionChange, hideIdColumn, hideCheckbox, disableSelect, defaultSort} = props;

	const displayColumns = hideIdColumn ? columns.filter((column: any) => column.field !== 'id') : columns;

	return (
		<DataGrid
			rows={rows}
			columns={displayColumns}
			initialState={{
				pagination: {paginationModel: {pageSize: 25}},
				sorting: defaultSort ? {sortModel: [{field: defaultSort.field, sort: defaultSort.sort}]} : undefined,
			}}
			pageSizeOptions={[10, 25, 50]}
			rowHeight={44}
			columnHeaderHeight={44}
			checkboxSelection={onSelectionChange !== undefined && hideCheckbox !== true && disableSelect !== true}
			onRowSelectionModelChange={onSelectionChange}
			rowSelectionModel={rowSelectionModel}
			disableRowSelectionOnClick={disableSelect === true}
			sx={{
				border: 0,
				cursor: 'pointer',
				// Header reads as a band, not a bare text row.
				'--DataGrid-containerBackground': '#F6F8FA',
				'& .MuiDataGrid-columnHeaders .MuiDataGrid-columnHeaderTitleContainer': {typography: 'subtitle2'},
				'& .MuiDataGrid-cell': {typography: 'body2'},
				'& .MuiDataGrid-row:hover': {backgroundColor: 'rgba(17, 51, 81, 0.045)'},
				'.MuiDataGrid-cell:focus': {outline: 'none'},
				'.MuiDataGrid-cell:focus-within': {outline: 'none'},
			}}
		/>
	);
}
