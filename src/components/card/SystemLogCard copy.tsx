//---------------------------------------------------------
// Enhanced System Log Card with Filtering and Pagination
//---------------------------------------------------------
import {
	Box,
	TextField,
	Select,
	MenuItem,
	FormControl,
	InputLabel,
	Button,
	Chip,
	Stack,
	IconButton,
	Tooltip,
	CircularProgress
} from '@mui/material';
import {
	Refresh as RefreshIcon,
	KeyboardArrowDown as MoreIcon
} from '@mui/icons-material';
import LogTable from 'components/table/dashboard/LogTable';
import {t} from 'i18next';
import {useState, useCallback, useMemo, useEffect} from 'react';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useInstanceLogs} from 'hooks/query/instanceHook';
import {ILog, LevelTypeList} from 'types/log';
import CardBase from './CardBase';

//---------------------------------------------------------
// Enhanced System Log Card Component
//---------------------------------------------------------
export default function SystemLogCard() {
	const inst = useInstanceFromURL();
	
	// Filter UI states
	const [selectedLevel, setSelectedLevel] = useState<string>('');
	const [keyword, setKeyword] = useState('');
	const [localKeyword, setLocalKeyword] = useState('');

	// Manual pagination states
	const [allLogs, setAllLogs] = useState<ILog[]>([]);
	const [nextCursor, setNextCursor] = useState<string | undefined>();
	const [hasMore, setHasMore] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);

	// API options for current request
	const [queryOptions, setQueryOptions] = useState({
		level: undefined as string | undefined, // Don't send level to API - client-side filtering
		keyword: undefined as string | undefined,
		cursor: undefined as string | undefined,
		enableAutoRefresh: false // Disable automatic background refetch
	});

	// Filter handlers
	const handleApplyFilters = useCallback(() => {
		setQueryOptions({
			level: undefined, // Don't send level to API - we'll filter client-side
			keyword: localKeyword || undefined,
			cursor: undefined, // Reset cursor for new search
			enableAutoRefresh: false
		});
		setKeyword(localKeyword);
		setRawLogs([]); // Clear raw logs
		setAllLogs([]); // Clear filtered logs
		setNextCursor(undefined);
		setHasMore(false);
	}, [localKeyword]);

	const handleClearFilters = useCallback(() => {
		setSelectedLevel('');
		setKeyword('');
		setLocalKeyword('');
		setQueryOptions({
			level: undefined,
			keyword: undefined,
			cursor: undefined,
			enableAutoRefresh: false
		});
		setRawLogs([]); // Clear raw logs
		setAllLogs([]); // Clear filtered logs
		setNextCursor(undefined);
		setHasMore(false);
	}, []);
	
	const {data: log_response, refetch} = useInstanceLogs(inst, queryOptions);
	
	// Store raw logs from API (before client-side filtering)
	const [rawLogs, setRawLogs] = useState<ILog[]>([]);

	// Trigger initial load on component mount
	useEffect(() => {
		if (inst && rawLogs.length === 0) {
			// Force initial query by setting a minimal query option change with timestamp
			setQueryOptions(prev => ({ 
				...prev, 
				// Add timestamp to force query even if other options are the same
				_timestamp: Date.now() 
			}));
		}
	}, [inst, rawLogs.length]);
	
	// Handle API response
	useEffect(() => {
		if (log_response) {
			const { logs, next_cursor, has_more } = log_response;
			
			if (queryOptions.cursor) {
				// Loading more - append to existing raw logs
				setRawLogs(prev => [...prev, ...logs]);
			} else {
				// New search - replace all raw logs
				setRawLogs(logs);
			}
			
			setNextCursor(next_cursor);
			setHasMore(has_more || false);
			setIsLoadingMore(false);
		}
	}, [log_response, queryOptions.cursor]);

	// Client-side filtering
	const filteredLogs = useMemo(() => {
		let filtered = rawLogs;
		
		// Filter by level if selected
		if (selectedLevel) {
			filtered = filtered.filter(log => 
				log.level.toLowerCase() === selectedLevel.toLowerCase()
			);
		}
		
		return filtered;
	}, [rawLogs, selectedLevel]);

	// Update allLogs when filtered logs change
	useEffect(() => {
		setAllLogs(filteredLogs);
	}, [filteredLogs]);

	// Handle load more
	const handleLoadMore = useCallback(() => {
		if (nextCursor && !isLoadingMore) {
			setIsLoadingMore(true);
			setQueryOptions(prev => ({ ...prev, cursor: nextCursor, enableAutoRefresh: false }));
		}
	}, [nextCursor, isLoadingMore]);

	// Handle refresh
	const handleRefresh = useCallback(() => {
		// Clear all state
		setRawLogs([]);
		setAllLogs([]);
		setNextCursor(undefined);
		setHasMore(false);
		
		// Reset query options to trigger a fresh initial load
		setQueryOptions({
			level: undefined,
			keyword: keyword || undefined, // Keep current keyword filter
			cursor: undefined, // Reset cursor for fresh start
			enableAutoRefresh: false
		});
	}, [keyword]);

	return (
		<CardBase title={t('System Logs')}>
			<Stack spacing={2}>
				{/* Compact Filter Controls */}
				<Box display="flex" alignItems="center" gap="8px" flexWrap="wrap">
					{/* Log Level Filter */}
					<FormControl size="small" sx={{ minWidth: 90 }}>
						<InputLabel>{t('Level')}</InputLabel>
						<Select
							value={selectedLevel}
							label={t('Level')}
							onChange={(e) => setSelectedLevel(e.target.value)}
						>
							<MenuItem value="">{t('All')}</MenuItem>
							{LevelTypeList.map(level => (
								<MenuItem key={level} value={level}>
									{level.toUpperCase()}
								</MenuItem>
							))}
						</Select>
					</FormControl>
					
					{/* Keyword Search */}
					<TextField
						size="small"
						label={t('Search')}
						value={localKeyword}
						onChange={(e) => setLocalKeyword(e.target.value)}
						onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
						sx={{ minWidth: 150 }}
					/>

					{/* Action Buttons */}
					<Button variant="contained" onClick={handleApplyFilters} size="small">
						{t('Apply')}
					</Button>

					<Button variant="outlined" onClick={handleClearFilters} size="small">
						{t('Clear')}
					</Button>

					<Tooltip title={t('Refresh Logs')}>
						<IconButton onClick={handleRefresh} size="small">
							<RefreshIcon />
						</IconButton>
					</Tooltip>
				</Box>
				
				{/* Status Info */}
				<Box display="flex" gap="4px" flexWrap="wrap">
					<Chip 
						label={`${allLogs.length} ${t('logs')}`} 
						size="small" 
						color="primary" 
						variant="outlined" 
					/>
					{hasMore && (
						<Chip 
							label={t('More available')} 
							size="small" 
							color="success" 
							variant="outlined" 
						/>
					)}
					{keyword && (
						<Chip 
							label={`${t('Keyword')}: ${keyword}`} 
							size="small" 
							color="info" 
							variant="filled"
							onDelete={() => {setKeyword(''); setLocalKeyword(''); handleApplyFilters();}}
						/>
					)}
					{selectedLevel && (
						<Chip 
							label={`${t('Level')}: ${selectedLevel.toUpperCase()}`} 
							size="small" 
							color="warning" 
							variant="filled"
							onDelete={() => {setSelectedLevel(''); handleApplyFilters();}}
						/>
					)}
				</Box>
				
				{/* Log Table using the enhanced LogTable component */}
				<Box sx={{ height: 400, overflow: 'hidden' }}>
					<LogTable 
						data={allLogs} 
						selected_rows={[]} 
						onChangeSelectedRows={() => {}} 
					/>
				</Box>
				
				{/* Load More Button */}
				{hasMore && (
					<Box display="flex" justifyContent="center">
						<Button
							variant="outlined"
							startIcon={isLoadingMore ? <CircularProgress size={16} /> : <MoreIcon />}
							onClick={handleLoadMore}
							disabled={isLoadingMore}
							size="small"
						>
							{isLoadingMore ? t('Loading...') : t('Load More')}
						</Button>
					</Box>
				)}
			</Stack>
		</CardBase>
	);
}
