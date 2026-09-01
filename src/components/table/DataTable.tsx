//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import DeleteIcon from '@mui/icons-material/Delete';
import DensityMediumIcon from '@mui/icons-material/DensityMedium';
import DensitySmallIcon from '@mui/icons-material/DensitySmall';
import ModeIcon from '@mui/icons-material/Mode';
import RefreshIcon from '@mui/icons-material/Refresh';
import {Alert, Box, Button, Stack, Tooltip, Typography} from '@mui/material';
import {visuallyHidden} from '@mui/utils';
import {GridColDef, GridRowId, GridRowSelectionModel} from '@mui/x-data-grid';
import {
	BooleanCell,
	ChipCell,
	LinkCell,
	LogLevelCell,
	MonoCell,
	MultiLineCell,
	OnOffCell,
	StateAndNameCell,
	StateCell,
	StatusCell,
	SublineHeader,
	SyncCell,
	TagCell,
	TextCell,
	ToolTipHeader,
	UsageCell,
} from 'components/element/CustomGridCell';
import PageStateBanner from 'components/state/PageStateBanner';
import useLocalStorageState from 'hooks/localStorageHook';
import {DEFAULT_TABLE_DENSITY, PREFERENCE_KEYS, TableDensity, isTableDensity} from 'preferences';
import {usePopUp} from 'hooks/popupHook';
import {useRole} from 'hooks/query/oamHooks';
import {t} from 'i18next';
import {IDataTableColumnDef} from 'types/global';
import {PageDataState, createEnabled, writesEnabled} from 'components/state/pageState';
import {ReactNode, useId} from 'react';
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
	selected_rows: GridRowId[];
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
	//
	// `state` supersedes it for every caller driven by a read query (UI-P6-5):
	// a boolean cannot tell denied from unavailable, cannot say that the rows
	// on screen are last-known-good rather than current, and cannot carry the
	// write-guard that follows from not knowing. `error` stays for the callers
	// that are not page states at all — an action's own failure, a form field.
	// When both are supplied, `state` wins; they never stack two banners.
	state?: PageDataState<unknown>;
	error?: boolean;
	defaultSort?: {field: string; sort: 'asc' | 'desc'};
}) {
	const {name, columns, rows, selected_rows, onChangeSelectedRows, hideMenuBar, hideCheckbox, hideIdColumn, disableSelect, onRefresh, state, error, defaultSort, deleteConfirm} = props;

	// Stale data may be looked at, never acted on (task §2.3 / ES-14). Two
	// different questions, and they must not share one answer: Edit and Delete
	// target a SELECTED ROW, so rows we cannot vouch for make them unsafe,
	// while Add reads nothing off the table. Guarding Add with the row rule
	// took away the one action that still makes sense when a list will not
	// load — see createEnabled. Callers still on the legacy `error` boolean
	// are unaffected; it carries no such claim either way.
	const row_actions_ok = state ? writesEnabled(state) : true;
	const create_ok = state ? createEnabled(state) : true;
	// Reserved for the guard's explanation so the disabled buttons can point
	// at it; useId keeps it unique when several tables share one page.
	const guard_id = useId();
	// denied / unavailable / failed have no rows to show, and drawing the grid
	// over them puts "No {{name}} entries yet" under the banner — a failed
	// read rendered as a successful empty one, the defect this task closes.
	const hide_grid = state?.kind === 'denied' || state?.kind === 'unavailable' || state?.kind === 'failed';

	// Global density preference, shared by every table via localStorage
	// (comfortable 44px / compact 36px rows). useLocalStorageState's event bus
	// keeps all mounted tables in sync when one toggles.
	const [density, setDensity] = useLocalStorageState<TableDensity>(PREFERENCE_KEYS.tableDensity, DEFAULT_TABLE_DENSITY, isTableDensity);
	const is_compact = density === 'compact';

	// RBAC: viewers are read-only everywhere, so hide the mutation
	// buttons for them (UX only — the server rejects viewer writes with 403).
	// While the role is still loading (is_viewer false) buttons stay visible.
	const {is_viewer} = useRole();
	// A viewer never had the button; the write guard keeps it, disabled and
	// explained. Hiding it instead would read as "you are not allowed", which
	// is a different and wrong statement about a temporary data problem.
	const onAdd = is_viewer ? undefined : props.onAdd;
	const onEdit = is_viewer ? undefined : props.onEdit;
	const onDelete = is_viewer ? undefined : props.onDelete;
	const guard_reason = t('Unavailable while the data on screen is out of date.');
	// The accessible NAME stays resource-qualified ("Add Widget") — E2E
	// locators and screen-reader users both rely on it being stable — so the
	// reason arrives as a description instead of being folded into the label.
	const guard_needed = !row_actions_ok || !create_ok;
	const guard_props = (blocked: boolean) => (blocked ? {'aria-describedby': guard_id} : {});

	const handleRowSelectionChange = (selection: GridRowSelectionModel) => {
		// Preserve opaque string IDs. Coercing every ID through Number() makes
		// distinct Gateway rule identities collapse to NaN or a lossy hash.
		const indices: GridRowId[] = [...selection];
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
					: col.type === 'mono'
					? MonoCell
					: col.type === 'tag'
					? TagCell
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

	// Full-width like the dashboard: operator tables are data-dense, so extra
	// viewport turns into visible columns. Column widths stay fixed — on sparse
	// tables the row striping/hover just extends (AWS idiom).
	return (
		<Stack width="100%">
			{/* Labeled toolbar (AWS-console idiom): visible text + icon. Each
			    button's aria-label stays resource-qualified ("Add Load Balancer")
			    so E2E role queries for bare dialog buttons ("Add", exact) never
			    collide with the toolbar; the icon data-testids remain the
			    toolbarButton() locator hook. */}
			{hideMenuBar === true ? null : (
				<Box id="table-bar" width="100%" height="44px" display="flex" justifyContent="flex-end" alignItems="center" gap="4px" padding="0 8px" bgcolor="grey.100" borderRadius="8px 8px 0 0">
					<Tooltip title={is_compact ? t('Switch to comfortable rows') : t('Switch to compact rows')} placement="top" arrow>
						<span>
							<Button
								size="small"
								color="inherit"
								aria-label={is_compact ? t('Switch to comfortable rows') : t('Switch to compact rows')}
								onClick={() => setDensity(is_compact ? 'comfortable' : 'compact')}
								startIcon={is_compact ? <DensitySmallIcon /> : <DensityMediumIcon />}
								sx={{color: 'text.secondary'}}
							>
								{t('Density')}
							</Button>
						</span>
					</Tooltip>

					{onRefresh && (
						<Tooltip title={t('Refresh {{name}}', {name})} placement="top" arrow>
							<span>
								<Button size="small" color="inherit" aria-label={t('Refresh {{name}}', {name})} onClick={onRefresh} startIcon={<RefreshIcon />} sx={{color: 'text.secondary'}}>
									{t('Refresh')}
								</Button>
							</span>
						</Tooltip>
					)}

					{onEdit && (
						<Tooltip title={row_actions_ok ? t('Edit {{name}}', {name}) : guard_reason} placement="top" arrow>
							<span>
								<Button size="small" color="inherit" aria-label={t('Edit {{name}}', {name})} {...guard_props(!row_actions_ok)} disabled={!row_actions_ok || selected_rows.length !== 1} onClick={onEdit} startIcon={<ModeIcon />} sx={{color: 'text.secondary'}}>
									{t('Edit')}
								</Button>
							</span>
						</Tooltip>
					)}

					{onDelete && (
						<Tooltip title={row_actions_ok ? (deleteConfirm?.tooltip ?? t('Delete {{name}}', {name})) : guard_reason} placement="top" arrow>
							<span>
								<Button
									size="small"
									color="error"
									aria-label={deleteConfirm?.tooltip ?? t('Delete {{name}}', {name})}
									{...guard_props(!row_actions_ok)}
									disabled={!row_actions_ok || selected_rows.length === 0}
									onClick={handleDelete}
									startIcon={deleteConfirm?.icon === 'block' ? <BlockIcon /> : <DeleteIcon />}
								>
									{deleteConfirm?.icon === 'block' ? t('Disable') : t('Delete')}
								</Button>
							</span>
						</Tooltip>
					)}

					{onAdd && (
						<Tooltip title={create_ok ? t('Add {{name}}', {name}) : guard_reason} placement="top" arrow>
							<span>
								<Button size="small" variant="contained" color="primary" aria-label={t('Add {{name}}', {name})} {...guard_props(!create_ok)} disabled={!create_ok} onClick={onAdd} startIcon={<AddIcon />}>
									{t('Add')}
								</Button>
							</span>
						</Tooltip>
					)}
				</Box>
			)}

			{/* The disabled buttons' description. Rendered only while the guard
			    is on, so nothing references a missing id the rest of the time. */}
			{guard_needed && (
				<Box id={guard_id} sx={visuallyHidden}>
					{guard_reason}
				</Box>
			)}

			{/* The ES-10 live region for "this table is empty". It must live
			    HERE and not in the grid's own overlay: `.MuiDataGrid-main` is
			    role="grid", which may contain only row/rowgroup, so a
			    role="status" inside it is a critical aria-required-children
			    violation. The overlay keeps the visible message; this announces
			    it. */}
			{state?.kind === 'empty' && (
				<Box role="status" aria-live="polite" sx={visuallyHidden}>
					{t('No {{name}} entries yet', {name})}
				</Box>
			)}

			{state ? (
				// `empty` is handled by the grid's own overlay, in the middle of
				// the table where the rows would be, announced there as a live
				// region. Letting the banner say it too put the same sentence on
				// screen twice and gave the page two role="status" regions for
				// one fact — caught by this task's own suite.
				state.kind === 'empty' ? null : <PageStateBanner state={state} name={name} onRetry={onRefresh} />
			) : (
				error && (
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
				)
			)}

			{/* Tall enough for ~10 rows at 44px before internal scroll; the old
			    400px box left a large blank void under 5-row pages. */}
			{!hide_grid && (
				<Box width="100%" height="560px">
					<TableBase
						columns={cols}
						rows={rows}
						rowHeight={is_compact ? 36 : 44}
						rowSelectionModel={selected_rows}
						hideIdColumn={hideIdColumn}
						hideCheckbox={hideCheckbox}
						disableSelect={disableSelect}
						onSelectionChange={onChangeSelectedRows !== undefined ? handleRowSelectionChange : undefined}
						defaultSort={defaultSort}
						// Before the first response there is nothing to report about
						// the resource, so the overlay must not claim it is empty —
						// that is a statement about the server made before it spoke.
						emptyLabel={state?.kind === 'loading' ? t('Loading {{name}}...', {name}) : t('No {{name}} entries yet', {name})}
					/>
				</Box>
			)}
		</Stack>
	);
}
