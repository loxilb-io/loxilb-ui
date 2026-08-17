//---------------------------------------------------------
// System Log Card — the dashboard's view of the instance log console.
//
// Layout and behaviour live in LogConsole; this only supplies the data. The
// card and the Status > Logs page used to carry two copies of the same filter
// and pagination code, so every bug in it existed twice.
//---------------------------------------------------------
import ScrollableBox from 'components/layout/ScrollableBox';
import LogConsole from 'components/log/LogConsole';
import {Stack} from '@mui/material';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useInstanceLogArchives} from 'hooks/query/instanceHook';
import {useInstanceLogPaging} from 'hooks/useInstanceLogPaging';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SystemLogCard() {
	const inst = useInstanceFromURL();
	const paging = useInstanceLogPaging(inst);
	const {data: log_archives} = useInstanceLogArchives(inst);

	return (
		<ScrollableBox>
			<Stack position="relative" id="fixed-container" width="100%" height="100%" padding="16px" className="no-drag">
				<LogConsole
					{...paging}
					archives={log_archives?.archives ?? []}
					archiveInfo={log_archives?.archive_info}
					dense
				/>
			</Stack>
		</ScrollableBox>
	);
}
