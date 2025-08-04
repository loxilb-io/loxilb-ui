//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Divider, Stack, Typography} from '@mui/material';
import ArchivedLogCard from 'components/card/ArchivedLogCard';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import LowerSection from 'components/layout/LowerSection';
import ScrollableBox from 'components/layout/ScrollableBox';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import LogTable from 'components/table/dashboard/LogTable';
import {download_inst_log_archive} from 'connector/instance/status';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useInstanceLogArchives, useInstanceLogs} from 'hooks/query/instanceHook';
import {t} from 'i18next';
import {useState} from 'react';
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
					{/*<SingleTextBox label={t('Host')} value={props.data.host} />
					<SingleTextBox label={t('Program')} value={props.data.programname} />
					<SingleTextBox label={t('Level')} value={`${props.data.level}/${props.data.severity}`} />
					<SingleTextBox label={t('Facility')} value={props.data.facility} />*/}
					<SingleTextBox label={t('Message')} value={props.data.message} />
				</ValueBunch>
			</Stack>
		</SubTitlePannel>
	);
}

export default function LogPage() {
	const inst = useInstanceFromURL();
	const [selected_rows, set_selected_rows] = useState<number[]>([]);

	const {data: log_list} = useInstanceLogs(inst);
	const {data: log_archives} = useInstanceLogArchives(inst);
	const log_file_list = log_archives?.archives.map((filename: string, idx: number) => ({id: idx, filename})) ?? [];

	return (
		<ScrollableBox>
			<Stack position="relative" id="fixed-container" width="100%" height="100%" spacing={3} padding="16px">
				<Typography variant="h5">{t('Instance Logs')}</Typography>

				<Box maxWidth="400px">
					<ArchivedLogCard log_file_list={log_file_list} onRowClick={(row: any) => download_inst_log_archive(inst, row.filename)} />
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
