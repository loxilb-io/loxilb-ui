//---------------------------------------------------------
// QoS page: admission by priority band, log loss, rule pools
//---------------------------------------------------------
// Each panel answers one question over the measured interval between the last
// two snapshots and says so. Wording rules (see observability/qosSignals):
// parks are not an outcome, an absent family is never zero, and pool growth
// is not called a leak.

import {Alert, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography} from '@mui/material';
import {BAND_TERMINAL_OUTCOMES, ILogLossLevel, IBandService, SignalReport} from 'observability/qosSignals';
import {RateResult} from 'observability/rates';
import {useTranslation} from 'react-i18next';
import {formatAbsence, formatRate} from './rateText';

function IntervalNote({intervalMs}: {intervalMs?: number}) {
	const {t} = useTranslation();
	return (
		<Typography variant="caption" color="text.secondary">
			{intervalMs === undefined
				? t('Rates need two snapshots in a row; they appear after the next refresh.')
				: t('Rates over the measured interval of {{seconds}} s between the last two snapshots.', {seconds: Math.round(intervalMs / 1000)})}
		</Typography>
	);
}

function NotReported<T>({report}: {report: Exclude<SignalReport<T>, {kind: 'ok'}>}) {
	const {t} = useTranslation();
	if (report.kind === 'no-data') return <Typography variant="body2" color="text.secondary">{t('No data')}</Typography>;
	return <Typography variant="body2" color="text.secondary">{formatAbsence(report.reading, t)}</Typography>;
}

const OUTCOME_LABELS: Record<string, string> = {admitted: 'Admitted', shed: 'Shed', expired: 'Expired', cancelled: 'Cancelled'};

export function BandOutcomesPanel({report}: {report: SignalReport<{services: IBandService[]; intervalMs?: number}>}) {
	const {t} = useTranslation();
	if (report.kind !== 'ok') return <NotReported report={report} />;
	if (report.services.length === 0) {
		return <Typography variant="body2" color="text.secondary">{t('No AI-gateway service with a model pool is reporting bands.')}</Typography>;
	}
	const rate = (value: RateResult) => formatRate(value, t);
	return (
		<Stack spacing={2}>
			{report.services.map(service => (
				<TableContainer key={service.service}>
					<Table size="small" aria-label={t('Admission by band for {{service}}', {service: service.service})}>
						<TableHead>
							<TableRow>
								<TableCell component="th" scope="col">{service.service}</TableCell>
								{BAND_TERMINAL_OUTCOMES.map(outcome => (
									<TableCell key={outcome} component="th" scope="col" align="right">{t(OUTCOME_LABELS[outcome])}</TableCell>
								))}
								<TableCell component="th" scope="col" align="right" title={t('Counts parks, once per park; not an outcome and not a share of requests.')}>{t('Parks')}</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{service.bands.map(band => (
								<TableRow key={band.band}>
									<TableCell component="th" scope="row">{t(band.band)}</TableCell>
									{BAND_TERMINAL_OUTCOMES.map(outcome => (
										<TableCell key={outcome} align="right">{rate(band.outcomes[outcome])}</TableCell>
									))}
									<TableCell align="right">{rate(band.parks)}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			))}
			<Typography variant="caption" color="text.secondary">
				{t('Admitted, shed, expired and cancelled are terminal, one per request. Parks overlap them. Requests refused for other reasons (queue full, tenant share, no capacity) are not counted here.')}
			</Typography>
			<IntervalNote intervalMs={report.intervalMs} />
		</Stack>
	);
}

export function LogLossPanel({report}: {report: SignalReport<{levels: ILogLossLevel[]; dropping: boolean; everDropped: boolean; intervalMs?: number}>}) {
	const {t} = useTranslation();
	if (report.kind !== 'ok') return <NotReported report={report} />;
	return (
		<Stack spacing={1}>
			{report.dropping ? (
				<Alert severity="warning">{t('Log lines are being dropped: the log\'s output is slower than lines arrive. Requests are not held for it, but those lines are lost.')}</Alert>
			) : report.everDropped ? (
				<Alert severity="info">{t('Log lines were dropped earlier since the process started; none in the measured interval.')}</Alert>
			) : (
				<Alert severity="success">{t('No log line dropped since the process started.')}</Alert>
			)}
			<TableContainer>
				<Table size="small" aria-label={t('Log lines dropped by level')}>
					<TableHead>
						<TableRow>
							<TableCell component="th" scope="col">{t('Level')}</TableCell>
							<TableCell component="th" scope="col" align="right">{t('Dropped since start')}</TableCell>
							<TableCell component="th" scope="col" align="right">{t('Rate')}</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{report.levels.map(level => (
							<TableRow key={level.level}>
								<TableCell component="th" scope="row">{level.level}</TableCell>
								<TableCell align="right">{level.total === undefined ? '–' : level.total}</TableCell>
								<TableCell align="right">{formatRate(level.rate, t)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>
			<IntervalNote intervalMs={report.intervalMs} />
		</Stack>
	);
}

export function ProxyPoolsPanel({report}: {report: SignalReport<{live: number | undefined; livePrevious: number | undefined; freedTotal: number | undefined; freedRate: RateResult}>}) {
	const {t} = useTranslation();
	if (report.kind !== 'ok') return <NotReported report={report} />;
	const change = report.live !== undefined && report.livePrevious !== undefined ? report.live - report.livePrevious : undefined;
	return (
		<Stack spacing={1}>
			<Typography variant="body2">
				{t('Pools held now: {{live}}', {live: report.live ?? '–'})}
				{change !== undefined && change !== 0 ? ` (${change > 0 ? '+' : ''}${change})` : ''}
			</Typography>
			<Typography variant="body2">
				{t('Freed since start: {{total}} · freeing now: {{rate}}', {total: report.freedTotal ?? '–', rate: formatRate(report.freedRate, t)})}
			</Typography>
			<Typography variant="caption" color="text.secondary">
				{t('One pool per rule, plus each deleted rule\'s pool until its last connection, HTTP/2 session or capacity permit lets go. More pools than rules for a while after deletes is expected; growth alone is not a leak.')}
			</Typography>
		</Stack>
	);
}
