//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Divider, Stack, Typography} from '@mui/material';
import ArchivedLogCard from 'components/card/ArchivedLogCard';
import ScrollableBox from 'components/layout/ScrollableBox';
import LogConsole from 'components/log/LogConsole';
import {download_inst_log_archive} from 'connector/instance/status';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useInstanceLogArchives} from 'hooks/query/instanceHook';
import {useInstanceLogPaging} from 'hooks/useInstanceLogPaging';
import {t} from 'i18next';

export default function LogPage() {
	const inst = useInstanceFromURL();
	const paging = useInstanceLogPaging(inst);

	const {data: log_archives} = useInstanceLogArchives(inst);
	const archives = log_archives?.archives ?? [];
	const log_file_list = archives.map((filename: string, idx: number) => ({id: idx, filename}));

	return (
		<ScrollableBox>
			<Stack position="relative" id="fixed-container" width="100%" height="100%" spacing={3} padding="16px">
				<Typography variant="h5">{t('Instance Logs')}</Typography>

				<LogConsole {...paging} archives={archives} />

				<Divider />

				{/* Downloads stay separate from the console's file picker: one is for
				    pulling an archive off the box, the other for reading it here. */}
				<Box maxWidth="480px">
					<ArchivedLogCard
						log_file_list={log_file_list}
						onDownload={(filename, onProgress) => download_inst_log_archive(inst, filename, onProgress)}
					/>
				</Box>
			</Stack>
		</ScrollableBox>
	);
}
