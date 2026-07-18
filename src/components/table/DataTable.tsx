//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ModeIcon from '@mui/icons-material/Mode';
import RefreshIcon from '@mui/icons-material/Refresh';
import {Box, IconButton, Stack, Tooltip} from '@mui/material';
import {GridColDef, GridRowSelectionModel} from '@mui/x-data-grid';
import {
	BooleanCell,
	LinkCell,
	LogLevelCell,
	MultiLineCell,
	OnOffCell,
	StateAndNameCell,
	StateCell,
	StatusCell,
	SublineHeader,
	SyncCell,
	TextCell,
	ToolTipHeader,
	UsageCell,
} from 'components/element/CustomGridCell';
import {usePopUp} from 'hooks/popupHook';
import {useRole} from 'hooks/query/oamHooks';
import {t} from 'i18next';
import {IDataTableColumnDef} from 'types/global';
import {TableBase} from './TableBase';

const col_width_value = {
	narrow: 70,
	medium: 120,
	wide: 180,
	super_wide: 300,
	full: undefined,
};

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function DataTable(props: {
	name: string;
	columns: IDataTableColumnDef[];
	rows: any[];
	selected_rows: number[];
	onChangeSelectedRows: any;
	hideCheckbox?: boolean;
	hideMenuBar?: boolean;
	hideIdColumn?: boolean;
	disableSelect?: boolean;
	onAdd?: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
	onRefresh?: () => void;
	defaultSort?: {field: string; sort: 'asc' | 'desc'};
}) {
	const {name, columns, rows, selected_rows, onChangeSelectedRows, hideMenuBar, hideCheckbox, hideIdColumn, disableSelect, onRefresh, defaultSort} = props;

	// RBAC Phase 3: viewers are read-only everywhere, so hide the mutation
	// buttons for them (UX only — the server rejects viewer writes with 403).
	// While the role is still loading (is_viewer false) buttons stay visible.
	const {is_viewer} = useRole();
	const onAdd = is_viewer ? undefined : props.onAdd;
	const onEdit = is_viewer ? undefined : props.onEdit;
	const onDelete = is_viewer ? undefined : props.onDelete;

	const handleRowSelectionChange = (selection: GridRowSelectionModel) => {
		const indices = selection.map(id => Number(id));
		if (onChangeSelectedRows) onChangeSelectedRows(indices);
	};

	let cols: GridColDef[] = columns.map(col => {
		const renderHeader = () =>
			col.tooltip ? (
				<ToolTipHeader header={col.header} tooltip={col.tooltip} />
			) : col.header.includes('\n') ? (
				<SublineHeader header={col.header.split('\n')[0]} subheader={col.header.split('\n')[1]} />
			) : undefined;

		let cell_width = col_width_value[col.width ?? 'medium'] ?? 0;
		if (col.tooltip) cell_width += 50;

		return {
			field: col.data_key,
			headerName: col.header,
			width: cell_width,
			minWidth: col.width === 'full' ? 180 : undefined,
			flex: col.width === 'full' ? 1 : undefined,
			align: col.align ?? 'left',
			headerAlign: col.align ?? 'left',
			type: 'string',
			sortComparator: col.sortComparator
				? col.sortComparator
				: col.type === 'link'
				? (v1: any, v2: any) => {
						const text1 = typeof v1 === 'object' && v1.data ? v1.data : String(v1);
						const text2 = typeof v2 === 'object' && v2.data ? v2.data : String(v2);
						return text1.localeCompare(text2);
				  }
				: undefined,
			renderHeader: renderHeader,
			renderCell:
				col.type === 'multi-line'
					? MultiLineCell
					: col.type === 'state'
					? StateCell
					: col.type === 'sync'
					? SyncCell
					: col.type === 'boolean'
					? BooleanCell
					: col.type === 'on-off'
					? OnOffCell
					: col.type === 'log-level'
					? LogLevelCell
					: col.type === 'state-and-name'
					? StateAndNameCell
					: col.type === 'link'
					? LinkCell
					: col.type === 'status'
					? StatusCell
					: col.type === 'usage'
					? UsageCell
					: TextCell,
		};
	});

	// Prepend the implicit ID column only when a caller hasn't already declared
	// one. DataGrid keys columns by `field`; a second `field: 'id'` collides
	// (duplicate React key → duplicate/omitted cells). Defensive for every caller.
	if (!cols.some(c => c.field === 'id')) {
		cols.unshift({field: 'id', headerName: 'ID', type: 'number', width: col_width_value['narrow'], align: 'left', headerAlign: 'left', renderCell: TextCell});
	}

	const {openPopUp} = usePopUp();

	const handleDelete = (e: any) => {
		e.stopPropagation();
		openPopUp(t('WARNING!! Delete Item'), t('Are you sure you want to delete this Item? This action cannot be undone.'), t('Delete'), t('Cancel'), onDelete);
	};

	return (
		<Stack width="100%" maxWidth="1200px">
			{hideMenuBar === true ? null : (
				<Box id="table-bar" width="100%" height="40px" display="flex" justifyContent="flex-end" alignItems="center" bgcolor="grey.100" borderRadius="4px">
					{onRefresh && (
						<Tooltip title={t('Refresh {{name}}', {name})} placement="top" arrow>
							<span>
								<IconButton onClick={onRefresh}>
									<RefreshIcon sx={{color: 'primary.main'}} />
								</IconButton>
							</span>
						</Tooltip>
					)}

					{onAdd && (
						<Tooltip title={t('Add {{name}}', {name})} placement="top" arrow>
							<span>
								<IconButton onClick={onAdd}>
									<AddIcon sx={{color: 'secondary.main'}} />
								</IconButton>
							</span>
						</Tooltip>
					)}

					{onEdit && (
						<Tooltip title={t('Edit {{name}}', {name})} placement="top" arrow>
							<span>
								<IconButton disabled={selected_rows.length !== 1} onClick={onEdit}>
									<ModeIcon />
								</IconButton>
							</span>
						</Tooltip>
					)}

					{onDelete && (
						<Tooltip title={t('Delete {{name}}', {name})} placement="top" arrow>
							<span>
								<IconButton disabled={selected_rows.length === 0} onClick={handleDelete}>
									<DeleteIcon />
								</IconButton>
							</span>
						</Tooltip>
					)}
				</Box>
			)}

			<Box width="100%" height="400px">
				<TableBase
					columns={cols}
					rows={rows}
					rowSelectionModel={selected_rows}
					hideIdColumn={hideIdColumn}
					hideCheckbox={hideCheckbox}
					disableSelect={disableSelect}
					onSelectionChange={onChangeSelectedRows !== undefined ? handleRowSelectionChange : undefined}
					defaultSort={defaultSort}
				/>
			</Box>
		</Stack>
	);
}
