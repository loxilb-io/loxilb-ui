//---------------------------------------------------------
// AI admission gate + proxy connection overload panels
//---------------------------------------------------------
// See observability/aiAdmission for what the gate counts. Two rules shape
// this rendering:
//   - With the gate off its gauges read 0 by construction, so they print
//     "Not gated" rather than a zero that looks like measured idleness.
//   - Decision reasons are shown one per row, never totalled: they are not a
//     partition of requests (a queued request is counted again when it
//     leaves the queue; observe-mode reasons once per ceiling).

import {Alert, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography} from '@mui/material';
import type {TFunction} from 'i18next';
import {useTranslation} from 'react-i18next';
import {AiAdmissionReport, DecisionGroup, GateMode, IAdmissionPool, ProxyOverloadReport} from 'observability/aiAdmission';
import {formatRate} from './rateText';

function modeText(mode: GateMode, t: TFunction): string {
	switch (mode) {
		case 'off':
			return t('Off');
		case 'observe':
			return t('Observe');
		case 'enforce':
			return t('Enforce');
		default:
			return t('Unknown value');
	}
}

function decisionLabel(reason: string, t: TFunction): string {
	switch (reason) {
		case 'capacity_shed':
			return t('Refused at capacity (429)');
		case 'queue_full':
			return t('Refused, queue full (429)');
		case 'queue_timeout':
			return t('Timed out in the queue (504)');
		case 'no_healthy_capacity':
			return t('Refused, no healthy endpoint (503)');
		case 'draining':
			return t('Refused while draining (503)');
		case 'queued':
			return t('Parked in the queue');
		case 'cancelled':
			return t('Client left while parked');
		case 'drained':
			return t('Drained while parked');
		case 'observe_would_shed':
			return t('Would refuse (observe mode)');
		case 'observe_would_queue':
			return t('Would park (observe mode)');
		case 'admitted':
			return t('Admitted');
		case 'bypass_non_inference':
			return t('Not an inference request (no unit taken)');
		default:
			return reason;
	}
}

const GROUP_COLOR: Record<DecisionGroup, 'error.main' | 'text.primary' | 'text.secondary'> = {
	refused: 'error.main',
	waited: 'text.primary',
	observe: 'text.secondary',
	passed: 'text.secondary',
};

function inflightText(p: IAdmissionPool, t: TFunction): string {
	if (p.mode === 'off') return t('Not gated');
	if (p.inflight === undefined) return t('N/A');
	if (p.limit === undefined) return String(p.inflight);
	return `${p.inflight} / ${p.limit === 0 ? t('unlimited') : p.limit}`;
}

function queuedText(p: IAdmissionPool, t: TFunction): string {
	if (p.mode === 'off') return t('Not gated');
	// Depth 0: over a ceiling is refused at once, nothing ever parks.
	if (p.queueDepth === 0) return t('No queue');
	if (p.queued === undefined) return t('N/A');
	return p.queueDepth === undefined ? String(p.queued) : `${p.queued} / ${p.queueDepth}`;
}

function meanWaitText(p: IAdmissionPool, t: TFunction): string {
	if (p.meanWaitSeconds !== undefined) return `${(p.meanWaitSeconds * 1000).toFixed(0)} ms`;
	return p.resumedTotal === 0 ? t('None since start') : t('N/A');
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

	const allOff = report.pools.every(p => p.mode === 'off');
	const decisions = report.pools.flatMap(p => p.decisions.filter(d => (d.total ?? 0) > 0).map(d => ({pool: p, d})));

	return (
		<Stack spacing={1.5}>
			{anomalyAlert}
			{allOff && (
				<Alert severity="info">
					{t('The capacity gate is off on every pool: nothing is bounded, and its counters stay at zero by construction. It is switched on with the LLB_FC_MODE setting (observe or enforce).')}
				</Alert>
			)}

			<Table size="small" aria-label={t('Admission gate pools')}>
				<TableHead>
					<TableRow>
						<TableCell>{t('Service')}</TableCell>
						<TableCell>{t('Pool')}</TableCell>
						<TableCell>{t('Mode')}</TableCell>
						<TableCell align="right">{t('In flight / limit')}</TableCell>
						<TableCell align="right">{t('Queued / depth')}</TableCell>
						<TableCell align="right">{t('Mean queue wait (since start)')}</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{report.pools.map(p => (
						<TableRow key={`${p.service}|${p.pool}`}>
							<TableCell>{p.service}</TableCell>
							<TableCell>{p.pool}</TableCell>
							<TableCell>{modeText(p.mode, t)}</TableCell>
							<TableCell align="right">{inflightText(p, t)}</TableCell>
							<TableCell align="right">{queuedText(p, t)}</TableCell>
							<TableCell align="right">{meanWaitText(p, t)}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>

			{decisions.length === 0 ? (
				<Typography variant="body2" color="text.secondary">
					{t('The gate has taken no decision since start.')}
				</Typography>
			) : (
				<Table size="small" aria-label={t('Admission gate decisions')}>
					<TableHead>
						<TableRow>
							<TableCell>{t('Service')}</TableCell>
							<TableCell>{t('Pool')}</TableCell>
							<TableCell>{t('Decision')}</TableCell>
							<TableCell align="right">{t('Rate')}</TableCell>
							<TableCell align="right">{t('Since start')}</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{decisions.map(({pool, d}) => (
							<TableRow key={`${pool.service}|${pool.pool}|${d.reason}`}>
								<TableCell>{pool.service}</TableCell>
								<TableCell>{pool.pool}</TableCell>
								<TableCell sx={{color: GROUP_COLOR[d.group]}}>{decisionLabel(d.reason, t)}</TableCell>
								<TableCell align="right">{formatRate(d.rate, t)}</TableCell>
								<TableCell align="right">{d.total}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}

			<Typography variant="caption" color="text.secondary">
				{t('Each row counts gate decisions, not requests: a request that waited is counted when it was parked and again when it left the queue, and an observe-mode row counts every ceiling the request would have hit. The rows do not add up to a request total.')}
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

	const rows = [
		{key: 'drops', label: t('Listen drops (all causes)'), c: report.listenDrops},
		{key: 'overflows', label: t('of which: listen backlog full'), c: report.listenOverflows},
		{key: 'header', label: t('Closed at the header deadline'), c: report.headerDeadlineDrops},
	];

	return (
		<Stack spacing={1}>
			<Table size="small" aria-label={t('Listener overload')}>
				<TableHead>
					<TableRow>
						<TableCell>{t('Connections')}</TableCell>
						<TableCell align="right">{t('Rate')}</TableCell>
						<TableCell align="right">{t('Since start')}</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{rows.map(r => (
						<TableRow key={r.key}>
							<TableCell sx={r.key === 'overflows' ? {pl: 4} : undefined}>{r.label}</TableCell>
							<TableCell align="right">{formatRate(r.c.rate, t)}</TableCell>
							<TableCell align="right">{r.c.total ?? t('N/A')}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			<Typography variant="caption" color="text.secondary">
				{t('Listen drops already include the backlog-full drops, so the two are not added. These count every listener of the gateway process, not only AI services; a connection dropped here never reaches the admission gate.')}
			</Typography>
		</Stack>
	);
}
