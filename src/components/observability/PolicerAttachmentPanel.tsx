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
// Compact by design: the verdict, then only the policers that are shaping
// nothing (the one actionable state). Healthy and unknown rows, and which
// source answered for each, are not listed.

import {Alert, Box, Stack, Typography} from '@mui/material';
import {PolicerAttachmentReport} from 'observability/policerAttachment';
import {useTranslation} from 'react-i18next';

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
						? t('No policer is reported as pending, but the attachment state of {{n}} of {{total}} policers could not be established. The metric and the API may still be settling after a change; refresh in a few seconds.', {n: report.unknown, total: report.configured ?? report.rows.length})
						: t('The policy list reports policers, but the attachment metric is not being exported at all. That is a gap in monitoring rather than a datapath fault — the policers themselves may be shaping normally.')}
				</Alert>
			);
		case 'unknown-configuration':
			return (
				<Alert severity="info">
					{t('The QoS policy list is unavailable, so the panel cannot tell an unused feature apart from a missing metric. Any policer the metric reports as shaping nothing is listed below.')}
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

	// ⭐ Only the finding. A row whose sources disagree is `undefined`, not
	// false, so a settling policer is never listed as shaping nothing.
	const shapingNothing = report.rows.filter(r => r.attached === false);
	return (
		<Stack spacing={1.5}>
			<VerdictAlert report={report} />
			{shapingNothing.length > 0 && (
				<Box component="ul" aria-label={t('Policers shaping nothing')} sx={{m: 0, pl: 2.5}}>
					{shapingNothing.map(row => (
						<li key={row.ident}>
							<Typography component="span" variant="body2" sx={{fontFamily: 'monospace'}}>
								{row.ident}
							</Typography>
							{/* A series outlasting a delete: say so, or the operator
							    goes looking for a policer that no longer exists. */}
							{row.listedInRest === false && (
								<Typography component="span" variant="caption" color="text.secondary">
									{' '}
									{t('(no longer configured)')}
								</Typography>
							)}
						</li>
					))}
				</Box>
			)}
		</Stack>
	);
}
