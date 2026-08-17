//---------------------------------------------------------
// Instance log console.
//
// One toolbar, one severity strip, one table — shared by the dashboard card and
// the Status > Logs page so the two cannot drift apart again.
//
// The layout is built around what an operator does on arrival: see how bad it
// is (severity counts), narrow to a window (presets), then search. Everything
// applies as you touch it; there is no Apply step.
//---------------------------------------------------------
import {
	Box,
	Button,
	Chip,
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	Stack,
	TextField,
	ToggleButton,
	Tooltip,
	Typography,
} from '@mui/material';
import {Refresh as RefreshIcon, FiberManualRecord as LiveIcon} from '@mui/icons-material';
import DataTable from 'components/table/DataTable';
import DateTimeRangeSelector from 'components/element/DateTimeRangeSelector';
import {t} from 'i18next';
import {useEffect, useMemo, useState} from 'react';
import {IDataTableColumnDef} from 'types/global';
import {ILog} from 'types/log';
import {TIME_RANGE_PRESETS, TimeRangePreset, sortLogsNewestFirst, toConsoleRow} from 'components/table/dashboard/logTableLogic';

// Ordered worst-first so the eye lands on the levels that matter. Levels the
// gateway emits but that are absent here still appear — see extraLevels below —
// so a new severity can never become invisible.
const LEVEL_ORDER = ['CRITICAL', 'ERROR', 'WARNING', 'INFO', 'DEBUG'];

const LEVEL_COLOR: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
	CRITICAL: 'error',
	ERROR: 'error',
	WARNING: 'warning',
	INFO: 'info',
	DEBUG: 'default',
};

export interface LogConsoleProps {
	logs: ILog[];
	loadedCount: number;
	levelCounts: Record<string, number>;
	keyword: string;
	applyKeyword: (value: string) => void;
	selectedLevel: string;
	setSelectedLevel: (value: string) => void;
	preset: TimeRangePreset;
	setPreset: (value: TimeRangePreset) => void;
	customRange: {start: string; end: string};
	setCustomRange: (value: {start: string; end: string}) => void;
	liveTail: boolean;
	toggleLiveTail: () => void;
	selectedFile: string;
	selectFile: (file: string) => void;
	archives: string[];
	hasMore: boolean;
	isLoadingMore: boolean;
	handleLoadMore: () => void;
	handleRefresh: () => void;
	resetFilters: () => void;
	dense?: boolean;
}

export default function LogConsole(props: LogConsoleProps) {
	const {
		logs, loadedCount, levelCounts, keyword, applyKeyword,
		selectedLevel, setSelectedLevel, preset, setPreset, customRange, setCustomRange,
		liveTail, toggleLiveTail, selectedFile, selectFile, archives,
		hasMore, isLoadingMore, handleLoadMore, handleRefresh, resetFilters, dense,
	} = props;

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const [draftKeyword, setDraftKeyword] = useState(keyword);

	// Keep the box in step when the keyword is changed from outside (reset, or a
	// chip being dismissed) without fighting the operator mid-word.
	useEffect(() => {
		setDraftKeyword(keyword);
	}, [keyword]);

	// The keyword goes to the gateway, so it is debounced rather than sent on
	// every keystroke. This is what removes the Apply button.
	useEffect(() => {
		if (draftKeyword === keyword) return;
		const id = setTimeout(() => applyKeyword(draftKeyword), 400);
		return () => clearTimeout(id);
	}, [draftKeyword, keyword, applyKeyword]);

	const cols: IDataTableColumnDef[] = useMemo(() => {
		const base: IDataTableColumnDef[] = [
			{data_key: 'timestamp', header: 'Time', width: 'wide', type: 'mono'},
			{data_key: 'level', header: 'Level', width: 'medium', type: 'log-level'},
			{data_key: 'component', header: 'Component', width: 'medium', type: 'tag'},
		];
		// model/tenant only earn a column when the loaded lines actually carry
		// them — on a plain loxilb instance they never would.
		if (logs.some(l => /\bmodel=[^\s,]/.test(l.message))) {
			base.push({data_key: 'model', header: 'Model', width: 'medium', type: 'tag'});
		}
		if (logs.some(l => /\btenant=[^\s,]/.test(l.message))) {
			base.push({data_key: 'tenant', header: 'Tenant', width: 'medium', type: 'tag'});
		}
		base.push({data_key: 'message', header: 'Message', width: 'full'});
		return base;
	}, [logs]);

	const rows = useMemo(() => sortLogsNewestFirst(logs).map(toConsoleRow), [logs]);

	// Any level present in the data but missing from LEVEL_ORDER still gets a
	// chip, so an unexpected severity is never silently hidden.
	const extraLevels = Object.keys(levelCounts).filter(l => !LEVEL_ORDER.includes(l)).sort();
	const levelsToShow = [...LEVEL_ORDER, ...extraLevels].filter(l => levelCounts[l]);

	const filtersActive = !!(keyword || selectedLevel || preset !== 'all');

	return (
		<Stack spacing={1.5} width="100%" className="no-drag">

			{/* Toolbar: everything applies on touch */}
			<Box display="flex" alignItems="center" gap="10px" flexWrap="wrap">
				{/* describeChild keeps the button's accessible name as its visible text
				    ("Live") and demotes the hint to a description. Without it MUI
				    puts the tooltip sentence into aria-label, which overrides the
				    label a screen reader — or a test — would expect, and changes
				    every time the state flips. */}
				<Tooltip
					describeChild
					title={liveTail ? t('Stop following the log') : t('Follow the log as it is written')}
				>
					<ToggleButton
						value="live"
						selected={liveTail}
						onChange={toggleLiveTail}
						size="small"
						color="success"
						sx={{textTransform: 'none', gap: '6px', px: 1.2}}
					>
						<LiveIcon sx={{fontSize: 12}} />
						{t('Live')}
					</ToggleButton>
				</Tooltip>

				{/* labelId/id are required for MUI to associate the InputLabel with
				    the select: without them the control renders with no accessible
				    name at all. */}
				<FormControl size="small" sx={{minWidth: 140}}>
					<InputLabel id="log-time-range-label">{t('Time range')}</InputLabel>
					<Select
						labelId="log-time-range-label"
						id="log-time-range"
						value={preset}
						label={t('Time range')}
						onChange={e => setPreset(e.target.value as TimeRangePreset)}
					>
						{TIME_RANGE_PRESETS.map(p => (
							<MenuItem key={p.value} value={p.value}>{t(p.label)}</MenuItem>
						))}
					</Select>
				</FormControl>

				<TextField
					size="small"
					label={t('Search')}
					placeholder={t('Filter lines on the server')}
					value={draftKeyword}
					onChange={e => setDraftKeyword(e.target.value)}
					sx={{minWidth: 240, flexGrow: 1, maxWidth: 420}}
				/>

				{archives.length > 0 && (
					<FormControl size="small" sx={{minWidth: 180}}>
						<InputLabel id="log-file-label">{t('Log file')}</InputLabel>
						<Select
							labelId="log-file-label"
							id="log-file"
							value={selectedFile}
							label={t('Log file')}
							onChange={e => selectFile(e.target.value)}
						>
							<MenuItem value="">{t('Current log')}</MenuItem>
							{archives.map(name => {
								// The endpoint reads the file raw, so a gzipped archive comes
								// back as compressed bytes and parses to nothing. Offering it
								// as a selectable option would be a control that silently does
								// nothing; it stays listed, but disabled and labelled, and
								// remains downloadable from the archive card below.
								const compressed = name.endsWith('.gz');
								return (
									<MenuItem key={name} value={name} disabled={compressed}>
										{compressed ? `${name} — ${t('compressed, download to view')}` : name}
									</MenuItem>
								);
							})}
						</Select>
					</FormControl>
				)}

				<Tooltip title={t('Refresh Logs')}>
					<span>
						<Button onClick={handleRefresh} size="small" variant="outlined" sx={{minWidth: 40, px: 1}}>
							<RefreshIcon fontSize="small" />
						</Button>
					</span>
				</Tooltip>

				{filtersActive && (
					<Button onClick={resetFilters} size="small" variant="text">{t('Reset filters')}</Button>
				)}
			</Box>

			{/* Severity strip: answers "how bad is it" and filters on click */}
			<Box display="flex" alignItems="center" gap="8px" flexWrap="wrap">
				{levelsToShow.map(level => (
					<Chip
						key={level}
						size="small"
						label={`${level} ${levelCounts[level]}`}
						color={LEVEL_COLOR[level] ?? 'default'}
						variant={selectedLevel.toUpperCase() === level ? 'filled' : 'outlined'}
						onClick={() => setSelectedLevel(selectedLevel.toUpperCase() === level ? '' : level)}
					/>
				))}
				{levelsToShow.length === 0 && (
					<Typography variant="caption" color="text.secondary">{t('No log lines loaded yet')}</Typography>
				)}

				<Box flexGrow={1} />

				{/* The honesty line. Level and time filter only what has been paged
				    in, so saying so is the difference between "there are 3 errors"
				    and "there are 3 errors in the part I have read". */}
				<Typography variant="caption" color="text.secondary">
					{t('Filtering {{count}} loaded lines', {count: loadedCount})}
					{hasMore ? ` — ${t('load more to search further back')}` : ''}
				</Typography>
			</Box>

			{preset === 'custom' && (
				<Box>
					<DateTimeRangeSelector
						startLabel={t('Start Date')}
						endLabel={t('End Date')}
						start_datetime={customRange.start}
						end_datetime={customRange.end}
						set_start_datetime_str={(v: string) => setCustomRange({...customRange, start: v})}
						set_end_datetime_str={(v: string) => setCustomRange({...customRange, end: v})}
					/>
				</Box>
			)}

			{rows.length > 0 ? (
				<DataTable
					name="Log"
					columns={cols}
					rows={rows}
					selected_rows={selected_rows}
					onChangeSelectedRows={set_selected_rows}
					hideMenuBar
					hideCheckbox
					hideIdColumn
				/>
			) : (
				<Typography variant="body2" color="text.secondary" padding="8px 0">
					{filtersActive ? t('No lines match the current filters') : t('No logs to display')}
				</Typography>
			)}

			{hasMore && (
				<Box display="flex" justifyContent="center">
					<Button variant="outlined" onClick={handleLoadMore} disabled={isLoadingMore} size={dense ? 'small' : 'medium'}>
						{isLoadingMore ? t('Loading...') : t('Load older lines')}
					</Button>
				</Box>
			)}
		</Stack>
	);
}
