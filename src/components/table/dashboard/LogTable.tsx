//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack, Typography} from '@mui/material';
import DateTimeRangeSelector from 'components/element/DateTimeRangeSelector';
import DataTable from 'components/table/DataTable';
import {t} from 'i18next';
import {useEffect, useMemo, useState} from 'react';
import {IDataTableColumnDef} from 'types/global';
import {ILog} from 'types/log';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function LogTable(props: {data: ILog[]; selected_rows: number[]; onChangeSelectedRows: any}) {
	const {data, selected_rows, onChangeSelectedRows} = props;

	const [startDatetimeStr, setStartDatetimeStr] = useState<string>('');
	const [endDatetimeStr, setEndDatetimeStr] = useState<string>('');

	const cols: IDataTableColumnDef[] = [
		{data_key: 'timestamp', header: 'Date Time', width: 'wide'},
		{data_key: 'level', header: 'Level', type: 'log-level', width: 'medium'},
		// {data_key: 'programname', header: 'Program', width: 'medium'},
		{data_key: 'message', header: 'Message', width: 'full'},
	];

	const filteredData = useMemo(() => {
		// First, sort all data by timestamp descending (newest first)
		const sortedData = data.sort((a, b) => {
			try {
				const aTimestamp = a.timestamp.replace(/\//g, '-');
				const bTimestamp = b.timestamp.replace(/\//g, '-');
				const aDate = new Date(aTimestamp + 'Z');
				const bDate = new Date(bTimestamp + 'Z');
				return bDate.getTime() - aDate.getTime(); // Descending order (newest first)
			} catch (error) {
				return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
			}
		});

		// If no date filter is set, return sorted data
		if (!startDatetimeStr || !endDatetimeStr) return sortedData;

		// Apply date filtering if date range is selected
		const start = new Date(startDatetimeStr).getTime();
		const end = new Date(endDatetimeStr).getTime();

		return sortedData.filter(item => {
			try {
				// Handle UTC timestamp properly for filtering
				const timestamp = item.timestamp.replace(/\//g, '-');
				const utcDate = new Date(timestamp + 'Z');
				const ts = utcDate.getTime();
				return ts >= start && ts <= end;
			} catch (error) {
				// Fallback to original behavior
				const ts = new Date(item.timestamp).getTime();
				return ts >= start && ts <= end;
			}
		});
	}, [data, startDatetimeStr, endDatetimeStr]);

	const rows = filteredData.map((item, index) => {
		// Convert UTC timestamp to local timezone
		let date_time_str: string;
		try {
			// Handle format like "2025/08/17 09:00:00" as UTC
			const timestamp = item.timestamp.replace(/\//g, '-'); // Convert 2025/08/17 to 2025-08-17
			const utcDate = new Date(timestamp + 'Z'); // Add Z to explicitly mark as UTC
			date_time_str = utcDate.toLocaleString();
		} catch (error) {
			// Fallback to original behavior if parsing fails
			date_time_str = new Date(item.timestamp).toLocaleString();
		}
		
		return {
			id: index,
			timestamp: date_time_str,
			level: item.level, // Just show the level, not severity/level
			host: item.host,
			// programname: item.programname,
			message: item.message,
			// facility: item.facility,
		};
	});

	useEffect(() => {
		const now = new Date();
		const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		setStartDatetimeStr(oneWeekAgo.toISOString());
		setEndDatetimeStr(now.toISOString());
	}, []);

	return (
		<Stack spacing={2}>
			<Box display="flex" alignItems="center" gap="20px">
				<Typography variant="h6">{t('Logging Period')}</Typography>
				<DateTimeRangeSelector
					startLabel="Start Date"
					endLabel="End Date"
					set_start_datetime_str={setStartDatetimeStr}
					set_end_datetime_str={setEndDatetimeStr}
					start_datetime={startDatetimeStr}
					end_datetime={endDatetimeStr}
				/>
			</Box>

			{rows.length > 0 ? (
				<DataTable name={'Log'} columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} hideMenuBar hideCheckbox />
			) : (
				<Typography variant="body2" color="text.secondary">
					{t('No logs in selected period')}
				</Typography>
			)}
		</Stack>
	);
}
