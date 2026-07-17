//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import CircleIcon from '@mui/icons-material/Circle';
import {Box, Divider, Stack, Typography} from '@mui/material';
import ArchivedLogCard from 'components/card/ArchivedLogCard';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import LowerSection from 'components/layout/LowerSection';
import ScrollableBox from 'components/layout/ScrollableBox';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import LogTable from 'components/table/dashboard/LogTable';
import {download_oam_log_archive, request_health_check} from 'connector/oam/oam';
import {useOAMLogArchives, useOAMLogs} from 'hooks/query/oamHooks';
import {t} from 'i18next';
import {useEffect, useState} from 'react';
import {ILog} from 'types/log';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
function LogDetailPannel(props: {data: ILog}) {
	const date_time_str = new Date(props.data.timestamp).toLocaleString();

	return (
		<SubTitlePannel title={t('Log')} sub_title={date_time_str}>
			<Stack spacing={2}>
				<ValueBunch>
					<SingleTextBox label={t('Timestamp')} value={props.data.timestamp} />
					<SingleTextBox label={t('Message')} value={props.data.message} />
				</ValueBunch>
			</Stack>
		</SubTitlePannel>
	);
}

export default function SystemPage() {
	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const [is_online, set_is_online] = useState<boolean | undefined>(undefined);

	const get_status = async () => {
		const is_online = await request_health_check();
		set_is_online(is_online);
	};

	const renderServerState = (is_up: boolean) => {
		const cur_color = is_up ? 'success' : 'error';
		const state_msg = t(is_up ? 'Up' : 'Down');

		return (
			<Box height="100%" display="flex" alignItems="center" gap="5px">
				<CircleIcon color={cur_color} sx={{fontSize: '16px'}} />
				<Typography variant="body2" color={cur_color}>
					{state_msg}
				</Typography>
			</Box>
		);
	};

	const {data: log_list} = useOAMLogs();

	const {data: log_archives} = useOAMLogArchives();
	const log_file_list = log_archives?.archives.map((filename: string, idx: number) => ({id: idx, filename})) ?? [];

	useEffect(() => {
		get_status();
	}, []);

	return (
		<ScrollableBox>
			<Stack position="relative" id="fixed-container" width="100%" height="100%" spacing={3} padding="16px">
				<Typography variant="h5">{t('System')}</Typography>

				<Box width="100%" display="flex" alignItems="center" justifyContent="space-between" gap="20px">
					<Box display="flex" alignItems="center" gap="20px">
						<Typography variant="h6">{t('Health Status')}</Typography>
						{is_online !== undefined && renderServerState(is_online)}
					</Box>

					<ArchivedLogCard log_file_list={log_file_list} onRowClick={(row: any) => download_oam_log_archive(row.filename)} />
				</Box>

				<Divider />

				<LogTable data={log_list ?? []} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} />

				{selected_rows.length === 1 && log_list && (
					<LowerSection>
						<LogDetailPannel data={log_list[selected_rows[0]]} />
					</LowerSection>
				)}
			</Stack>
		</ScrollableBox>
	);
}
