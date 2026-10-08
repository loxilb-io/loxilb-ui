//---------------------------------------------------------
// Audit Trail: what the trail keeps, and where it is sent
//---------------------------------------------------------
// Three sections on one page: the retention and segment policy, the
// compliance sink, and the named sinks. The route admits administrators and
// operators (the management backend refuses a viewer every read here but the
// status); only an administrator may change anything, so an operator sees the
// same page without its buttons.
//
// The trail's health (writer, heartbeat, losses) stays on the System page.
import {Alert, Divider, Stack, Typography} from '@mui/material';
import {AuditComplianceSinkSection, AuditNamedSinksSection} from 'components/audit/AuditSinkSections';
import AuditPolicySection from 'components/audit/AuditPolicySection';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useRole} from 'hooks/query/oamHooks';
import {useGatewayAuditRest} from 'hooks/query/statusHook';
import {t} from 'i18next';
import {namedSinkNames} from 'types/audit_status';

export default function AuditPage() {
	const inst = useInstanceFromURL();
	const {is_admin} = useRole();
	// Rendered behind the flavor guard, which is the gate this read needs.
	// /audit/sink has its own read in the compliance section.
	const status = useGatewayAuditRest(inst, {readSink: false});
	if (!inst) return null;

	const read = status.isError ? undefined : status.data;
	if (read?.kind === 'absent') {
		return (
			<Stack spacing={2} padding={2} maxWidth={760}>
				<Typography variant="h6" component="h2">
					{t('Audit Trail')}
				</Typography>
				<Alert severity="info">{t('This gateway has no audit API, so there is nothing to configure here.')}</Alert>
			</Stack>
		);
	}

	const ok = read?.kind === 'ok' ? read.status : undefined;
	const onChanged = () => void status.refetch();
	return (
		<Stack spacing={3} padding={2} maxWidth={760}>
			<Typography variant="h6" component="h2">
				{t('Audit Trail')}
			</Typography>
			{!is_admin && (
				<Alert severity="info" data-testid="audit-read-only">
					{t('Changing what the audit trail keeps or where it is sent needs the administrator role. You can read the settings.')}
				</Alert>
			)}
			<AuditPolicySection instance={inst} writerAvailable={ok?.available} canWrite={is_admin} />
			<Divider />
			<AuditComplianceSinkSection instance={inst} canWrite={is_admin} onChanged={onChanged} />
			<Divider />
			<AuditNamedSinksSection instance={inst} names={ok ? namedSinkNames(ok) : undefined} canWrite={is_admin} onChanged={onChanged} />
		</Stack>
	);
}
