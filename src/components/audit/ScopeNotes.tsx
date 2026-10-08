//---------------------------------------------------------
// What each page is, and is not, a record of
//---------------------------------------------------------
// Logs and log archives are operational logs. The audit trail is a separate
// record with its own files and its own way out of the gateway, so each page
// that could be taken for the other says which one it is.
//---------------------------------------------------------
import {Typography} from '@mui/material';
import {t} from 'i18next';
import React from 'react';

function Note(props: {testId: string; children: React.ReactNode}) {
	return (
		<Typography variant="body2" color="text.secondary" data-testid={props.testId}>
			{props.children}
		</Typography>
	);
}

/** On an instance's Logs page: the gateway's own log and its archives. */
export function InstanceLogScopeNote() {
	return (
		<Note testId="instance-log-scope">
			{t(
				'These are the operational logs of this gateway and their archives. They are not the audit trail: audit records are kept in separate files on the gateway and sent to the audit sinks, which are set under Maintenance, Audit Trail.',
			)}
		</Note>
	);
}

/** On the System page: the management service's own log and its archives. */
export function OamLogScopeNote() {
	return (
		<Note testId="oam-log-scope">
			{t('The log below and the archived logs on this page are the operational logs of the management service (OAM). They are not the audit trail of any gateway.')}
		</Note>
	);
}

/** On the Audit Trail page: which of the three paths this page is about. */
export function AuditPathsNote() {
	return (
		<Note testId="audit-paths">
			{t(
				'Three paths are separate. Management requests reach the gateway through OAM. Inference traffic goes from clients through the gateway to the backends. Audit records go from the audit files on the gateway to the sinks. This page sets the third only. A sink that is sending does not prove that a collector received a record, and it does not change what the policy keeps.',
			)}
		</Note>
	);
}
