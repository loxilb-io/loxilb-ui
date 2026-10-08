//---------------------------------------------------------
// Audit writer health (System page)
//---------------------------------------------------------
// The System page is OAM-level, so this section brings its own instance
// picker; the panel renders only for an instance whose flavor RESOLVED to
// the inference gateway and whose registry entry is applicable. See
// observability/auditWriter for what each value means and why liveness is
// judged from our own observations. The gateway's /audit REST read adds only
// what the metrics cannot say (types/audit_status.ts): a configured sink that
// is not sending, and the event id of the latest orphaned intent. A sink gets
// one line, joined by name from the status (its state) and the metrics (what
// it lost for good).

import {Alert, Box, MenuItem, Stack, TextField, Typography} from '@mui/material';
import type {TFunction} from 'i18next';
import FreshnessBadge from 'components/observability/FreshnessBadge';
import {StatRow} from 'components/observability/panelLayout';
import {useInstanceFlavorResolution} from 'hooks/query/flavorHook';
import {useInstances, useRole} from 'hooks/query/oamHooks';
import {useMetricsSnapshot} from 'hooks/query/observabilityHooks';
import {useGatewayAuditRest} from 'hooks/query/statusHook';
import useLocalStorageState from 'hooks/localStorageHook';
import {PREFERENCE_KEYS, isStringPreference} from 'preferences';
import {useMemo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {AuditWriterReport, HeartbeatLiveness, IAuditSinkLoss, IAuditStreamDrops, IHeartbeatTrack, auditWriter, heartbeatLiveness, trackHeartbeat} from 'observability/auditWriter';
import {isEntryApplicable} from 'observability/capabilityRegistry';
import {AUDIT_COMPLIANCE_SINK, AuditRestSignals, IAuditSinkSignal, auditRestSignals} from 'types/audit_status';
import {IInstance} from 'types/oam';
import {AUDIT_SINK_READER_ROLES} from 'types/role';

function streamLabel(stream: string, t: TFunction): string {
	if (stream === 'mgmt') return t('Management');
	if (stream === 'data') return t('Data');
	if (stream === 'audit_system') return t('Audit system');
	return stream;
}

function counterLabel(key: string, t: TFunction): string {
	switch (key) {
		case 'loxilb_audit_writer_restarts_total':
			return t('Writer restarts');
		case 'loxilb_audit_writer_panics_total':
			return t('Writer panics');
		case 'loxilb_audit_write_failures_total':
			return t('Append failures');
		case 'loxilb_audit_sync_failures_total':
			return t('Sync (fsync) failures');
		case 'loxilb_audit_result_write_failures_total':
			return t('Management results lost after the change applied');
		case 'loxilb_audit_mgmt_timeouts_total':
			return t('Management writes past the request deadline');
		case 'loxilb_audit_segment_seal_failures_total':
			return t('Segment seal failures');
		case 'loxilb_audit_records_unattributed_total':
			return t('Records without a producer identity');
		case 'loxilb_audit_orphaned_intents_total':
			return t('Orphaned intents from the previous boot');
		case 'loxilb_audit_originator_dropped_total':
			return t('Unparseable originator headers dropped');
		case 'loxilb_audit_records_lost_to_retention_total':
			return t('Records deleted by retention before every sink was sent them');
		default:
			return key;
	}
}

function livenessText(l: HeartbeatLiveness, t: TFunction): string {
	switch (l.kind) {
		case 'advancing':
			return t('Advancing');
		case 'watching':
			return t('No change seen yet ({{s}} s observed)', {s: Math.round(l.observedMs / 1000)});
		case 'stalled':
			return t('Not advancing for at least {{s}} s', {s: Math.round(l.sinceMs / 1000)});
		case 'never':
			return t('None since start');
		default:
			return t('N/A');
	}
}

// One stream's drops, never summed with another stream's.
function dropText(d: IAuditStreamDrops, t: TFunction): string {
	const total = d.total === undefined ? t('not reported') : String(d.total);
	const by = d.by.length > 0 ? ` (${d.by.map(r => `${r.reason} ${r.total}`).join(', ')})` : '';
	return `${streamLabel(d.stream, t)} ${total}${by}`;
}

export interface AuditWriterPanelProps {
	report: AuditWriterReport;
	liveness: HeartbeatLiveness;
	/** The /audit REST signals; absent or `none` adds nothing. */
	rest?: AuditRestSignals;
}

const ORPHAN_KEY = 'loxilb_audit_orphaned_intents_total';

/** One sink's line: its state from the status, its losses from both sources. */
interface ISinkLine extends IAuditSinkSignal {
	poison: number;
}

// The status lists sinks in the gateway's order (compliance first), so that
// order is kept; a sink only the metrics name follows. Both sources count
// retention overtaking a sink, from the same counter read at two moments: the
// larger is the later, and adding them would count each loss twice.
function sinkLines(rest: AuditRestSignals | undefined, losses: IAuditSinkLoss[]): ISinkLine[] {
	const lines: ISinkLine[] = (rest?.kind === 'ok' ? (rest.sinks ?? []) : []).map(s => ({...s, poison: 0}));
	for (const loss of losses) {
		const line = lines.find(l => l.name === loss.name);
		if (line) {
			line.poison = loss.poison;
			line.lagDrops = Math.max(line.lagDrops, loss.lagDrops);
		} else {
			lines.push({name: loss.name, compliance: loss.name === AUDIT_COMPLIANCE_SINK, lagDrops: loss.lagDrops, poison: loss.poison, writeErrors: 0});
		}
	}
	return lines;
}

function sinkSubject(line: ISinkLine, t: TFunction): string {
	if (!line.compliance) return t('Audit sink {{name}}', {name: line.name});
	return line.address ? t('The compliance audit sink {{address}}', {address: line.address}) : t('The compliance audit sink');
}

function sinkSentence(line: ISinkLine, t: TFunction): string {
	const sink = sinkSubject(line, t);
	switch (line.condition) {
		case 'disconnected':
			return t('{{sink}} is configured but not connected.', {sink});
		case 'stalled':
			return t('{{sink}} is stalled: it cannot read its place in the trail and sends nothing until that clears.', {sink});
		case 'stopped':
			return t('{{sink}} is stopped and sends nothing.', {sink});
		case 'unreported':
			return t('{{sink}} did not report its state.', {sink});
		case 'unrecognized':
			return t('{{sink}} reports the state "{{state}}", which this console does not know.', {sink, state: line.state ?? ''});
		default:
			// Sending, by the gateway's word, and still short of records.
			return t('{{sink}} has not received every record.', {sink});
	}
}

function SinkAlert({line}: {line: ISinkLine}) {
	const {t} = useTranslation();
	return (
		<Alert severity="warning">
			{sinkSentence(line, t)}
			{line.lastError && <> {t('Last error: {{error}}', {error: line.lastError})}</>}
			{line.writeErrors > 0 && <> {t('{{n}} submissions have failed since it was configured.', {n: line.writeErrors})}</>}
			{line.lagDrops > 0 && <> {t('Retention removed {{n}} segments before it had read them; their records never reached it.', {n: line.lagDrops})}</>}
			{line.poison > 0 && <> {t('{{n}} records were passed over because it cannot carry them; each is named in the trail.', {n: line.poison})}</>}
		</Alert>
	);
}

// The sink lines, then what the REST read could not say: that it failed (the
// state of every sink is then unknown, which is not the same as fine), or the
// quiet note for a caller who may not read the audit API.
function SinkAndAccess({rest, losses}: {rest?: AuditRestSignals; losses: IAuditSinkLoss[]}) {
	const {t} = useTranslation();
	return (
		<>
			{sinkLines(rest, losses).map(line => (
				<SinkAlert key={line.name} line={line} />
			))}
			{rest?.kind === 'unknown' && <Alert severity="warning">{t("The audit sink state is unknown: the gateway's audit status could not be read.")}</Alert>}
			{rest?.kind === 'forbidden' && (
				<Typography variant="body2" color="text.secondary">
					{t('Audit sink and orphan details need gateway administrator rights.')}
				</Typography>
			)}
		</>
	);
}

// An orphan the metrics' fault line does not carry (the counter is not
// exported, not yet above zero in this scrape, or the scrape failed) still
// has its own line: the REST read is evidence on its own.
function OrphanAlert({orphan}: {orphan: {count: number; eventId?: string}}) {
	const {t} = useTranslation();
	return (
		<Alert severity="warning">
			{t('{{n}} management changes from the previous boot have no recorded result.', {n: orphan.count})}
			{orphan.eventId && <> {t('Most recent: event {{id}}.', {id: orphan.eventId})}</>}
		</Alert>
	);
}

export function AuditWriterPanel({report, liveness, rest}: AuditWriterPanelProps) {
	const {t} = useTranslation();
	const orphan = rest?.kind === 'ok' ? rest.orphan : undefined;

	if (report.kind === 'unavailable' || report.kind === 'not-exported') {
		return (
			<Stack spacing={1.5}>
				<Typography variant="body2" color="text.secondary">
					{report.kind === 'unavailable'
						? t('Audit writer health is unavailable: the metrics scrape did not answer.')
						: t('This gateway does not export audit writer metrics.')}
				</Typography>
				{orphan && <OrphanAlert orphan={orphan} />}
				<SinkAndAccess rest={rest} losses={[]} />
			</Stack>
		);
	}
	if (report.kind === 'not-configured') {
		return (
			<Alert severity="error">
				{t('No audit writer is running on this gateway: the audit directory was unusable at start, so every audited management call is refused.')}
			</Alert>
		);
	}

	const orphanOnFaultLine = report.faults.some(f => f.key === ORPHAN_KEY);
	const dropsLine = report.drops.map(d => dropText(d, t)).join(' · ');
	const anyDropped = report.drops.some(d => (d.total ?? 0) > 0);
	const notReported = report.faultsNotReported > 0 ? t('{{n}} not reported', {n: report.faultsNotReported}) : undefined;
	return (
		<Stack spacing={1.5}>
			{report.up === false && (
				<Alert severity="error">{t('The audit writer is not running: every audited management call is refused until it restarts.')}</Alert>
			)}
			{liveness.kind === 'stalled' && (
				<Alert severity="error">
					{t('The writer heartbeat has not advanced for at least {{s}} s. A writer whose heartbeat stops is not running, whatever the other counters say.', {s: Math.round(liveness.sinceMs / 1000)})}
				</Alert>
			)}
			{report.reserveBreached === true && (
				<Alert severity="error">{t('The audit filesystem is below its free-space reserve: durable management writes are refused until space is recovered.')}</Alert>
			)}
			{anyDropped && (
				<Alert severity="warning">
					{t('Audit records were dropped since the gateway started: {{list}}.', {list: dropsLine})}{' '}
					{t('A dropped management record refused its call; a dropped data or system record is a record that does not exist.')}
				</Alert>
			)}
			{report.faults.length > 0 && (
				<Alert severity="warning">
					{t('{{n}} audit fault counters are above zero since the gateway started: {{list}}.', {
						n: report.faults.length,
						list: report.faults
							.map(f => {
								const line = `${counterLabel(f.key, t)} ${f.total}`;
								return f.key === ORPHAN_KEY && orphan?.eventId ? `${line} (${t('most recent: event {{id}}', {id: orphan.eventId})})` : line;
							})
							.join(', '),
					})}
					{notReported && ` (${notReported})`}
				</Alert>
			)}

			{orphan && !orphanOnFaultLine && <OrphanAlert orphan={orphan} />}
			<SinkAndAccess rest={rest} losses={report.sinks} />

			<Box>
				<StatRow label={t('Writer')} value={report.up === undefined ? t('N/A') : report.up ? t('Running') : t('Not running')} />
				<StatRow label={t('Heartbeat')} value={livenessText(liveness, t)} />
				{!anyDropped && <StatRow label={t('Records dropped since start')} value={dropsLine} />}
				{report.faults.length === 0 && (
					<StatRow label={t('Fault counters')} value={notReported ? `${t('None above zero')}, ${notReported}` : t('None above zero')} />
				)}
			</Box>
		</Stack>
	);
}

// Per-instance heartbeat track that survives re-renders but not unmount (the
// same lifetime rule as the snapshot history ring).
function useHeartbeatLiveness(instanceId: number | undefined, value: number | undefined, receivedAtMs: number | undefined, cadenceMs: number): HeartbeatLiveness {
	const ref = useRef<{id: number | undefined; track: IHeartbeatTrack | undefined}>({id: instanceId, track: undefined});
	if (ref.current.id !== instanceId) ref.current = {id: instanceId, track: undefined};
	// trackHeartbeat returns the same track for the same value, so a repeated
	// render does not move firstSeenAtMs.
	if (receivedAtMs !== undefined) ref.current.track = trackHeartbeat(ref.current.track, value, receivedAtMs);
	return receivedAtMs === undefined ? {kind: 'unknown'} : heartbeatLiveness(ref.current.track, receivedAtMs, cadenceMs);
}

function GatewayAuditWriter({instance}: {instance: IInstance}) {
	const {snapshot, cadenceMs} = useMetricsSnapshot(instance);
	const report = useMemo(() => auditWriter(snapshot), [snapshot]);
	const healthy = snapshot && !snapshot.failure ? snapshot : undefined;
	const beat = healthy ? (report.kind === 'ok' ? report.lastHeartbeatSeconds : undefined) : undefined;
	const liveness = useHeartbeatLiveness(instance.id, beat, healthy?.receivedAtMs, cadenceMs);
	// Rendered only for a resolved gateway (PickedInstance), which is the gate
	// the audit read needs. A read that failed is "unknown", never the last
	// answer: these are alerts, and an alert must be about now.
	// A role that has not resolved may be a viewer, who is refused /audit/sink.
	const {role} = useRole();
	const readSink = role !== null && AUDIT_SINK_READER_ROLES.includes(role);
	const auditRest = useGatewayAuditRest(instance, {readSink});
	const rest = useMemo(() => auditRestSignals(auditRest.data, auditRest.isError), [auditRest.isError, auditRest.data]);
	return (
		<Stack spacing={1}>
			{snapshot && !snapshot.failure && <FreshnessBadge receivedAtMs={snapshot.receivedAtMs} cadenceMs={cadenceMs} />}
			<AuditWriterPanel report={report} liveness={liveness} rest={rest} />
		</Stack>
	);
}

function PickedInstance({instance}: {instance: IInstance}) {
	const {t} = useTranslation();
	const resolution = useInstanceFlavorResolution(instance);
	if (resolution.state === 'loading') {
		return <Typography variant="body2" color="text.secondary">{t('Checking the instance flavor…')}</Typography>;
	}
	if (resolution.state === 'denied') {
		return <Typography variant="body2" color="text.secondary">{t('Access to this instance was denied.')}</Typography>;
	}
	if (resolution.state === 'unavailable') {
		return <Typography variant="body2" color="text.secondary">{t('This instance did not answer, so its flavor is unknown.')}</Typography>;
	}
	if (!isEntryApplicable('panel.auditWriter', resolution.flavor)) {
		return <Typography variant="body2" color="text.secondary">{t('This instance is plain loxilb, which keeps no audit trail. Pick an inference gateway instance.')}</Typography>;
	}
	return <GatewayAuditWriter instance={instance} />;
}

export default function AuditWriterSection() {
	const {t} = useTranslation();
	const {instance_list} = useInstances();
	// ⚠️ No default pick: an OAM-level page must not probe an arbitrary (and
	// possibly unreachable) instance just because it is first in the list.
	const [pickedName, setPickedName] = useLocalStorageState<string>(PREFERENCE_KEYS.systemAuditInstance, '', isStringPreference);
	const picked = instance_list.find(i => i.name === pickedName);

	return (
		<Stack spacing={1.5}>
			<Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
				<Typography variant="h6" component="h2">{t('Gateway audit writer')}</Typography>
				{instance_list.length > 0 && (
					<TextField
						select
						size="small"
						label={t('Instance')}
						value={picked?.name ?? ''}
						onChange={e => setPickedName(e.target.value)}
						sx={{minWidth: 200}}
					>
						{instance_list.map(i => (
							<MenuItem key={i.id} value={i.name}>
								{i.name}
							</MenuItem>
						))}
					</TextField>
				)}
			</Box>
			{picked ? (
				<PickedInstance instance={picked} />
			) : (
				<Typography variant="body2" color="text.secondary">
					{instance_list.length === 0 ? t('No instance is registered.') : t('Pick an inference gateway instance to see its audit writer.')}
				</Typography>
			)}
		</Stack>
	);
}
