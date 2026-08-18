//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, Typography} from '@mui/material';
import DataTable from 'components/table/DataTable';
import {t} from 'i18next';
import {useMemo} from 'react';
import {IDataTableColumnDef} from 'types/global';
import {ILog} from 'types/log';
import {sortLogsNewestFirst, toLogRow} from './logTableLogic';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function LogTableDashboard(props: {data: ILog[]; selected_rows: number[]; onChangeSelectedRows: any}) {
	const {data, selected_rows, onChangeSelectedRows} = props;

	const cols: IDataTableColumnDef[] = [
		// super_wide, not wide: toLocaleString output runs to ~24 characters in
		// locales that spell out a meridiem (ko "2026. 8. 17. 오후 4:21:33"), which
		// overflowed the 180px `wide` column and truncated the time away entirely.
		{data_key: 'timestamp', header: 'Date Time', width: 'super_wide', type: 'mono'},
		{data_key: 'level', header: 'Level', type: 'log-level', width: 'medium'},
		// {data_key: 'programname', header: 'Program', width: 'medium'},
		{data_key: 'message', header: 'Message', width: 'full'},
	];

	// This card shows whatever the parent has paged in; it applies no period
	// window of its own. It previously seeded one ending at mount time, which
	// dropped every line written afterwards and blanked the card as the log grew.
	const rows = useMemo(() => sortLogsNewestFirst(data).map(toLogRow), [data]);

	return (
		<Stack spacing={2}>

			{rows.length > 0 ? (
				<div className="no-drag">
					<DataTable name={'Log'} columns={cols} rows={rows} selected_rows={selected_rows} onChangeSelectedRows={onChangeSelectedRows} hideMenuBar hideCheckbox />
				</div>
			) : (
				<Typography variant="body2" color="text.secondary">
					{t('No logs to display')}
				</Typography>
			)}
		</Stack>
	);
}
