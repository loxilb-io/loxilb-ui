//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import {Box, Typography} from '@mui/material';
import {DataGrid, GridRowSelectionModel} from '@mui/x-data-grid';
import {FOCUS_RING} from 'theme';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
// Designed empty state: a blank rectangle reads as "broken"; a labeled one
// reads as "empty on purpose". The caller supplies resource-aware copy.
// The overlay IS the live region for "this table has nothing in it" (ES-10).
// A grid that silently swaps its rows for a placeholder tells a sighted
// operator everything and a screen-reader user nothing; announcing it here
// means the message is announced exactly once, at the place it is displayed,
// rather than duplicated into a second hidden node beside it.
function EmptyOverlay(props: {label: string}) {
	return (
		<Box role="status" aria-live="polite" height="100%" display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap="6px">
			<InboxOutlinedIcon sx={{fontSize: '36px', color: 'grey.400'}} />
			<Typography variant="body2" color="text.secondary">
				{props.label}
			</Typography>
		</Box>
	);
}

export function TableBase(props: {
	columns: any;
	rows: any;
	rowSelectionModel?: GridRowSelectionModel;
	hideIdColumn?: boolean;
	hideCheckbox?: boolean;
	disableSelect?: boolean;
	onSelectionChange?: any;
	defaultSort?: {field: string; sort: 'asc' | 'desc'};
	emptyLabel?: string;
	rowHeight?: number;
}) {
	const {columns, rows, rowSelectionModel, onSelectionChange, hideIdColumn, hideCheckbox, disableSelect, defaultSort, emptyLabel, rowHeight} = props;

	const displayColumns = hideIdColumn ? columns.filter((column: any) => column.field !== 'id') : columns;

	return (
		<DataGrid
			rows={rows}
			columns={displayColumns}
			slots={emptyLabel ? {noRowsOverlay: () => <EmptyOverlay label={emptyLabel} />} : undefined}
			initialState={{
				pagination: {paginationModel: {pageSize: 25}},
				sorting: defaultSort ? {sortModel: [{field: defaultSort.field, sort: defaultSort.sort}]} : undefined,
			}}
			pageSizeOptions={[10, 25, 50]}
			rowHeight={rowHeight ?? 44}
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
				'& .MuiDataGrid-row': {transition: 'background-color 150ms ease'},
				'& .MuiDataGrid-row:hover': {backgroundColor: 'rgba(17, 51, 81, 0.045)'},
				// Mouse clicks stay ring-free, but keyboard navigation gets the
				// shared focus ring (inset so it isn't clipped by the row box).
				'.MuiDataGrid-cell:focus': {outline: 'none'},
				'.MuiDataGrid-cell:focus-within': {outline: 'none'},
				'.MuiDataGrid-cell:focus-visible': {...FOCUS_RING, outlineOffset: '-2px'},
				'.MuiDataGrid-columnHeader:focus': {outline: 'none'},
				'.MuiDataGrid-columnHeader:focus-visible': {...FOCUS_RING, outlineOffset: '-2px'},
			}}
		/>
	);
}
