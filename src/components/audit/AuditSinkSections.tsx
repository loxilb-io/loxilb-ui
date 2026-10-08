//---------------------------------------------------------
// Audit Trail page: the compliance sink and the named sinks
//---------------------------------------------------------
// The compliance sink receives every record; a named sink receives what its
// filter lets through. They are two models: a named sink has no `enabled` and
// no `connected`, and it has an enterprise number and a filter.
//
// A save or a delete is reported from one read made after it. For a delete
// that read is a single GET by name, and 404 is the confirmation.
import {Alert, Button, Stack, Typography} from '@mui/material';
import {UseQueryResult} from '@tanstack/react-query';
import {PanelPaper, StatRow} from 'components/observability/panelLayout';
import QueryStateGate from 'components/state/QueryStateGate';
import {toPageState} from 'components/state/pageState';
import {OpResult} from 'connector/fetcher/opResult';
import {query_get_audit_named_sink, request_delete_audit_named_sink, request_disable_audit_sink, request_put_audit_named_sink, request_set_audit_sink} from 'connector/instance/audit';
import {usePopUp} from 'hooks/popupHook';
import {useAuditNamedSinks, useAuditSink} from 'hooks/query/auditHooks';
import {t} from 'i18next';
import {useState} from 'react';
import {AUDIT_DEFAULT_FACILITY, AuditComplianceSinkWrite, AuditNamedSinkWrite, IAuditNamedSink, IAuditNamedSinkForm, namedSinkForm, sinkDiff} from 'types/audit_config';
import {IAuditSink} from 'types/audit_status';
import {IInstance} from 'types/oam';
import {AuditSinkDialog} from './AuditFormDialogs';
import {AuditReadback, reportAuditChange, reportTitle} from './auditText';

const text = (value: string | undefined): string => value || t('Not set');
const count = (value: number | undefined): number => value ?? 0;

function useReport() {
	const {openPopUp} = usePopUp();
	// Resolves to true when the input should be kept.
	return (res: OpResult, readback: AuditReadback): boolean => {
		const report = reportAuditChange(res, readback, t);
		openPopUp(reportTitle(report, t), report.text, t('OK'));
		return report.keepInput;
	};
}

const wasSent = (res: OpResult) => res.status === 'confirmed' || res.status === 'unknown';

function SharedRows({sink}: {sink: IAuditSink | IAuditNamedSink}) {
	return (
		<>
			<StatRow label={t('Receiver address (host:port)')} value={text(sink.address)} />
			<StatRow label={t('CA bundle path')} value={text(sink.ca_bundle_path)} />
			<StatRow label={t('Server name in the certificate')} value={sink.server_name || t('The host part of the address')} />
			<StatRow label={t('Client certificate path')} value={text(sink.client_cert_path)} />
			<StatRow label={t('Syslog facility')} value={sink.facility ? sink.facility : t('{{n}} (default)', {n: AUDIT_DEFAULT_FACILITY})} />
			<StatRow label={t('Largest message (bytes)')} value={sink.max_frame_bytes ? sink.max_frame_bytes : t('No limit')} />
		</>
	);
}

//---------------------------------------------------------
// Compliance sink
//---------------------------------------------------------

export function AuditComplianceSinkSection({instance, canWrite, onChanged}: {instance: IInstance; canWrite: boolean; onChanged: () => void}) {
	const {openPopUp} = usePopUp();
	const report = useReport();
	const query = useAuditSink(instance);
	const {refetch} = query;
	const [editing, setEditing] = useState<IAuditNamedSinkForm | null>(null);

	const save = async (body: AuditComplianceSinkWrite): Promise<boolean> => {
		const res = await request_set_audit_sink(instance, body);
		let readback: AuditReadback = 'unreadable';
		if (wasSent(res)) {
			const now = await refetch();
			if (!now.isError) {
				const diff = sinkDiff(body, now.data);
				readback = diff.length === 0 ? 'match' : diff;
			}
			onChanged();
		}
		const keep = report(res, readback);
		if (!keep) setEditing(null);
		return keep;
	};

	const handleDisable = () => {
		openPopUp(
			t('Stop the compliance sink'),
			t('With no compliance sink, no record leaves the gateway in full and the trail is local only. The sink\'s settings are dropped, not kept for later.'),
			t('Stop'),
			t('Cancel'),
			async () => {
				const res = await request_disable_audit_sink(instance);
				let readback: AuditReadback = 'unreadable';
				if (wasSent(res)) {
					const now = await refetch();
					// After a stop the gateway answers `{}`: `enabled` is absent, not false.
					if (!now.isError) readback = now.data?.enabled === true ? ['enabled'] : 'match';
					onChanged();
				}
				report(res, readback);
			},
		);
	};

	return (
		<Stack spacing={1.5} data-testid="audit-compliance-sink">
			<Typography variant="h6" component="h3">
				{t('Compliance sink')}
			</Typography>
			<QueryStateGate state={toPageState(query, {op: 'audit.get_sink', isEmpty: () => false})} name={t('compliance sink')} onRetry={() => refetch()}>
				{(sink, {stale}) => {
					if (!sink) return null;
					const enabled = sink.enabled === true;
					return (
						<Stack spacing={1.5}>
							{enabled ? (
								<PanelPaper title={t('Sink the gateway holds now')}>
									<SharedRows sink={sink} />
									{/* Not an alert: a sink that was just saved has no session until its first record. */}
									<StatRow label={t('Session established')} value={sink.connected === true ? t('Yes') : t('No')} />
									<StatRow label={t('Records written to the socket')} value={count(sink.submitted)} />
									<StatRow label={t('Records sent shortened')} value={count(sink.truncated)} />
									<StatRow label={t('Failed submissions')} value={count(sink.write_errors)} />
									<StatRow label={t('Last error')} value={sink.last_error || t('None')} />
								</PanelPaper>
							) : (
								<Alert severity="info">{t('No compliance sink is configured: no record leaves the gateway in full, and the trail is local only.')}</Alert>
							)}
							{enabled && (
								<Typography variant="body2" color="text.secondary">
									{t('The counters are since the sink was last saved. Records written to the socket is not a delivery count: the protocol carries no acknowledgement.')}
								</Typography>
							)}
							{canWrite ? (
								<Stack direction="row" spacing={1}>
									<Button variant="contained" onClick={() => setEditing(namedSinkForm('', sink))} disabled={stale}>
										{enabled ? t('Change') : t('Configure')}
									</Button>
									{enabled && (
										<Button variant="outlined" color="warning" onClick={handleDisable} disabled={stale}>
											{t('Stop')}
										</Button>
									)}
								</Stack>
							) : null}
						</Stack>
					);
				}}
			</QueryStateGate>
			{editing && <AuditSinkDialog kind="compliance" title={t('Compliance sink')} initial={editing} onCancel={() => setEditing(null)} onSave={save} />}
		</Stack>
	);
}

//---------------------------------------------------------
// Named sinks
//---------------------------------------------------------

function filterText(sink: IAuditNamedSink): string {
	const f = sink.filter;
	const parts: string[] = [];
	if (f?.streams?.length) parts.push(t('streams {{list}}', {list: f.streams.join(', ')}));
	if (f?.services?.length) parts.push(t('services {{list}}', {list: f.services.join(', ')}));
	if (f?.outcome) parts.push(t('outcome {{outcome}}', {outcome: f.outcome}));
	if ((f?.data_sample ?? 0) > 1) parts.push(t('one data record in {{n}}', {n: f!.data_sample}));
	return parts.length > 0 ? parts.join('; ') : t('None: every record');
}

function NamedSinkCard(props: {name: string; query: UseQueryResult<IAuditNamedSink | null>; canWrite: boolean; onEdit: (sink: IAuditNamedSink) => void; onDelete: () => void}) {
	const {name, query} = props;
	const sink = query.data;
	return (
		<Stack spacing={1} data-testid={`audit-named-sink-${name}`}>
			<PanelPaper title={name}>
				{query.isError ? (
					<Typography variant="body2" color="text.secondary">
						{t('This sink could not be read. Its settings are unknown, not empty.')}
					</Typography>
				) : sink === null ? (
					<Typography variant="body2" color="text.secondary">
						{t('The status lists this sink, but a read by name did not find it. Refresh.')}
					</Typography>
				) : sink === undefined ? (
					<Typography variant="body2" color="text.secondary">
						{t('Loading…')}
					</Typography>
				) : (
					<>
						<StatRow label={t('State')} value={sink.state || t('Not reported')} />
						<SharedRows sink={sink} />
						<StatRow label={t('Enterprise number')} value={sink.enterprise_number ?? t('Not reported')} />
						<StatRow label={t('Filter')} value={filterText(sink)} />
						<StatRow label={t('Records written to the socket')} value={count(sink.submitted)} />
						<StatRow label={t('Records the filter kept out')} value={count(sink.filtered)} />
						<StatRow label={t('Records passed over')} value={count(sink.poison)} />
						<StatRow label={t('Failed submissions')} value={count(sink.write_errors)} />
						<StatRow label={t('Segments retention removed unread')} value={count(sink.lag_drops)} />
						<StatRow label={t('Last error')} value={sink.last_error || t('None')} />
					</>
				)}
			</PanelPaper>
			{props.canWrite && (
				<Stack direction="row" spacing={1}>
					<Button size="small" variant="outlined" onClick={() => sink && props.onEdit(sink)} disabled={!sink || query.isError}>
						{t('Change')}
					</Button>
					<Button size="small" variant="outlined" color="warning" onClick={props.onDelete}>
						{t('Delete')}
					</Button>
				</Stack>
			)}
		</Stack>
	);
}

export interface AuditNamedSinksSectionProps {
	instance: IInstance;
	/**
	 * Names from the status list. `undefined`: the status could not say (the
	 * read failed, or the gateway predates the list).
	 */
	names: readonly string[] | undefined;
	canWrite: boolean;
	onChanged: () => void;
}

export function AuditNamedSinksSection({instance, names, canWrite, onChanged}: AuditNamedSinksSectionProps) {
	const {openPopUp} = usePopUp();
	const report = useReport();
	const queries = useAuditNamedSinks(instance, names ?? []);
	const [editing, setEditing] = useState<{form: IAuditNamedSinkForm; isNew: boolean} | null>(null);

	// One read by name, made after the change. `null` is "no such sink".
	const readOne = async (name: string): Promise<{ok: true; sink: IAuditNamedSink | null} | {ok: false}> => {
		try {
			return {ok: true, sink: await query_get_audit_named_sink(instance, name)};
		} catch {
			return {ok: false};
		}
	};

	const refresh = (name: string) => {
		const index = (names ?? []).indexOf(name);
		if (index >= 0) void queries[index]?.refetch();
		onChanged();
	};

	const save = async (name: string, body: AuditNamedSinkWrite): Promise<boolean> => {
		const res = await request_put_audit_named_sink(instance, name, body);
		let readback: AuditReadback = 'unreadable';
		if (wasSent(res)) {
			const now = await readOne(name);
			if (now.ok) {
				const diff = sinkDiff(body, now.sink ?? undefined);
				readback = diff.length === 0 ? 'match' : diff;
			}
			refresh(name);
		}
		const keep = report(res, readback);
		if (!keep) setEditing(null);
		return keep;
	};

	const handleDelete = (name: string) => {
		openPopUp(
			t('Delete the sink'),
			t('Sink {{name}} stops receiving records.', {name}),
			t('Delete'),
			t('Cancel'),
			async () => {
				const res = await request_delete_audit_named_sink(instance, name);
				let readback: AuditReadback = 'unreadable';
				if (wasSent(res)) {
					const now = await readOne(name);
					if (now.ok) readback = now.sink === null ? 'match' : ['enabled'];
					refresh(name);
				}
				report(res, readback);
			},
		);
	};

	return (
		<Stack spacing={1.5} data-testid="audit-named-sinks">
			<Typography variant="h6" component="h3">
				{t('Named sinks')}
			</Typography>
			{names === undefined ? (
				<Alert severity="warning">{t('The gateway\'s audit status did not list its sinks, so the named sinks are unknown, not none.')}</Alert>
			) : names.length === 0 ? (
				<Typography variant="body2" color="text.secondary">
					{t('No named sink is configured.')}
				</Typography>
			) : (
				names.map((name, i) => (
					<NamedSinkCard
						key={name}
						name={name}
						query={queries[i]}
						canWrite={canWrite}
						onEdit={sink => setEditing({form: namedSinkForm(name, sink), isNew: false})}
						onDelete={() => handleDelete(name)}
					/>
				))
			)}
			{canWrite && names !== undefined && (
				<Stack direction="row">
					<Button variant="contained" onClick={() => setEditing({form: namedSinkForm('', undefined), isNew: true})}>
						{t('Add a sink')}
					</Button>
				</Stack>
			)}
			{editing && (
				<AuditSinkDialog
					kind="named"
					title={editing.isNew ? t('Add a named sink') : t('Change sink {{name}}', {name: editing.form.name})}
					initial={editing.form}
					takenNames={editing.isNew ? names : undefined}
					onCancel={() => setEditing(null)}
					onSave={save}
				/>
			)}
		</Stack>
	);
}
