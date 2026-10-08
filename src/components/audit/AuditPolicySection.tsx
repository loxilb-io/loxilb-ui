//---------------------------------------------------------
// Audit Trail page: retention and segment policy
//---------------------------------------------------------
// The gateway holds the policy in memory only, and answers a write with 204
// and no body. So every change is followed by a read, and the page reports
// what that read says. A gateway with no audit writer answers the read with
// `{}`: that is "no policy", never "no limits".
import {Alert, Button, Stack, Typography} from '@mui/material';
import {PanelPaper, StatRow} from 'components/observability/panelLayout';
import QueryStateGate from 'components/state/QueryStateGate';
import {toPageState} from 'components/state/pageState';
import {opErrorText} from 'connector/fetcher/opResultText';
import {request_rotate_audit_segment, request_set_audit_policy} from 'connector/instance/audit';
import {usePopUp} from 'hooks/popupHook';
import {useAuditPolicy} from 'hooks/query/auditHooks';
import {t} from 'i18next';
import {useState} from 'react';
import {AUDIT_POLICY_FIELDS, AUDIT_POLICY_START, AuditPolicyValues, policyDiff, policyForm, policyReported, policyValues} from 'types/audit_config';
import {IInstance} from 'types/oam';
import {AuditPolicyDialog} from './AuditFormDialogs';
import {auditFieldLabel, reportAuditChange, reportTitle} from './auditText';

export interface AuditPolicySectionProps {
	instance: IInstance;
	/** From the status read: `false` when the gateway says it has no writer; `undefined` when it did not say. */
	writerAvailable: boolean | undefined;
	canWrite: boolean;
}

export default function AuditPolicySection({instance, writerAvailable, canWrite}: AuditPolicySectionProps) {
	const {openPopUp} = usePopUp();
	const query = useAuditPolicy(instance);
	const {refetch} = query;
	const [editing, setEditing] = useState<AuditPolicyValues | null>(null);

	// Resolves to true when the input should be kept (the dialog stays open).
	const save = async (values: AuditPolicyValues): Promise<boolean> => {
		const res = await request_set_audit_policy(instance, values);
		let readback: 'match' | 'unreadable' | string[] = 'unreadable';
		if (res.status === 'confirmed' || res.status === 'unknown') {
			const now = await refetch();
			if (!now.isError) {
				const diff = policyDiff(values, now.data);
				readback = diff.length === 0 ? 'match' : diff;
			}
		}
		const report = reportAuditChange(res, readback, t);
		if (!report.keepInput) setEditing(null);
		openPopUp(reportTitle(report, t), report.text, t('OK'));
		return report.keepInput;
	};

	const handleReset = () => {
		openPopUp(
			t('Reset to starting values'),
			t('This sends the values a gateway starts with: seal a segment at 64 MiB or after 24 hours, no retention limit, no free-space reserve, one deletion per pass. Segments already sealed are kept.'),
			t('Reset'),
			t('Cancel'),
			async () => {
				await save(AUDIT_POLICY_START);
			},
		);
	};

	const handleRotate = () => {
		openPopUp(
			t('Seal the segment now'),
			t('The segment being written is sealed and a new one is opened. Only sealed segments can be deleted by retention.'),
			t('Seal'),
			t('Cancel'),
			async () => {
				const res = await request_rotate_audit_segment(instance);
				if (res.status === 'confirmed') {
					openPopUp(
						t('Success'),
						t('Sealed segment {{sealed}}. The gateway now writes segment {{opened}}. These are the identifiers recorded in the trail.', {
							sealed: res.data?.sealed_segment_uuid || t('Not reported'),
							opened: res.data?.new_segment_uuid || t('Not reported'),
						}),
						t('OK'),
					);
				} else {
					openPopUp(res.status === 'unknown' ? t('Warning') : t('Error'), t('The segment was not confirmed sealed. {{error}}', {error: opErrorText(res)}), t('OK'));
				}
			},
		);
	};

	return (
		<Stack spacing={1.5} data-testid="audit-policy">
			<Typography variant="h6" component="h3">
				{t('Retention and segments')}
			</Typography>
			<QueryStateGate state={toPageState(query, {op: 'audit.get_policy', isEmpty: () => false})} name={t('audit policy')} onRetry={() => refetch()}>
				{(read, {stale}) => {
					if (!read) return null;
					if (writerAvailable === false || !policyReported(read)) {
						return (
							<Alert severity="error">
								{t('No audit writer is running on this gateway, so it has no policy to report and refuses every change to it. The values are unknown, not zero.')}
							</Alert>
						);
					}
					const values = policyValues(read);
					return (
						<Stack spacing={1.5}>
							<PanelPaper title={t('Policy the gateway holds now')}>
								{AUDIT_POLICY_FIELDS.map(field => (
									<StatRow key={field} label={auditFieldLabel(field, t)} value={values[field]} />
								))}
							</PanelPaper>
							<Typography variant="body2" color="text.secondary">
								{t('0 means no limit. The policy is held in memory only: a restart brings back what the gateway starts with, 64 MiB or 24 hours per segment and no retention limit. Apply it again after every start, and read it back.')}
							</Typography>
							{canWrite ? (
								<Stack direction="row" spacing={1} flexWrap="wrap">
									<Button variant="contained" onClick={() => setEditing(values)} disabled={stale}>
										{t('Change')}
									</Button>
									<Button variant="outlined" onClick={handleReset} disabled={stale}>
										{t('Reset to starting values')}
									</Button>
									<Button variant="outlined" onClick={handleRotate} disabled={stale}>
										{t('Seal the segment now')}
									</Button>
								</Stack>
							) : null}
						</Stack>
					);
				}}
			</QueryStateGate>
			{editing && <AuditPolicyDialog initial={policyForm(editing)} onCancel={() => setEditing(null)} onSave={save} />}
		</Stack>
	);
}
