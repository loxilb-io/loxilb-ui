//---------------------------------------------------------
// P/D prefill routing tier mix (Stage 3.2, on the P/D & KV page)
//---------------------------------------------------------
// Where prefill selections actually landed on the four-tier ladder, and
// whether the cache-affinity tiers are earning their configuration.
//
// ⭐⭐ The design rule, inherited from Stage 3.1's JWKS panel: a mix that is
// entirely Tier-2 min-load has TWO correct readings and only one is a finding.
// With `pd_cache_aware_mode` and `kvExactMode` both off, the datapath never
// attempts Tier-1 or Tier-1.5 — 0% affinity is then exactly what was asked
// for. The same mix with either gate OPEN means the gateway is running the
// affinity machinery and placing nothing with it, which an operator can act
// on. The verdict comes from `affinityVerdict`, computed once in the
// derivation layer so this renderer cannot get the configured case backwards.
//
// ⚠️ The tier chip is built here rather than routed through DataTable's
// `type: 'state'` column: `state_color()` defaults to 'error' for any string
// it does not recognise and matches lowercase ENGLISH substrings, so a
// translated tier name would paint ko/ja operators a red cell for a healthy
// mix.

import {Alert, Box, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography} from '@mui/material';
import type {TFunction} from 'i18next';
import {
	IPDTierGates,
	IPDTierRow,
	PDTier,
	PDTierMixReport,
	Tier0Reconciliation,
} from 'observability/pdTiers';
import {useTranslation} from 'react-i18next';
import {ModelName} from './modelLabel';
import {formatRate, formatRatio} from './rateText';

// One place a tier becomes words, so the ladder reads in the same order and
// the same vocabulary everywhere it is shown.
function tierText(tier: PDTier, t: TFunction): {name: string; detail: string} {
	switch (tier) {
		case 'tier0':
			return {
				name: t('Tier 0 — session'),
				detail: t('The request reused the endpoint pair its session key was already pinned to.'),
			};
		case 'tier1':
			return {
				name: t('Tier 1 — prefix'),
				detail: t('A shared system-prompt prefix routed the request to an endpoint that already holds it.'),
			};
		case 'tier15':
			return {
				name: t('Tier 1.5 — KV exact'),
				detail: t('The exact KV blocks this request needs were known to live on a specific endpoint.'),
			};
		case 'tier2':
			return {
				name: t('Tier 2 — min load'),
				detail: t('No affinity was available, so the least-loaded endpoint was chosen. Correct, but the cache there is cold.'),
			};
	}
}

function VerdictAlert({report, gates}: {report: Extract<PDTierMixReport, {kind: 'ok'}>; gates: IPDTierGates | undefined}) {
	const {t} = useTranslation();
	switch (report.verdict) {
		case 'configured-no-reuse':
			// ⭐ The one state an operator can act on, so it is the only one
			// that raises a warning.
			return (
				<Alert severity="warning">
					{t('Cache-aware routing is configured, but no prefill selection is reaching an affinity tier — every request is falling through to min-load on a cold cache. Check that requests carry the prefix or session key the tiers match on, and that the prefill endpoints are reporting KV inventory.')}
				</Alert>
			);
		case 'as-configured':
			// ⭐ NOT a warning. Neither affinity gate is open, so there is
			// nothing here to fix.
			return (
				<Alert severity="info">
					{t('Neither P/D cache-aware mode nor KV-exact routing is enabled on any rule, so selections falling through to min-load is the configured behaviour. Enable “P/D Cache-Aware Mode” on an AI rule to route by prompt prefix.')}
				</Alert>
			);
		case 'reuse-working':
			return (
				<Alert severity="success">
					{t('Affinity routing is placing requests: {{share}} of prefill selections reused a warm endpoint.', {share: formatRatio(report.affinityShare, t)})}
				</Alert>
			);
		case 'no-traffic':
			// 0/0. A percentage here would assert something nothing measured.
			return (
				<Alert severity="info">
					{t('No prefill selections in the last sample window. The tier totals below are lifetime counts from this gateway process.')}
				</Alert>
			);
		case 'unknown-configuration':
			return (
				<Alert severity="info">
					{gates
						? t('The affinity share cannot be derived from the current samples yet, so no judgement is made about cache-aware routing.')
						: t('The load-balancer rule list is unavailable, so the panel cannot say whether an empty affinity tier is expected here or a problem. The tier mix below is still live.')}
				</Alert>
			);
	}
}

function ReconciliationNote({reconciliation}: {reconciliation: Tier0Reconciliation}) {
	const {t} = useTranslation();
	// ⚠️ Deliberately silent on both the agreeing and the not-comparable
	// cases. A check that passes is not news, and "not comparable" is the
	// expected reading whenever no Tier-0 selection has happened — saying so
	// would put a caveat on every idle gateway.
	if (reconciliation.kind !== 'disagrees') return null;
	return (
		<Alert severity="warning">
			{/* ⚠️ Scoped narrowly on purpose: this is a metrics-writer defect,
			    not a traffic or configuration problem, so it qualifies the
			    numbers rather than reporting an incident. */}
			{t('Tier-0 selections ({{tier}}) and the session-hit counter ({{hits}}) disagree. These two counters are written together at the same routing decision, so one of them is dropping increments — treat the Tier-0 row below as unreliable and report the mismatch. Admission and routing are unaffected.', {
				tier: reconciliation.tierSelections,
				hits: reconciliation.sessionHits,
			})}
		</Alert>
	);
}

function TierRow({row}: {row: IPDTierRow}) {
	const {t} = useTranslation();
	const text = tierText(row.tier, t);
	return (
		<TableRow>
			<TableCell>
				<Box display="flex" alignItems="center" gap={1}>
					<Typography variant="body2">{text.name}</Typography>
					{/* An unreachable tier is labelled, never coloured as an
					    error: a zero there is the configuration working. */}
					{row.reachable === false && (
						<Tooltip title={t('This tier is not enabled on any rule, so the datapath never attempts it. A zero here is expected.')}>
							<Chip size="small" variant="outlined" label={t('Not enabled')} />
						</Tooltip>
					)}
				</Box>
				<Typography variant="caption" color="text.secondary" component="p" sx={{maxWidth: 420}}>
					{text.detail}
				</Typography>
			</TableCell>
			<TableCell align="right">{formatRate(row.rate, t)}</TableCell>
			<TableCell align="right">{formatRatio(row.share, t)}</TableCell>
			{/* No series at all is not the number zero, so it must not render
			    as one — the tier has never been selected. */}
			<TableCell align="right">{row.total ?? t('None')}</TableCell>
		</TableRow>
	);
}

export interface PDTierMixPanelProps {
	report: PDTierMixReport;
	/**
	 * The configuration gates, or `undefined` when the rule list is
	 * unavailable. Passed alongside the report because the empty-exposition
	 * copy depends on it: "no P/D rule configured" and "configured but idle"
	 * are different sentences and only one of them invites an operator to do
	 * anything.
	 */
	gates: IPDTierGates | undefined;
}

export default function PDTierMixPanel({report, gates}: PDTierMixPanelProps) {
	const {t} = useTranslation();

	if (report.kind === 'unavailable') {
		return <Alert severity="info">{t('Tier selection is unavailable: the metrics scrape did not answer. This says nothing about whether P/D routing is working.')}</Alert>;
	}

	if (report.kind === 'not-exported') {
		// ⚠️ A precondition, never an error. The family is
		// conditional-with-proven-writer: a child appears on the first
		// successful prefill selection and not before.
		return (
			<Alert severity="info">
				{gates?.pdDisagg
					? t('A rule is running P/D disaggregation, but no prefill selection has been recorded yet — the tier mix appears here once AI traffic reaches it.')
					: t('Prefill routing tiers appear here once a rule runs in P/D disaggregation mode and takes AI traffic.')}
			</Alert>
		);
	}

	return (
		<Stack spacing={1.5}>
			<VerdictAlert report={report} gates={gates} />
			<ReconciliationNote reconciliation={report.reconciliation} />

			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>{t('Tier')}</TableCell>
						<TableCell align="right">{t('Selections')}</TableCell>
						<TableCell align="right">{t('Share')}</TableCell>
						<TableCell align="right">{t('Lifetime')}</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{report.tiers.map(row => (
						<TierRow key={row.tier} row={row} />
					))}
				</TableBody>
			</Table>

			{report.byModel.length > 0 && (
				<>
					<Typography variant="subtitle2" sx={{mt: 1}}>
						{t('By model')}
					</Typography>
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell>{t('Model')}</TableCell>
								<TableCell align="right">{t('Warm-endpoint share')}</TableCell>
								<TableCell align="right">{t('Min-load fallback')}</TableCell>
								<TableCell align="right">{t('Lifetime')}</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{report.byModel.map(row => (
								<TableRow key={row.model}>
									{/* ⚠️ Two of this label's values are not model names —
									    the 64-model overflow bucket and the empty label for
									    traffic that declared no model. ModelName is the one
									    place that vocabulary lives. */}
									<TableCell sx={{fontFamily: 'monospace'}}>
										<ModelName model={row.model} />
									</TableCell>
									<TableCell align="right">{formatRatio(row.affinityShare, t)}</TableCell>
									<TableCell align="right">{formatRate(row.fallbackRate, t)}</TableCell>
									<TableCell align="right">{row.total ?? t('None')}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</>
			)}
		</Stack>
	);
}
