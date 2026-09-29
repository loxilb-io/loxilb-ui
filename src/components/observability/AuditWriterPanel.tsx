//---------------------------------------------------------
// Audit writer health (System page)
//---------------------------------------------------------
// The System page is OAM-level, so this section brings its own instance
// picker; the panel renders only for an instance whose flavor RESOLVED to
// the inference gateway and whose registry entry is applicable. See
// observability/auditWriter for what each value means and why liveness is
// judged from our own observations.

import {Alert, Box, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography} from '@mui/material';
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
import {AuditWriterReport, HeartbeatLiveness, IHeartbeatTrack, auditWriter, heartbeatLiveness, trackHeartbeat} from 'observability/auditWriter';
import {isEntryApplicable} from 'observability/capabilityRegistry';
import {formatReportedAt, reportedAtFromSeconds} from 'observability/reportedAt';
import {rateMaxGapMs} from 'observability/snapshotRates';
import {IInstance} from 'types/oam';
import {formatRate} from './rateText';

function streamLabel(stream: string, t: TFunction): string {
	if (stream === 'mgmt') return t('Management');
	if (stream === 'data') return t('Data');
	if (stream === 'audit_system') return t('Audit system');
	return stream;
}

function counterLabel(key: string, t: TFunction): string {
	switch (key) {
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
		case 'loxilb_audit_segments_pruned_total':
			return t('Segments pruned by retention');
		case 'loxilb_audit_delegation_lookups_total':
			return t('Originator trust lookups');
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

export interface AuditWriterPanelProps {
	report: AuditWriterReport;
	liveness: HeartbeatLiveness;
	/** The viewer's clock, for "is it today" only — never for liveness. */
	nowMs: number;
}

export function AuditWriterPanel({report, liveness, nowMs}: AuditWriterPanelProps) {
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

	const failures = [...report.failures, ...report.activity];
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

			<Box>
				<StatRow label={t('Writer')} value={report.up === undefined ? t('N/A') : report.up ? t('Running') : t('Not running')} />
				<StatRow label={t('Heartbeat')} value={livenessText(liveness, t)} />
				<StatRow label={t('Last heartbeat (gateway clock)')} value={formatReportedAt(reportedAtFromSeconds(report.lastHeartbeatSeconds), nowMs, t)} />
				<StatRow label={t('Last durable write (gateway clock)')} value={formatReportedAt(reportedAtFromSeconds(report.lastWriteSeconds), nowMs, t)} />
				<StatRow label={t('Writer restarts (since start)')} value={report.restarts ?? t('N/A')} />
				<StatRow label={t('Writer panics (since start)')} value={report.panics ?? t('N/A')} />
			</Box>

			<Table size="small" aria-label={t('Audit records by stream')}>
				<TableHead>
					<TableRow>
						<TableCell>{t('Stream')}</TableCell>
						<TableCell align="right">{t('Written')}</TableCell>
						<TableCell align="right">{t('Written since start')}</TableCell>
						<TableCell align="right">{t('Dropped since start')}</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{report.streams.map(s => (
						<TableRow key={s.stream}>
							<TableCell>{streamLabel(s.stream, t)}</TableCell>
							<TableCell align="right">{formatRate(s.writtenRate, t)}</TableCell>
							<TableCell align="right">{s.writtenTotal ?? t('N/A')}</TableCell>
							<TableCell align="right" sx={(s.droppedTotal ?? 0) > 0 ? {color: 'error.main'} : undefined}>
								{s.droppedTotal ?? t('N/A')}
								{s.droppedBy.length > 0 && ` (${s.droppedBy.map(d => `${d.reason} ${d.total}`).join(', ')})`}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			<Typography variant="caption" color="text.secondary">
				{t('A dropped management record refused its call; a dropped data or system record is a record that does not exist.')}
			</Typography>

			<Table size="small" aria-label={t('Audit failures and housekeeping')}>
				<TableHead>
					<TableRow>
						<TableCell>{t('Counter')}</TableCell>
						<TableCell align="right">{t('Since start')}</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{failures.map(f => {
						const isFailure = report.failures.includes(f);
						return (
							<TableRow key={f.key}>
								<TableCell>{counterLabel(f.key, t)}</TableCell>
								<TableCell align="right" sx={isFailure && (f.total ?? 0) > 0 ? {color: 'error.main'} : undefined}>
									{f.total ?? t('N/A')}
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
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
	const {snapshot, history, cadenceMs} = useMetricsSnapshot(instance);
	const report = useMemo(() => auditWriter(snapshot, history, rateMaxGapMs(cadenceMs)), [snapshot, history, cadenceMs]);
	const healthy = snapshot && !snapshot.failure ? snapshot : undefined;
	const beat = healthy ? (report.kind === 'ok' ? report.lastHeartbeatSeconds : undefined) : undefined;
	const liveness = useHeartbeatLiveness(instance.id, beat, healthy?.receivedAtMs, cadenceMs);
	return (
		<Stack spacing={1}>
			{snapshot && !snapshot.failure && <FreshnessBadge receivedAtMs={snapshot.receivedAtMs} cadenceMs={cadenceMs} />}
			<AuditWriterPanel report={report} liveness={liveness} nowMs={Date.now()} />
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
