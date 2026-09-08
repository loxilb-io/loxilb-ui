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
import {classifyViewState} from 'components/observability/observabilityState';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {METRICS_SNAPSHOT_CADENCE_MS, useMetricsSnapshot} from 'hooks/query/observabilityHooks';
import {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {IMetricsSnapshot} from 'types/observability';
import {selectScalar} from 'observability/selectors';
import {groupRates, IGroupRate} from 'observability/snapshotRates';
import {formatRate, PanelPaper, useObservabilityApplicable} from './common';

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
	const {snapshot, history, isLoading, refetch} = useMetricsSnapshot(applicable ? instance : null);

	const presence = useMemo(() => (snapshot && !snapshot.failure ? classifyQosPresence(snapshot) : undefined), [snapshot]);

	// One row per shaped {vip, port, proto, direction} lane, keyed off the
	// bytes-passed counter (a shaped lane always declares it).
	const lanes = useMemo(() => (snapshot ? groupRates(history, 'loxilb_proxy_qos_bytes_passed_total', QOS_SERVICE_LABELS) : []), [snapshot, history]);
	const delayed = useMemo(() => (snapshot ? groupRates(history, 'loxilb_proxy_qos_bytes_delayed_total', QOS_SERVICE_LABELS) : []), [snapshot, history]);
	const parks = useMemo(() => (snapshot ? groupRates(history, 'loxilb_proxy_qos_parks_total', QOS_SERVICE_LABELS) : []), [snapshot, history]);

	const laneKey = (labels: Readonly<Record<string, string>>) => QOS_SERVICE_LABELS.map(k => labels[k] ?? '').join('|');
	const rateFor = (rows: IGroupRate[], labels: Readonly<Record<string, string>>) => rows.find(r => laneKey(r.labels) === laneKey(labels))?.rate;

	// The page's hasData is presence-based: a declared-but-empty collector set
	// still renders (as the explicit no-shaped-service panel), only a scrape
	// with no QoS families at all falls through to generic no-data.
	const hasData = presence !== undefined && presence !== 'no-families';
	const state = classifyViewState({
		applicable,
		isLoading,
		snapshot,
		hasData,
		nowMs: Date.now(),
		cadenceMs: METRICS_SNAPSHOT_CADENCE_MS,
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
				<Typography variant="h5">{t('QoS')}</Typography>
				{snapshot && !snapshot.failure && <FreshnessBadge receivedAtMs={snapshot.receivedAtMs} cadenceMs={METRICS_SNAPSHOT_CADENCE_MS} />}
			</Box>

			<ObservabilityStateFrame state={state} name={t('QoS')} onRetry={refetch}>
				{presence === 'no-shaped-service' ? (
					<PanelPaper title={t('Traffic shaping')}>
						<Typography variant="body2" color="text.secondary">
							{t('No service is currently shaped. The QoS collectors are present but emit nothing until a rate limit is configured on a service.')}
						</Typography>
					</PanelPaper>
				) : (
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
				)}
			</ObservabilityStateFrame>
		</Box>
	);
}
