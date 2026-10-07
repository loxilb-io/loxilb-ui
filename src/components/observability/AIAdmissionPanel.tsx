//---------------------------------------------------------
// AI admission gate + proxy connection overload panels
//---------------------------------------------------------
// See observability/aiAdmission for what the gate counts. Compact by rule:
// the page says whether the gate is refusing and whether a pool is at a
// ceiling now; per-pool and per-reason detail is Grafana's ("AI admission
// gate" row). Two rules still shape the rendering:
//   - With the gate off every counter is 0 by construction, so the panel
//     says the gate is off instead of printing zeros that look measured.
//   - Refusals are summed as DECISIONS and captioned so: a request can be
//     counted more than once, so the figure is never called a request rate.

import {Alert, Stack, Typography} from '@mui/material';
import type {TFunction} from 'i18next';
import {useTranslation} from 'react-i18next';
import {AiAdmissionReport, ISaturatedPool, ProxyOverloadReport} from 'observability/aiAdmission';
import {StatRow} from './panelLayout';
import {formatRate} from './rateText';

function saturatedText(p: ISaturatedPool, t: TFunction): string {
	return p.what === 'limit'
		? t('{{service}} / {{pool}}: {{value}} of {{bound}} units in flight', {service: p.service, pool: p.pool, value: p.value, bound: p.bound})
		: t('{{service}} / {{pool}}: queue full, {{value}} of {{bound}}', {service: p.service, pool: p.pool, value: p.value, bound: p.bound});
}

export function AIAdmissionPanel({report}: {report: AiAdmissionReport}) {
	const {t} = useTranslation();

	if (report.kind === 'unavailable') {
		return (
			<Typography variant="body2" color="text.secondary">
				{t('Admission gate state is unavailable: the metrics scrape did not answer.')}
			</Typography>
		);
	}

	// Process-wide, so it is reported with or without pools.
	const anomalyAlert =
		report.anomalyTotal !== undefined && report.anomalyTotal > 0 ? (
			<Alert severity="error">
				{t('The capacity gate has recorded {{n}} accounting anomalies since start. Each one is a gateway defect, not load: report it together with the gateway version.', {n: report.anomalyTotal})}
			</Alert>
		) : null;

	if (report.kind === 'no-pools') {
		return (
			<Stack spacing={1}>
				{anomalyAlert}
				<Typography variant="body2" color="text.secondary">
					{t('No model pool reports admission-gate state. The gate reports every model pool of an AI-gateway service in every mode, so this gateway has no such pool.')}
				</Typography>
			</Stack>
		);
	}

	const gated = report.pools.filter(p => p.mode !== 'off');
	if (gated.length === 0) {
		return (
			<Stack spacing={1}>
				{anomalyAlert}
				<Alert severity="info">
					{t('The capacity gate is off on every pool: nothing is bounded, and its counters stay at zero by construction. It is switched on per rule with the rule\'s Admission Mode, or for every rule that declares none with the gateway\'s LLB_FC_MODE setting (observe or enforce).')}
				</Alert>
			</Stack>
		);
	}

	const anyEnforce = gated.some(p => p.mode === 'enforce');
	const anyObserve = gated.some(p => p.mode === 'observe');

	return (
		<Stack spacing={1}>
			{anomalyAlert}
			{report.saturated.length > 0 && (
				<Alert severity="warning">
					{t('At a ceiling now: {{pools}}', {pools: report.saturated.map(p => saturatedText(p, t)).join('; ')})}
				</Alert>
			)}
			<StatRow label={t('Gated pools')} value={t('{{gated}} of {{total}}', {gated: gated.length, total: report.pools.length})} />
			{anyEnforce && <StatRow label={t('Refusal decisions')} value={formatRate(report.refusing, t)} />}
			{anyObserve && <StatRow label={t('Would-refuse decisions (observe mode)')} value={formatRate(report.wouldRefuse, t)} />}
			<Typography variant="caption" color="text.secondary">
				{t('These count gate decisions, not requests: one request can be counted more than once. Per-pool and per-reason detail is in Grafana.')}
			</Typography>
		</Stack>
	);
}

export function ProxyOverloadPanel({report}: {report: ProxyOverloadReport}) {
	const {t} = useTranslation();

	if (report.kind === 'unavailable') {
		return (
			<Typography variant="body2" color="text.secondary">
				{t('Listener overload counters are unavailable: the metrics scrape did not answer.')}
			</Typography>
		);
	}

	const dropping = report.listenDrops.rate.kind === 'ok' && report.listenDrops.rate.perSecond > 0;
	// Shown only once it has fired: a header-deadline close is a slow or
	// stalled client, rare enough that a standing 0/s row is noise.
	const headerFired = (report.headerDeadlineDrops.total ?? 0) > 0;

	return (
		<Stack spacing={1}>
			{dropping && (
				<Alert severity="warning">
					{t('The gateway is dropping connections at its listeners: those clients are refused before any request is read.')}
				</Alert>
			)}
			{/* Drops INCLUDE the backlog-full drops: shown as a share, never added. */}
			<StatRow
				label={t('Listen drops (all causes)')}
				value={t('{{drops}} (backlog full: {{overflows}})', {drops: formatRate(report.listenDrops.rate, t), overflows: formatRate(report.listenOverflows.rate, t)})}
			/>
			{headerFired && <StatRow label={t('Closed at the header deadline')} value={formatRate(report.headerDeadlineDrops.rate, t)} />}
			<Typography variant="caption" color="text.secondary">
				{t('Listen drops already include the backlog-full drops, so the two are not added. These count every listener of the gateway process, not only AI services; a connection dropped here never reaches the admission gate.')}
			</Typography>
		</Stack>
	);
}
