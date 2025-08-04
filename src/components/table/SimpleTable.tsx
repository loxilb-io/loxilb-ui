//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {DataGrid} from '@mui/x-data-grid';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export function SimpleTable(props: {columns: any; rows: any; onRowClick?: (row: any) => void}) {
	const {columns, rows, onRowClick} = props;

	return (
		<DataGrid
			rows={rows}
			columns={columns}
			initialState={{pagination: {paginationModel: {pageSize: 5}}}}
			checkboxSelection={false}
			columnHeaderHeight={rows.length <= 5 ? 35 : 25}
			rowHeight={rows.length <= 5 ? 35 : 25}
			pageSizeOptions={[5]}
			disableColumnResize={true}
			disableColumnSorting={true}
			disableColumnMenu={true}
			hideFooterPagination={rows.length <= 5}
			hideFooter={rows.length <= 5}
			disableRowSelectionOnClick
			isRowSelectable={() => false}
			onRowClick={params => {
				if (onRowClick) onRowClick(params.row);
			}}
			sx={{
				border: 0,
				cursor: 'pointer',
				userSelect: 'none',
				'& .MuiDataGrid-columnHeaders .MuiDataGrid-columnHeaderTitleContainer': {typography: 'caption'},
				'& .MuiDataGrid-cell': {typography: 'caption', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center'},
				'.MuiDataGrid-cell:focus': {outline: 'none'},
				'.MuiDataGrid-cell:focus-within': {outline: 'none'},
				'& .MuiDataGrid-columnSeparator': {display: 'none'},
			}}
		/>
	);
}
