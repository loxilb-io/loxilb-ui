//---------------------------------------------------------
// Policer attachment (Stage 3.3, on the QoS page)
//---------------------------------------------------------
// Which configured policers are actually programmed in the datapath, and
// which are configured but shaping nothing.
//
// ⭐⭐ The design rule this panel is built on, which corrects the campaign
// brief rather than following it: the gauge and REST `attached` are NOT two
// independent opinions to be reconciled. Both are the same
// `PolEntry.attached()` predicate (pkg/loxinet/qospol.go:175 and :203) read
// at different times — REST live, the gauge from a store republished on each
// mutation and each 10s tick. So a disagreement is bounded staleness, not
// drift, and this renderer says so in as many words instead of raising it as
// a fault. The actionable signal is the value they agree on.
//
// ⚠️ Chips are built here rather than routed through DataTable's
// `type: 'state'` column: `state_color()` defaults to 'error' for any string
// it does not recognise and matches lowercase ENGLISH substrings, so a
// translated state would paint ko/ja operators a red cell for a healthy
// policer.

import {Alert, Box, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography} from '@mui/material';
import {
	IPolicerAttachmentRow,
	PolicerAttachmentReport,
} from 'observability/policerAttachment';
import {useTranslation} from 'react-i18next';

/** The attachment answer as one chip. `undefined` is its own state, never "no". */
function AttachmentChip({row}: {row: IPolicerAttachmentRow}) {
	const {t} = useTranslation();
	if (row.attached === true) {
		return <Chip size="small" color="success" variant="outlined" label={t('Shaping')} />;
	}
	if (row.attached === false) {
		// ⭐ The finding. The only chip on this panel that is coloured as a
		// problem, because it is the only state that is one.
		return (
			<Tooltip title={t('At least one of this policer’s attachment points is not programmed, so no traffic is being shaped by it. The gateway retries every 10 seconds; a policer stuck here usually points at an attachment target that does not exist.')}>
				<Chip size="small" color="warning" label={t('Shaping nothing')} />
			</Tooltip>
		);
	}
	return (
		<Tooltip title={t('The attachment state could not be established from either source. This is not a report that the policer is broken.')}>
			<Chip size="small" variant="outlined" label={t('Unknown')} />
		</Tooltip>
	);
}

/**
 * How well the row is corroborated, as a caveat beside the answer — never as
 * a severity. `agreed` renders nothing: a check that passes is not news.
 */
function CorroborationNote({row}: {row: IPolicerAttachmentRow}) {
	const {t} = useTranslation();
	switch (row.corroboration) {
		case 'agreed':
			return null;
		case 'conflict':
			// ⚠️ Explicitly NOT a fault. Same predicate, two read times.
			return (
				<Tooltip title={t('The metric and the API answered differently. They compute the same check, so this means the state changed within the last scrape — it resolves itself. Refresh in a few seconds.')}>
					<Chip size="small" variant="outlined" label={t('Settling')} />
				</Tooltip>
			);
		case 'metric-only':
			return (
				<Tooltip
					title={
						row.listedInRest
							? t('This gateway build does not report attachment over the API, so the metric is the only source.')
							: t('The API no longer lists this policer. A series outlasting a delete clears on the next scrape.')
					}>
					<Chip size="small" variant="outlined" label={row.listedInRest ? t('Metric only') : t('Deleted')} />
				</Tooltip>
			);
		case 'rest-only':
			return (
				<Tooltip title={t('The attachment metric has no series for this policer yet. Within a few seconds of creating it that is expected; if it persists, the metrics endpoint is the thing to check, not the policer.')}>
					<Chip size="small" variant="outlined" label={t('Not in metrics')} />
				</Tooltip>
			);
		case 'unreported':
			return (
				<Tooltip title={t('Neither the metric nor this gateway build’s API reports attachment for this policer.')}>
					<Chip size="small" variant="outlined" label={t('Not reported')} />
				</Tooltip>
			);
	}
}

function VerdictAlert({report}: {report: Extract<PolicerAttachmentReport, {kind: 'ok'}>}) {
	const {t} = useTranslation();
	switch (report.verdict) {
		case 'pending-attachment':
			// ⭐ The one state an operator can act on, so the only warning.
			return (
				<Alert severity="warning">
					{/* ⚠️ `n`, never `count`: i18next treats `count` as a plural
					    selector and resolves `key_one`/`key_other` instead of the
					    literal key, which silently renders the raw key text. */}
					{t('{{n}} of {{total}} policers are configured but shaping nothing: an attachment point is not programmed in the datapath. The gateway retries every 10 seconds, so a policer that stays here is usually attached to a target that does not exist — check that the rule or port it names is still configured.', {
						n: report.pending,
						total: report.configured ?? report.rows.length,
					})}
				</Alert>
			);
		case 'none-configured':
			// ⭐ NOT a warning and NOT a no-data state. No policer is
			// configured, so an empty gauge is exactly correct.
			return (
				<Alert severity="info">
					{t('No QoS policer is configured, so nothing is being rate-limited and the attachment metric is correctly empty. Add a policy under QoS to shape a rule or a port.')}
				</Alert>
			);
		case 'all-attached':
			return (
				<Alert severity="success">
					{t('All {{n}} configured policers are programmed in the datapath and shaping traffic.', {n: report.attached})}
				</Alert>
			);
		case 'incomplete':
			return (
				<Alert severity="info">
					{report.familyExported
						? t('No policer is reported as pending, but not every attachment state could be established. The rows below say which, and why.')
						: t('The policy list reports policers, but the attachment metric is not being exported at all. That is a gap in monitoring rather than a datapath fault — the policers themselves may be shaping normally.')}
				</Alert>
			);
		case 'unknown-configuration':
			return (
				<Alert severity="info">
					{t('The QoS policy list is unavailable, so the panel cannot tell an unused feature apart from a missing metric. Any policers the metric does report are listed below.')}
				</Alert>
			);
	}
}

export interface PolicerAttachmentPanelProps {
	report: PolicerAttachmentReport;
}

export default function PolicerAttachmentPanel({report}: PolicerAttachmentPanelProps) {
	const {t} = useTranslation();

	if (report.kind === 'unavailable') {
		return (
			<Alert severity="info">
				{t('Policer attachment is unavailable: the metrics scrape did not answer. This says nothing about whether rate limiting is working.')}
			</Alert>
		);
	}

	return (
		<Stack spacing={1.5}>
			<VerdictAlert report={report} />

			{/* ⚠️ The empty table is suppressed rather than rendered with a
			    "no rows" line: the verdict above has already said why there
			    are none, and in the none-configured case that is the correct
			    state, not an absence of data. */}
			{report.rows.length > 0 && (
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>{t('Policer')}</TableCell>
							<TableCell>{t('Attachment')}</TableCell>
							<TableCell>{t('Source')}</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{report.rows.map(row => (
							<TableRow key={row.ident}>
								<TableCell sx={{fontFamily: 'monospace'}}>
									{row.ident}
									{!row.listedInRest && (
										<Typography variant="caption" color="text.secondary" component="p">
											{t('No longer configured')}
										</Typography>
									)}
								</TableCell>
								<TableCell>
									<AttachmentChip row={row} />
								</TableCell>
								<TableCell>
									<Box display="flex" alignItems="center" gap={1}>
										<CorroborationNote row={row} />
									</Box>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</Stack>
	);
}
