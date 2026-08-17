//---------------------------------------------------------
// Cursor pagination + filtering for the instance log endpoint.
//
// The dashboard card and the Status > Log page both drive the same gateway
// endpoint the same way. They used to hold two copies of this state machine,
// which meant every paging bug existed twice and was only ever fixed once.
//---------------------------------------------------------
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
	TimeRangePreset,
	countLogsByLevel,
	filterLogsByLevel,
	filterLogsByPeriod,
	resolvePresetRange,
} from 'components/table/dashboard/logTableLogic';
import {useInstanceLogs} from 'hooks/query/instanceHook';
import {IInstance} from 'types/oam';
import {ILog} from 'types/log';

export const LIVE_TAIL_INTERVAL_MS = 5000;

export function useInstanceLogPaging(inst: IInstance | null) {
	// Filter UI state
	const [selectedLevel, setSelectedLevel] = useState<string>('');
	const [keyword, setKeyword] = useState('');
	const [preset, setPreset] = useState<TimeRangePreset>('all');
	const [customRange, setCustomRange] = useState({start: '', end: ''});
	const [liveTail, setLiveTail] = useState(false);

	// Pagination state
	const [rawLogs, setRawLogs] = useState<ILog[]>([]);
	const [nextCursor, setNextCursor] = useState<string | undefined>();
	const [hasMore, setHasMore] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);

	// How much of the file the last response covered. A keyword search is now
	// executed across the whole file by the gateway, so these are what let the UI
	// say "searched all 880 KB" instead of hedging with "the lines I have loaded".
	const [coverage, setCoverage] = useState({totalSize: 0, scannedBytes: 0});

	// `reload_token` is part of the react-query key purely so an explicit
	// Refresh re-hits the gateway: the query is held at staleTime Infinity, so
	// without a key change a refresh is served from cache and appears to do
	// nothing. It is bumped only by handleRefresh — never from an effect. An
	// earlier version bumped a timestamp from an effect guarded on
	// "no rows loaded", which turned every empty result (an empty log, a keyword
	// matching nothing, unparseable lines) into an endless refetch loop.
	const [queryOptions, setQueryOptions] = useState({
		level: undefined as string | undefined, // Filtered client-side, never sent
		keyword: undefined as string | undefined,
		cursor: undefined as string | undefined,
		file: undefined as string | undefined,
		reload_token: 0,
		enableAutoRefresh: false,
	});

	const {data: log_response, isFetching} = useInstanceLogs(inst, queryOptions);

	// The response already folded into rawLogs. react-query hands back the same
	// object on every render, so without this the append branch would re-append
	// the same page whenever the effect re-ran for another reason.
	const applied_response = useRef<typeof log_response>(undefined);

	useEffect(() => {
		if (!log_response || applied_response.current === log_response) return;
		applied_response.current = log_response;

		const {logs, next_cursor, has_more} = log_response;

		if (queryOptions.cursor) setRawLogs(prev => [...prev, ...logs]);
		else setRawLogs(logs);

		setNextCursor(next_cursor);
		setHasMore(has_more || false);
		setIsLoadingMore(false);
		setCoverage(prev => ({
			totalSize: log_response.total_size ?? prev.totalSize,
			// Following a cursor continues the same backwards scan, so the bytes
			// examined accumulate across pages rather than replacing each other.
			scannedBytes: queryOptions.cursor
				? prev.scannedBytes + (log_response.scanned_bytes ?? 0)
				: log_response.scanned_bytes ?? 0,
		}));
	}, [log_response, queryOptions.cursor]);

	// A failed "load more" produces no response, so the button would otherwise
	// stay disabled for good.
	useEffect(() => {
		if (!isFetching) setIsLoadingMore(false);
	}, [isFetching]);

	// Applying a keyword restarts paging at the newest page. The loaded lines are
	// deliberately NOT cleared: when the requested filter matches the query
	// already in flight the key does not change, no new response arrives, and
	// clearing would leave the table permanently empty.
	const applyKeyword = useCallback((next_keyword: string) => {
		setQueryOptions(prev => ({
			...prev,
			level: undefined,
			keyword: next_keyword || undefined,
			cursor: undefined,
		}));
		setKeyword(next_keyword);
		setNextCursor(undefined);
		setHasMore(false);
	}, []);

	const handleLoadMore = useCallback(() => {
		if (!nextCursor || isLoadingMore) return;
		// Paging backwards and following the tail are contradictory: the tail
		// keeps resetting to the newest page. Reading history wins.
		setLiveTail(false);
		setIsLoadingMore(true);
		setQueryOptions(prev => ({...prev, cursor: nextCursor, enableAutoRefresh: false}));
	}, [nextCursor, isLoadingMore]);

	// Drop back to the newest page and force a round trip.
	const handleRefresh = useCallback(() => {
		setNextCursor(undefined);
		setHasMore(false);
		setQueryOptions(prev => ({...prev, cursor: undefined, reload_token: prev.reload_token + 1}));
	}, []);

	// Following the tail only makes sense on the newest page, so enabling it
	// rewinds any paging the operator had done.
	//
	// The next value is computed outside the updaters on purpose: queueing
	// setQueryOptions from inside a setLiveTail updater made the toggle flip
	// visually while the polling flag never reached the query, so Live looked
	// enabled and nothing refreshed. State updaters have to stay pure.
	const toggleLiveTail = useCallback(() => {
		const next = !liveTail;
		setLiveTail(next);
		if (next) {
			setNextCursor(undefined);
			setHasMore(false);
		}
		setQueryOptions(prev => ({...prev, cursor: undefined, enableAutoRefresh: next}));
	}, [liveTail]);

	// Read a rotated file instead of the live one. Selecting an archive stops the
	// tail — an archive does not grow.
	const selectFile = useCallback((file: string) => {
		setLiveTail(false);
		setNextCursor(undefined);
		setHasMore(false);
		setQueryOptions(prev => ({
			...prev,
			file: file || undefined,
			cursor: undefined,
			enableAutoRefresh: false,
			reload_token: prev.reload_token + 1,
		}));
	}, []);

	// One control that puts every filter back to its default, which the three
	// separate per-filter clears never added up to.
	const resetFilters = useCallback(() => {
		setSelectedLevel('');
		setPreset('all');
		setCustomRange({start: '', end: ''});
		applyKeyword('');
	}, [applyKeyword]);

	// Deliberately not memoised: the window is resolved against the clock on
	// every render so a sliding preset keeps sliding. Memoising it would pin the
	// window to whenever the deps last changed — the same freeze that made the
	// original card hide every line written after it mounted. Filtering a few
	// thousand strings costs far less than getting this wrong.
	const {start, end} = resolvePresetRange(preset, Date.now(), customRange);

	// Period first, then counts, then level: the counts describe the window the
	// operator is looking at, and clicking one narrows within that same window.
	const logsInPeriod = useMemo(() => filterLogsByPeriod(rawLogs, start, end), [rawLogs, start, end]);
	const levelCounts = useMemo(() => countLogsByLevel(logsInPeriod), [logsInPeriod]);
	const logs = useMemo(() => filterLogsByLevel(logsInPeriod, selectedLevel), [logsInPeriod, selectedLevel]);

	return {
		logs,
		loadedCount: rawLogs.length,
		levelCounts,
		// A keyword is executed server-side across the whole file; level and time
		// range are applied here over what has been paged in. The console reports
		// those two scopes differently, because conflating them is what let the old
		// UI imply it had searched everything.
		keywordSearchedWholeFile: !!queryOptions.keyword,
		totalSize: coverage.totalSize,
		scannedBytes: coverage.scannedBytes,
		keyword,
		applyKeyword,
		selectedLevel,
		setSelectedLevel,
		preset,
		setPreset,
		customRange,
		setCustomRange,
		liveTail,
		toggleLiveTail,
		selectedFile: queryOptions.file ?? '',
		selectFile,
		hasMore,
		isLoadingMore,
		isFetching,
		handleLoadMore,
		handleRefresh,
		resetFilters,
	};
}
