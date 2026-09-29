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
// Compact by design: the verdict, plus the Tier-0 reconciliation alert when
// the two Tier-0 counters disagree (a metrics-writer defect). The per-tier
// and per-model tables are Grafana's ("P/D routing tier mix").

import {Alert, Stack} from '@mui/material';
import {IPDTierGates, PDTierMixReport, Tier0Reconciliation} from 'observability/pdTiers';
import {useTranslation} from 'react-i18next';
import {formatRatio} from './rateText';

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
					{t('No prefill selections in the last sample window, so no affinity share is reported.')}
				</Alert>
			);
		case 'unknown-configuration':
			return (
				<Alert severity="info">
					{gates
						? t('The affinity share cannot be derived from the current samples yet, so no judgement is made about cache-aware routing.')
						: t('The load-balancer rule list is unavailable, so the panel cannot say whether an empty affinity tier is expected here or a problem.')}
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
			{t('Tier-0 selections ({{tier}}) and the session-hit counter ({{hits}}) disagree. These two counters are written together at the same routing decision, so one of them is dropping increments — treat Tier-0 figures in Grafana as unreliable and report the mismatch. Admission and routing are unaffected.', {
				tier: reconciliation.tierSelections,
				hits: reconciliation.sessionHits,
			})}
		</Alert>
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
		</Stack>
	);
}
