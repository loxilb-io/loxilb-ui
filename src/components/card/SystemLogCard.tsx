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
	CircularProgress,
	Typography,
	Divider
} from '@mui/material';
import {
	Refresh as RefreshIcon,
	KeyboardArrowDown as MoreIcon
} from '@mui/icons-material';
import LogTable from 'components/table/dashboard/LogTable';
import {t} from 'i18next';
import {useState, useCallback, useMemo, useEffect} from 'react';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useInstanceLogArchives, useInstanceLogs} from 'hooks/query/instanceHook';
import {ILog, LevelTypeList} from 'types/log';
import CardBase from './CardBase';
import ScrollableBox from 'components/layout/ScrollableBox';
import ArchivedLogCard from './ArchivedLogCard';
import { download_inst_log_archive } from 'connector/instance/status';
import LogTableDashboard from 'components/table/dashboard/LogTableDashboard';

//---------------------------------------------------------
// Enhanced System Log Card Component
//---------------------------------------------------------
export default function SystemLogCard() {
	const inst = useInstanceFromURL();
		const [selected_rows, set_selected_rows] = useState<number[]>([]);
	
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
		const {data: log_archives} = useInstanceLogArchives(inst);
		const log_file_list = log_archives?.archives.map((filename: string, idx: number) => ({id: idx, filename})) ?? [];
	
		return (
			<ScrollableBox>
				<Stack position="relative" id="fixed-container" width="100%" height="100%" spacing={3} padding="16px">
	
					{/* Log Filters - Aligned with LogTable */}
					<Stack spacing={2}>
						{/* Filter Controls Row */}
						<Box display="flex" alignItems="center" gap="20px" flexWrap="wrap">
							<Typography variant="h6">{t('Log Filters')}</Typography>
							
							{/* Log Level Filter */}
							<FormControl size="small" sx={{ minWidth: 120 }}>
								<InputLabel>{t('Level')}</InputLabel>
								<Select
									value={selectedLevel}
									label={t('Level')}
									onChange={(e) => setSelectedLevel(e.target.value)}
								>
									<MenuItem value="">{t('All Levels')}</MenuItem>
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
								label={t('Search Keyword')}
								value={localKeyword}
								onChange={(e) => setLocalKeyword(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
								sx={{ minWidth: 200 }}
							/>
	
							{/* Action Buttons */}
							<Button variant="contained" onClick={handleApplyFilters} size="small">
								{t('Apply Filters')}
							</Button>
	
							<Button variant="outlined" onClick={handleClearFilters} size="small">
								{t('Clear Filters')}
							</Button>
	
							<Tooltip title={t('Refresh Logs')}>
								<IconButton onClick={handleRefresh} size="small">
									<RefreshIcon />
								</IconButton>
							</Tooltip>
						</Box>
	
						{/* Status Info */}
						<Box display="flex" gap="8px" flexWrap="wrap">
							<Chip 
								label={`${allLogs.length} ${t('logs loaded')}`} 
								size="small" 
								color="primary" 
								variant="outlined" 
							/>
							{hasMore && (
								<Chip 
									label={t('More logs available')} 
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
					</Stack>
	
					<LogTableDashboard data={allLogs} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} />
				</Stack>
			</ScrollableBox>
		);
	}
	