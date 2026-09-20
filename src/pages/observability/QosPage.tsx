//---------------------------------------------------------
// QoS observability page (UI-MON-013)
//---------------------------------------------------------
// The eight loxilb_proxy_qos_* families come from custom desc-discovered
// collectors that emit NOTHING until at least one service is shaped. The
// parser keeps zero-sample families, so "families declared but empty" is
// distinguishable from "families missing from the scrape" — the former is a
// deliberate no-shaped-service state, not a data failure. Every family is
// labeled {vip, port, proto, direction} with direction ∈ {upload, download};
// an unrecognized direction renders raw, never coerced into a known lane.

import {Box, Table, TableBody, TableCell, TableHead, TableRow, Typography} from '@mui/material';
import FreshnessBadge from 'components/observability/FreshnessBadge';
import ObservabilityStateFrame from 'components/observability/ObservabilityStateFrame';
import PolicerAttachmentPanel from 'components/observability/PolicerAttachmentPanel';
import {classifyViewState} from 'components/observability/observabilityState';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useMetricsSnapshot} from 'hooks/query/observabilityHooks';
import {useQOSPolicies} from 'hooks/query/queryHooks';
import {policerAttachment} from 'observability/policerAttachment';
import {useCallback, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {IMetricsSnapshot} from 'types/observability';
import {selectScalar} from 'observability/selectors';
import {IGroupRate, groupRates, rateMaxGapMs} from 'observability/snapshotRates';
import {CadenceSelector, PanelPaper, formatRate, useAbsenceExplanation, useObservabilityApplicable} from './common';

// ⚠️ The EIGHT shaper families only, deliberately excluding Stage 3.3's
// `loxilb_policer_attached` even though the capability registry lists it under
// page.qos. This list drives `classifyQosPresence`, and a policer that is
// configured but attached to nothing exports an attachment series while
// shaping no bytes — folding it in here would flip presence to 'shaped' and
// render the shaped-services table with zero lanes, reporting traffic that
// does not exist. Attachment has its own panel and its own presence rules.
export const QOS_FAMILIES = [
	'loxilb_proxy_qos_bytes_passed_total',
	'loxilb_proxy_qos_bytes_delayed_total',
	'loxilb_proxy_qos_parks_total',
	'loxilb_proxy_qos_park_seconds_total',
	'loxilb_proxy_qos_parked_connections',
	'loxilb_proxy_qos_tokens_bytes',
	'loxilb_proxy_qos_cbs_bytes',
	'loxilb_proxy_qos_cir_bytes_per_second',
] as const;

export const QOS_SERVICE_LABELS = ['vip', 'port', 'proto', 'direction'] as const;

export type QosPresence = 'no-families' | 'no-shaped-service' | 'shaped';

// Presence classification for the custom collectors. Zero samples across all
// eight declared families means no service is currently shaped; families
// absent from the scrape entirely is a different (older-build) situation the
// generic no-data state covers.
export function classifyQosPresence(snapshot: IMetricsSnapshot): QosPresence {
	let declared = 0;
	for (const name of QOS_FAMILIES) {
		const family = snapshot.families.get(name);
		if (!family) continue;
		declared++;
		if (family.samples.length > 0) return 'shaped';
	}
	return declared > 0 ? 'no-shaped-service' : 'no-families';
}

export default function QosPage() {
	const {t} = useTranslation();
	const instance = useInstanceFromURL();
	const applicable = useObservabilityApplicable('page.qos');
	const {snapshot, history, isLoading, cadenceMs, refetch} = useMetricsSnapshot(applicable ? instance : null);
	// Stage 3.5: let the no-data state say WHY, from the manifest contract.
	const absence = useAbsenceExplanation('page.qos', snapshot);
	const maxGap = rateMaxGapMs(cadenceMs);

	const presence = useMemo(() => (snapshot && !snapshot.failure ? classifyQosPresence(snapshot) : undefined), [snapshot]);

	// Stage 3.3. The policy list is the other half of the attachment answer:
	// it is what makes an empty gauge readable as "no policer configured"
	// (correct) rather than "the metric is broken". `undefined` deliberately
	// reaches the derivation as "configuration unknown" instead of "none".
	const {data: policyData, refetch: refetchPolicies} = useQOSPolicies(applicable ? instance : null);
	const policies = useMemo(() => (Array.isArray(policyData) ? policyData : undefined), [policyData]);
	const attachment = useMemo(() => policerAttachment(snapshot, policies), [snapshot, policies]);

	// ⚠️ Refresh must refetch EVERY query the page reads, not just the
	// metrics one — the §4.0 half-refresh defect, avoided up front rather
	// than shipped again.
	const refetchAll = useCallback(() => {
		refetch();
		refetchPolicies();
	}, [refetch, refetchPolicies]);

	// One row per shaped {vip, port, proto, direction} lane, keyed off the
	// bytes-passed counter (a shaped lane always declares it).
	const lanes = useMemo(() => (snapshot ? groupRates(history, 'loxilb_proxy_qos_bytes_passed_total', QOS_SERVICE_LABELS, maxGap) : []), [snapshot, history, maxGap]);
	const delayed = useMemo(() => (snapshot ? groupRates(history, 'loxilb_proxy_qos_bytes_delayed_total', QOS_SERVICE_LABELS, maxGap) : []), [snapshot, history, maxGap]);
	const parks = useMemo(() => (snapshot ? groupRates(history, 'loxilb_proxy_qos_parks_total', QOS_SERVICE_LABELS, maxGap) : []), [snapshot, history, maxGap]);

	const laneKey = (labels: Readonly<Record<string, string>>) => QOS_SERVICE_LABELS.map(k => labels[k] ?? '').join('|');
	const rateFor = (rows: IGroupRate[], labels: Readonly<Record<string, string>>) => rows.find(r => laneKey(r.labels) === laneKey(labels))?.rate;

	// The page's hasData is presence-based: a declared-but-empty collector set
	// still renders (as the explicit no-shaped-service panel), only a scrape
	// with no QoS families at all falls through to generic no-data.
	//
	// ⚠️ Stage 3.3 widens this. The attachment answer can be carried entirely
	// by REST, so a gateway that exports no QoS family at all but DOES report
	// policers still has something true to show — including the useful
	// "policers configured, metric not exported" gap. Without this the panel
	// would be hidden behind the generic no-data frame in exactly the case it
	// was built for. A report that knows nothing (no rows and no policy list)
	// adds nothing and correctly leaves the frame alone.
	const attachmentHasData = attachment.kind === 'ok' && (attachment.rows.length > 0 || attachment.configured !== undefined);
	const hasData = (presence !== undefined && presence !== 'no-families') || attachmentHasData;
	const state = classifyViewState({
		applicable,
		isLoading,
		snapshot,
		hasData,
		nowMs: Date.now(),
		cadenceMs,
	});

	const gaugeFor = (family: string, labels: Readonly<Record<string, string>>) => {
		if (!snapshot) return undefined;
		const match: Record<string, string> = {};
		for (const k of QOS_SERVICE_LABELS) if (labels[k] !== undefined) match[k] = labels[k];
		return selectScalar(snapshot, family, match);
	};

	const directionText = (raw: string | undefined) => {
		if (raw === 'upload') return t('Upload');
		if (raw === 'download') return t('Download');
		return raw ?? t('Unknown value');
	};

	const bytesText = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? t('N/A') : v.toLocaleString());

	return (
		<Box sx={{p: 2}}>
			<Box display="flex" alignItems="center" gap={2} sx={{mb: 2}}>
				<Typography variant="h5" component="h2">{t('QoS')}</Typography>
				{snapshot && !snapshot.failure && <FreshnessBadge receivedAtMs={snapshot.receivedAtMs} cadenceMs={cadenceMs} />}
				<CadenceSelector />
			</Box>

			<ObservabilityStateFrame state={state} absence={absence} name={t('QoS')} onRetry={refetchAll}>
				{/* Attachment sits ABOVE the shaping table on purpose: a
				    policer that is shaping nothing explains an empty or
				    short table below it, so reading it second would invite
				    the wrong conclusion first. */}
				<Box sx={{mb: 2}}>
					<PanelPaper title={t('Policer attachment')}>
						<PolicerAttachmentPanel report={attachment} />
					</PanelPaper>
				</Box>

				{/* ⚠️ Three presence cases, not two. Since Stage 3.3 the frame
				    can be open on the strength of the attachment panel alone,
				    so 'no-families' now reaches this branch — and it must
				    render NEITHER the table (zero lanes would read as "no
				    traffic" when the truth is "no collector") nor the
				    no-shaped-service note (which claims the collectors are
				    present). It renders nothing, and the attachment panel
				    above stands as the page. */}
				{presence === 'shaped' ? (
					<PanelPaper title={t('Shaped services')}>
						<Table size="small">
							<TableHead>
								<TableRow>
									<TableCell>{t('Service')}</TableCell>
									<TableCell>{t('Direction')}</TableCell>
									<TableCell align="right">{t('Bytes passed')}</TableCell>
									<TableCell align="right">{t('Bytes delayed')}</TableCell>
									<TableCell align="right">{t('Parks')}</TableCell>
									<TableCell align="right">{t('Parked connections')}</TableCell>
									<TableCell align="right">{t('Committed rate (B/s)')}</TableCell>
									<TableCell align="right">{t('Burst size (B)')}</TableCell>
									<TableCell align="right">{t('Tokens (B)')}</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{lanes.map(lane => (
									<TableRow key={laneKey(lane.labels)}>
										<TableCell>{`${lane.labels.vip ?? ''}:${lane.labels.port ?? ''}/${lane.labels.proto ?? ''}`}</TableCell>
										<TableCell>{directionText(lane.labels.direction)}</TableCell>
										<TableCell align="right">{formatRate(lane.rate, t, ' B/s')}</TableCell>
										<TableCell align="right">{formatRate(rateFor(delayed, lane.labels) ?? {kind: 'insufficient-samples'}, t, ' B/s')}</TableCell>
										<TableCell align="right">{formatRate(rateFor(parks, lane.labels) ?? {kind: 'insufficient-samples'}, t)}</TableCell>
										<TableCell align="right">{bytesText(gaugeFor('loxilb_proxy_qos_parked_connections', lane.labels))}</TableCell>
										<TableCell align="right">{bytesText(gaugeFor('loxilb_proxy_qos_cir_bytes_per_second', lane.labels))}</TableCell>
										<TableCell align="right">{bytesText(gaugeFor('loxilb_proxy_qos_cbs_bytes', lane.labels))}</TableCell>
										<TableCell align="right">{bytesText(gaugeFor('loxilb_proxy_qos_tokens_bytes', lane.labels))}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</PanelPaper>
				) : presence === 'no-shaped-service' ? (
					<PanelPaper title={t('Traffic shaping')}>
						<Typography variant="body2" color="text.secondary">
							{t('No service is currently shaped. The QoS collectors are present but emit nothing until a rate limit is configured on a service.')}
						</Typography>
					</PanelPaper>
				) : null}
			</ObservabilityStateFrame>
		</Box>
	);
}
