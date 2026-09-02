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
import {formatBytes} from 'common';
import {IDataTableColumnDef} from 'types/global';
import {ILog, ILogArchiveInfo} from 'types/log';
import PageStateBanner from 'components/state/PageStateBanner';
import {PageDataState} from 'components/state/pageState';
import {
	TIME_RANGE_PRESETS,
	TimeRangePreset,
	sortLogsNewestFirst,
	toConsoleRow,
	visibleLogLevels,
} from 'components/table/dashboard/logTableLogic';

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
	archiveInfo?: ILogArchiveInfo[];
	keywordSearchedWholeFile: boolean;
	totalSize: number;
	scannedBytes: number;
	hasMore: boolean;
	isLoadingMore: boolean;
	handleLoadMore: () => void;
	handleRefresh: () => void;
	resetFilters: () => void;
	dense?: boolean;
	/** What the log read is actually showing right now. */
	state?: PageDataState<unknown>;
}

export default function LogConsole(props: LogConsoleProps) {
	const {
		logs, loadedCount, levelCounts, keyword, applyKeyword,
		selectedLevel, setSelectedLevel, preset, setPreset, customRange, setCustomRange,
		liveTail, toggleLiveTail, selectedFile, selectFile, archives, archiveInfo,
		keywordSearchedWholeFile, totalSize, scannedBytes,
		hasMore, isLoadingMore, handleLoadMore, handleRefresh, resetFilters, dense, state,
	} = props;

	// A read that failed must not reach the "No logs to display" line below —
	// that sentence claims the instance has nothing to say, which is a
	// statement about the instance rather than about the request.
	const read_failed = state?.kind === 'denied' || state?.kind === 'unavailable' || state?.kind === 'failed';

	// Archive metadata, keyed by name. size_bytes is absent both on gateways that
	// predate archive_info and — currently — for zero-byte files, so a missing
	// value is rendered as unknown rather than as 0.
	const infoByName = useMemo(() => {
		const map = new Map<string, ILogArchiveInfo>();
		for (const entry of archiveInfo ?? []) if (entry.name) map.set(entry.name, entry);
		return map;
	}, [archiveInfo]);

	const describeArchive = (name: string) => {
		const info = infoByName.get(name);
		if (!info) return name;
		const parts: string[] = [];
		if (typeof info.size_bytes === 'number') parts.push(formatBytes(info.size_bytes));
		if (info.modified) parts.push(new Date(info.modified).toLocaleString());
		return parts.length ? `${name} · ${parts.join(' · ')}` : name;
	};

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

	// countLogsByLevel keys on the upper-cased level, so the selection has to be
	// compared in the same case to line up with it.
	const selectedUpper = selectedLevel.toUpperCase();
	const levelsToShow = visibleLogLevels(levelCounts, selectedLevel);

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
							{/* .gz archives are selectable: the gateway inflates them before
							    paging. They used to be disabled here because the endpoint
							    served the compressed bytes raw and the table silently came
							    back empty. */}
							{archives.map(name => (
								<MenuItem key={name} value={name}>{describeArchive(name)}</MenuItem>
							))}
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
						label={`${level} ${levelCounts[level] ?? 0}`}
						color={LEVEL_COLOR[level] ?? 'default'}
						variant={selectedUpper === level ? 'filled' : 'outlined'}
						onClick={() => setSelectedLevel(selectedUpper === level ? '' : level)}
					/>
				))}
				{levelsToShow.length === 0 && (
					<Typography variant="caption" color="text.secondary">{t('No log lines loaded yet')}</Typography>
				)}

				<Box flexGrow={1} />

				{/* The honesty line, and it has to distinguish two different scopes.
				    A keyword is executed by the gateway across the whole file, so
				    those results are complete and `has_more` means more matches
				    remain. Level and time range are applied here over the lines
				    already paged in — that is the case where "there are 3 errors"
				    would really mean "3 in the part I have read". */}
				<Typography variant="caption" color="text.secondary">
					{keywordSearchedWholeFile
						? hasMore
							? t('Searched {{scanned}} of {{total}} — more matches remain', {
									scanned: formatBytes(scannedBytes),
									total: formatBytes(totalSize),
								})
							: t('Searched the whole log ({{total}})', {total: formatBytes(totalSize)})
						: t('Filtering {{count}} loaded lines', {count: loadedCount}) +
							(hasMore ? ` — ${t('load more to search further back')}` : '')}
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

			{/* Above the lines, not instead of them: on `stale` the console keeps
			    everything already paged in and says only that it is not current. */}
			{state && state.kind !== 'empty' && <PageStateBanner state={state} name={t('Instance Logs')} onRetry={handleRefresh} />}

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
			) : read_failed ? null : (
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
