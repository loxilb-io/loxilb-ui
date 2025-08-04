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
		{data_key: 'programname', header: 'Program', width: 'medium'},
		{data_key: 'message', header: 'Message', width: 'super_wide'},
	];

	const filteredData = useMemo(() => {
		if (!startDatetimeStr || !endDatetimeStr) return [];

		const start = new Date(startDatetimeStr).getTime();
		const end = new Date(endDatetimeStr).getTime();

		return data
			.filter(item => {
				const ts = new Date(item.timestamp).getTime();
				return ts >= start && ts <= end;
			})
			.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
	}, [data, startDatetimeStr, endDatetimeStr]);

	const rows = filteredData.map((item, index) => {
		const date_time_str = new Date(item.timestamp).toLocaleString();
		return {
			id: index,
			timestamp: date_time_str,
			level: `${item.severity}/${item.level}`,
			host: item.host,
			programname: item.programname,
			message: item.message,
			facility: item.facility,
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
