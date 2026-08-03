//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import DeleteIcon from '@mui/icons-material/Delete';
import ModeIcon from '@mui/icons-material/Mode';
import RefreshIcon from '@mui/icons-material/Refresh';
import {Alert, Box, Button, IconButton, Stack, Tooltip, Typography} from '@mui/material';
import {GridColDef, GridRowSelectionModel} from '@mui/x-data-grid';
import {
	BooleanCell,
	ChipCell,
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
import {ReactNode} from 'react';
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
	// Optional override for the delete action's presentation. Singleton/config
	// resources (e.g. Security Rate Limiting) map DELETE to a reversible
	// "Disable", not a hard row removal — the generic confirm ("delete \"Yes\"?
	// … cannot be undone") would be inaccurate there. When set, it replaces the
	// name-derived confirm text, the button tooltip, and (optionally) the icon.
	deleteConfirm?: {title: string; message: string; confirmLabel: string; tooltip?: string; icon?: 'delete' | 'block'};
	onRefresh?: () => void;
	// When the data fetch fails, callers pass error=true so the table shows a
	// "Couldn't load …" banner instead of a bare "No rows" that reads as an
	// empty resource. Retry reuses onRefresh.
	error?: boolean;
	defaultSort?: {field: string; sort: 'asc' | 'desc'};
}) {
	const {name, columns, rows, selected_rows, onChangeSelectedRows, hideMenuBar, hideCheckbox, hideIdColumn, disableSelect, onRefresh, error, defaultSort, deleteConfirm} = props;

	// RBAC: viewers are read-only everywhere, so hide the mutation
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
					: col.type === 'chip'
					? ChipCell
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

	// Derive a human-readable label for each selected row from its leftmost data
	// column, so the confirmation names what's being removed instead of the
	// anonymous "this Item" (which made it easy to confirm a wrong/bulk selection).
	const labelKey = columns[0]?.data_key;
	const rowLabel = (v: any): string => {
		if (v == null) return '';
		if (typeof v === 'object') return String(v.data ?? v.name ?? v.value ?? '');
		return String(v);
	};

	const handleDelete = (e: any) => {
		e.stopPropagation();

		// Caller-supplied wording for non-destructive/singleton semantics.
		if (deleteConfirm) {
			openPopUp(deleteConfirm.title, deleteConfirm.message, deleteConfirm.confirmLabel, t('Cancel'), onDelete);
			return;
		}

		const names = selected_rows
			.map(id => rows.find(r => r.id === id))
			.filter(Boolean)
			.map(r => rowLabel(r[labelKey!]).trim())
			.filter(n => n.length > 0);
		const count = selected_rows.length;

		let contents: ReactNode;
		if (count === 1 && names.length === 1) {
			contents = t('Are you sure you want to delete "{{name}}"? This action cannot be undone.', {name: names[0]});
		} else if (names.length > 0) {
			contents = (
				<Box>
					<Typography variant="body1">{t('Are you sure you want to delete these {{count}} items? This action cannot be undone.', {count})}</Typography>
					<Box component="ul" sx={{mt: 1, mb: 0, pl: 3}}>
						{names.map((n, i) => (
							<li key={i}>{n}</li>
						))}
					</Box>
				</Box>
			);
		} else {
			// Fallback: selection didn't resolve to a label (e.g. empty leftmost cell).
			contents = t('Are you sure you want to delete this Item? This action cannot be undone.');
		}

		openPopUp(t('WARNING!! Delete Item'), contents, t('Delete'), t('Cancel'), onDelete);
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
						<Tooltip title={deleteConfirm?.tooltip ?? t('Delete {{name}}', {name})} placement="top" arrow>
							<span>
								<IconButton disabled={selected_rows.length === 0} onClick={handleDelete}>
									{deleteConfirm?.icon === 'block' ? <BlockIcon /> : <DeleteIcon />}
								</IconButton>
							</span>
						</Tooltip>
					)}
				</Box>
			)}

			{error && (
				<Alert
					severity="error"
					sx={{width: '100%'}}
					action={
						onRefresh ? (
							<Button color="inherit" size="small" onClick={onRefresh}>
								{t('Retry')}
							</Button>
						) : undefined
					}
				>
					{t("Couldn't load {{name}}. The server returned an error.", {name})}
				</Alert>
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
