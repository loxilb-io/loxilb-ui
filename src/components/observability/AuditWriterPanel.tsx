//---------------------------------------------------------
// Audit writer health (System page)
//---------------------------------------------------------
// The System page is OAM-level, so this section brings its own instance
// picker; the panel renders only for an instance whose flavor RESOLVED to
// the inference gateway and whose registry entry is applicable. See
// observability/auditWriter for what each value means and why liveness is
// judged from our own observations.

import {Alert, Box, MenuItem, Stack, TextField, Typography} from '@mui/material';
import type {TFunction} from 'i18next';
import FreshnessBadge from 'components/observability/FreshnessBadge';
import {StatRow} from 'components/observability/panelLayout';
import {useInstanceFlavorResolution} from 'hooks/query/flavorHook';
import {useInstances} from 'hooks/query/oamHooks';
import {useMetricsSnapshot} from 'hooks/query/observabilityHooks';
import useLocalStorageState from 'hooks/localStorageHook';
import {PREFERENCE_KEYS, isStringPreference} from 'preferences';
import {useMemo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {AuditWriterReport, HeartbeatLiveness, IAuditStreamDrops, IHeartbeatTrack, auditWriter, heartbeatLiveness, trackHeartbeat} from 'observability/auditWriter';
import {isEntryApplicable} from 'observability/capabilityRegistry';
import {IInstance} from 'types/oam';

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
}

export function AuditWriterPanel({report, liveness}: AuditWriterPanelProps) {
	const {t} = useTranslation();

	if (report.kind === 'unavailable') {
		return (
			<Typography variant="body2" color="text.secondary">
				{t('Audit writer health is unavailable: the metrics scrape did not answer.')}
			</Typography>
		);
	}
	if (report.kind === 'not-exported') {
		return (
			<Typography variant="body2" color="text.secondary">
				{t('This gateway does not export audit writer metrics.')}
			</Typography>
		);
	}
	if (report.kind === 'not-configured') {
		return (
			<Alert severity="error">
				{t('No audit writer is running on this gateway: the audit directory was unusable at start, so every audited management call is refused.')}
			</Alert>
		);
	}

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
						list: report.faults.map(f => `${counterLabel(f.key, t)} ${f.total}`).join(', '),
					})}
					{notReported && ` (${notReported})`}
				</Alert>
			)}

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
	return (
		<Stack spacing={1}>
			{snapshot && !snapshot.failure && <FreshnessBadge receivedAtMs={snapshot.receivedAtMs} cadenceMs={cadenceMs} />}
			<AuditWriterPanel report={report} liveness={liveness} />
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
