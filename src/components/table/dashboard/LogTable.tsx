//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack, Typography} from '@mui/material';
import DateTimeRangeSelector from 'components/element/DateTimeRangeSelector';
import DataTable from 'components/table/DataTable';
import {t} from 'i18next';
import {useMemo, useState} from 'react';
import {IDataTableColumnDef} from 'types/global';
import {ILog} from 'types/log';
import {filterLogsByPeriod, sortLogsNewestFirst, toLogRow} from './logTableLogic';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function LogTable(props: {data: ILog[]; selected_rows: number[]; onChangeSelectedRows: any}) {
	const {data, selected_rows, onChangeSelectedRows} = props;

	const [startDatetimeStr, setStartDatetimeStr] = useState<string>('');
	const [endDatetimeStr, setEndDatetimeStr] = useState<string>('');

	const cols: IDataTableColumnDef[] = [
		// super_wide, not wide: toLocaleString output runs to ~24 characters in
		// locales that spell out a meridiem (ko "2026. 8. 17. 오후 4:21:33"), which
		// overflowed the 180px `wide` column and truncated the time away entirely.
		{data_key: 'timestamp', header: 'Date Time', width: 'super_wide', type: 'mono'},
		{data_key: 'level', header: 'Level', type: 'log-level', width: 'medium'},
		// {data_key: 'programname', header: 'Program', width: 'medium'},
		{data_key: 'message', header: 'Message', width: 'full'},
	];

	// No default range: the window used to be seeded with `end = now` at mount,
	// which silently dropped every line written after the table was rendered —
	// the table emptied itself as the log advanced. The range now stays unset
	// until the operator picks one, and an unset range filters nothing.
	const rows = useMemo(
		() => filterLogsByPeriod(sortLogsNewestFirst(data), startDatetimeStr, endDatetimeStr).map(toLogRow),
		[data, startDatetimeStr, endDatetimeStr],
	);

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
					{startDatetimeStr || endDatetimeStr ? t('No logs in selected period') : t('No logs to display')}
				</Typography>
			)}
		</Stack>
	);
}
