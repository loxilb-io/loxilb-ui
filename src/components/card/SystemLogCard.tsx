//---------------------------------------------------------
// System Log Card — the dashboard's view of the instance log console.
//
// Layout and behaviour live in LogConsole; this only supplies the data. The
// card and the Status > Logs page used to carry two copies of the same filter
// and pagination code, so every bug in it existed twice.
//---------------------------------------------------------
import ScrollableBox from 'components/layout/ScrollableBox';
import LogConsole from 'components/log/LogConsole';
import {Stack, Typography} from '@mui/material';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useInstanceLogArchives} from 'hooks/query/instanceHook';
import {useRole} from 'hooks/query/oamHooks';
import {useInstanceLogPaging} from 'hooks/useInstanceLogPaging';
import {useTranslation} from 'react-i18next';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
// The log is served to operators and administrators only. For any other role
// the console is not mounted at all: its two reads would be refused on every
// poll, and the card would be a permanent error on a dashboard that is fine.
export default function SystemLogCard() {
	const {t} = useTranslation();
	const {role, can_read_instance_logs} = useRole();
	// Role not known yet: send nothing rather than a request that may be refused.
	if (role === null) return null;
	if (!can_read_instance_logs) {
		return (
			<Stack data-testid="system-log-not-permitted" role="status" width="100%" height="100%" alignItems="center" justifyContent="center" padding="16px" className="no-drag">
				<Typography variant="body2" color="text.secondary" sx={{textAlign: 'center'}}>
					{t('Instance logs are available to operators and administrators.')}
				</Typography>
			</Stack>
		);
	}
	return <SystemLogConsole />;
}

function SystemLogConsole() {
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
