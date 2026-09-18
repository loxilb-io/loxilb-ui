//---------------------------------------------------------
// P/D admission pressure (Stage 3.4, on the P/D & KV page)
//---------------------------------------------------------
// What the gateway does when every healthy prefill endpoint is at its
// in-flight cap: hold the request on a FIFO, or drop it with a 429.
//
// ⭐⭐ This panel replaces a row that was actively misleading. The page used
// to show "Admission shed" from `loxilb_pd_admission_shed_total` alone, but
// that counter is structurally pinned at zero whenever queueing is enabled —
// the branch cannot be reached — so the page reported "0/s" while the
// overflow valve dropped traffic and clients received 429s. The fix is not a
// third row beside the first two: it is reporting DROPS as one quantity
// across both valves, and naming which valve is even armed.
//
// ⭐ Parking is hold-don't-drop. A parked request is still going to be served,
// so `absorbing` is rendered as success and never as a fault — the whole
// point of the FIFO is to absorb a burst the pool cannot take yet.
//
// ⚠️ Chips and alerts are built here rather than routed through DataTable's
// `type: 'state'` column: `state_color()` defaults to 'error' for any string
// it does not recognise and matches lowercase ENGLISH substrings, so a
// translated state would paint ko/ja operators a red cell for a healthy
// gateway.

import {Alert, Box, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography} from '@mui/material';
import {
	PD_ADMISSION_OVERFLOW_SHED,
	PD_ADMISSION_QUEUED,
	PD_ADMISSION_SHED,
	PdAdmissionReport,
	branchReachable,
} from 'observability/pdAdmission';
import type {RateResult} from 'observability/rates';
import {useTranslation} from 'react-i18next';
import {formatRate} from './rateText';

type OkReport = Extract<PdAdmissionReport, {kind: 'ok'}>;

function ModeNote({report}: {report: OkReport}) {
	const {t} = useTranslation();

	// ⚠️⚠️ Checked before the mode copy: a proven-armed queueing gateway that
	// does not export the overflow counter is dropping requests that nothing
	// can see, and that outranks describing which branch is armed.
	if (report.blindSpot) {
		return (
			<Alert severity="warning">
				{t('This gateway queues admission overflow but does not export the overflow-shed counter, which is the only drop counter its configuration can reach. Requests may be being dropped with no metric recording it. Upgrade the gateway to observe admission drops.')}
			</Alert>
		);
	}

	switch (report.mode) {
		case 'queueing':
			// ⭐ The sentence the old row was missing. Says plainly that the
			// other counter's zero is structural, not good news.
			return (
				<Alert severity="info">
					{t('Per-endpoint queueing is enabled, so a request that finds every prefill endpoint at its cap is held on a FIFO rather than dropped. Only the overflow valve can drop here — the plain shed counter stays at zero by construction and is not evidence that nothing was dropped.')}
				</Alert>
			);
		case 'shedding':
			return (
				<Alert severity="info">
					{t('Per-endpoint queueing is disabled, so a request that finds every prefill endpoint at its cap is dropped immediately with a retriable 429. Only the plain shed valve can drop here; the overflow counter stays at zero by construction.')}
				</Alert>
			);
		case 'contradictory':
			// ⚠️ Scoped as a data-trust caveat: the datapath forbids this, so
			// it is a metrics problem, not an operator's problem.
			return (
				<Alert severity="warning">
					{t('Both admission valves report drops, which the datapath does not allow — the queue depth is fixed for the life of the gateway process, so only one valve can ever fire. Treat the split below as unreliable and report it; the total is still the number of requests dropped.')}
				</Alert>
			);
		case 'indeterminate':
			// ⚠️ NOT a warning and NOT a gap. Nothing has parked or shed, so
			// the pool has never filled — the expected reading on a gateway
			// with headroom.
			return (
				<Alert severity="info">
					{t('No request has yet been queued or dropped by the admission layer, so the prefill pool has never been full. Whether queueing is enabled cannot be told from the metrics until it is exercised.')}
				</Alert>
			);
	}
}

function VerdictAlert({report}: {report: OkReport}) {
	const {t} = useTranslation();
	switch (report.verdict) {
		case 'dropping':
			// ⭐⭐ The one actionable state, so the only verdict warning.
			return (
				<Alert severity="warning">
					{t('{{n}} requests have been dropped by the admission layer since this gateway started, each answered with a retriable 429. The prefill pool is running out of capacity — add prefill endpoints, raise the per-endpoint in-flight cap, or enable queueing to absorb bursts.', {n: report.dropTotal ?? 0})}
				</Alert>
			);
		case 'absorbing':
			// ⭐ Success, not a fault. Parking is hold-don't-drop.
			return (
				<Alert severity="success">
					{t('The admission layer has held {{n}} requests on a queue and dropped none. Bursts beyond the per-endpoint cap are being absorbed rather than rejected, which is what queueing is for.', {n: report.queuedTotal ?? 0})}
				</Alert>
			);
		case 'no-pressure':
			return (
				<Alert severity="success">
					{t('The admission layer has neither queued nor dropped a request: no prefill endpoint has reached its in-flight cap.')}
				</Alert>
			);
	}
}

interface IValveRow {
	family: string;
	name: string;
	detail: string;
	rate: RateResult;
	total: number | undefined;
}

function ValveRow({row, report}: {row: IValveRow; report: OkReport}) {
	const {t} = useTranslation();
	const reachable = branchReachable(row.family, report.mode);
	const absent = row.total === undefined;
	return (
		<TableRow>
			<TableCell>
				<Box display="flex" alignItems="center" gap={1}>
					<Typography variant="body2">{row.name}</Typography>
					{/* An unreachable valve is LABELLED, never coloured as an
					    error: its zero is the configuration, not a failure. */}
					{reachable === false && (
						<Tooltip title={t('This valve cannot fire under the current queue-depth setting, so its zero is expected and says nothing about whether requests were dropped.')}>
							<Chip size="small" variant="outlined" label={t('Not reachable')} />
						</Tooltip>
					)}
					{absent && (
						<Tooltip title={t('This gateway build does not export this counter.')}>
							<Chip size="small" variant="outlined" label={t('Not exported')} />
						</Tooltip>
					)}
				</Box>
				<Typography variant="caption" color="text.secondary" component="p" sx={{maxWidth: 460}}>
					{row.detail}
				</Typography>
			</TableCell>
			<TableCell align="right">{formatRate(row.rate, t)}</TableCell>
			{/* An absent family is not the number zero, so it must not render
			    as one. */}
			<TableCell align="right">{row.total ?? t('None')}</TableCell>
		</TableRow>
	);
}

export interface PDAdmissionPanelProps {
	report: PdAdmissionReport;
}

export default function PDAdmissionPanel({report}: PDAdmissionPanelProps) {
	const {t} = useTranslation();

	if (report.kind === 'unavailable') {
		return (
			<Alert severity="info">
				{t('Admission pressure is unavailable: the metrics scrape did not answer. This says nothing about whether requests are being dropped.')}
			</Alert>
		);
	}

	if (report.kind === 'not-exported') {
		return (
			<Alert severity="info">
				{t('This gateway does not export the per-endpoint admission counters, so queueing and drops cannot be reported here.')}
			</Alert>
		);
	}

	const rows: IValveRow[] = [
		{
			family: PD_ADMISSION_QUEUED,
			name: t('Queued (held)'),
			detail: t('Every healthy prefill endpoint was at its in-flight cap, so the request was parked on a FIFO and will still be served. Not a loss.'),
			rate: report.queuedRate,
			total: report.queuedTotal,
		},
		{
			family: PD_ADMISSION_OVERFLOW_SHED,
			name: t('Dropped — queue overflow'),
			detail: t('Every endpoint was capped AND every queue was full, so the request was dropped with a 429. The only drop possible when queueing is enabled.'),
			rate: report.overflowRate,
			total: report.overflowTotal,
		},
		{
			family: PD_ADMISSION_SHED,
			name: t('Dropped — no queue'),
			detail: t('Every endpoint was capped and queueing is disabled, so the request was dropped immediately with a 429.'),
			rate: report.shedRate,
			total: report.shedTotal,
		},
	];

	return (
		<Stack spacing={1.5}>
			<VerdictAlert report={report} />
			<ModeNote report={report} />

			{/* ⭐ Drops as ONE quantity, above the per-valve split. Exactly one
			    valve is armed, so a reader scanning the split alone can land on
			    the structurally-zero row and conclude nothing was dropped —
			    which is precisely the defect this panel removes. */}
			<Box display="flex" alignItems="baseline" gap={1}>
				<Typography variant="subtitle2">{t('Requests dropped')}</Typography>
				<Typography variant="h6">{formatRate(report.dropRate, t)}</Typography>
				<Typography variant="caption" color="text.secondary">
					{t('across both valves, of which one is armed')}
				</Typography>
			</Box>

			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>{t('Outcome')}</TableCell>
						<TableCell align="right">{t('Rate')}</TableCell>
						<TableCell align="right">{t('Lifetime')}</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{rows.map(row => (
						<ValveRow key={row.family} row={row} report={report} />
					))}
				</TableBody>
			</Table>

			{/* ⚠️ The admission layer is not the only way a prefill request can
			    fail, and a zero here must not be read as "nothing failed". */}
			<Typography variant="caption" color="text.secondary">
				{t('These counters cover only the per-endpoint admission layer, which is reached when at least one prefill endpoint is healthy. A request that found no healthy prefill endpoint at all fails earlier and is not counted here.')}
			</Typography>
		</Stack>
	);
}
