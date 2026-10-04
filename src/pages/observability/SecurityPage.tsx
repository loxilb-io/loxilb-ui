//---------------------------------------------------------
// Security observability page (UI-MON-012)
//---------------------------------------------------------
// Composed from the REAL family groups on the gateway scrape: core security
// counters, firewall, IP filter, L4 errors, OPA, and AI security. There is
// no securityrate-prefixed family and no llamafirewall_*/pii_* family — PII
// activity is never synthesized from the zero-filled REST stub. The page is
// gateway-only at launch; each panel group below carries a scope so the
// firewall/core subset can flip to common when a versioned OSS metric-parity
// contract lands, as a data change here plus a registry split — not a
// rewrite.
//
// Compact by design: one blocked/dropped rate per protection, the OPA circuit
// breaker, and the two AI admission signals an operator acts on. Passed
// traffic, per-rule and per-reason breakdowns, byte rates and OPA sync
// durations are in Grafana's `loxilb-security` dashboard.

import {Alert, Box, Grid, Typography} from '@mui/material';
import FreshnessBadge from 'components/observability/FreshnessBadge';
import ObservabilityStateFrame from 'components/observability/ObservabilityStateFrame';
import {classifyViewState} from 'components/observability/observabilityState';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useMetricsSnapshot} from 'hooks/query/observabilityHooks';
import {useTranslation} from 'react-i18next';
import {selectScalar} from 'observability/selectors';
import {familySumRate, rateMaxGapMs} from 'observability/snapshotRates';
import {CadenceSelector, PanelPaper, StatRow, formatRate, useAbsenceExplanation, useObservabilityApplicable} from './common';

// Panel-group scopes. Every group is gateway-only today; 'parity-conditional'
// marks the groups the plan expects to become common once upstream OSS
// publishes a versioned statement of the loxilb_* families it emits.
export const SECURITY_PANEL_GROUPS = [
	{key: 'core', scope: 'parity-conditional'},
	{key: 'firewall', scope: 'parity-conditional'},
	{key: 'ipfilter', scope: 'parity-conditional'},
	{key: 'l4', scope: 'parity-conditional'},
	{key: 'opa', scope: 'gateway'},
	{key: 'aiSecurity', scope: 'gateway'},
] as const;

// loxilb_opa_circuit_breaker_state is a 0/1/2 enum; anything else renders as
// the raw number rather than being coerced to a known state.
export function circuitBreakerLabel(value: number | undefined): 'closed' | 'open' | 'half-open' | undefined {
	if (value === 0) return 'closed';
	if (value === 1) return 'open';
	if (value === 2) return 'half-open';
	return undefined;
}

export default function SecurityPage() {
	const {t} = useTranslation();
	const instance = useInstanceFromURL();
	const applicable = useObservabilityApplicable('page.security');
	const {snapshot, history, isLoading, cadenceMs, refetch} = useMetricsSnapshot(applicable ? instance : null);
	// Stage 3.5: let the no-data state say WHY, from the manifest contract.
	const absence = useAbsenceExplanation('page.security', snapshot);
	const maxGap = rateMaxGapMs(cadenceMs);
	const rate = (family: string) => familySumRate(history, family, maxGap);

	const hasData = (snapshot?.diagnostics.totalSamples ?? 0) > 0;
	const state = classifyViewState({
		applicable,
		isLoading,
		snapshot,
		hasData,
		nowMs: Date.now(),
		cadenceMs,
	});

	const gauge = (family: string, labels?: Record<string, string>) => {
		const v = snapshot ? selectScalar(snapshot, family, labels) : undefined;
		return v === undefined ? t('No data') : v;
	};

	// The gateway sets the blacklist rule count on every stats pass, and
	// creates one hit series per blacklist rule on that same pass. So a count
	// of 0 IS "no blacklist rule" — the hit family's absence then means that,
	// not a counter still warming up.
	const blacklistRules = snapshot ? selectScalar(snapshot, 'loxilb_ipfilter_rules', {type: 'blacklist'}) : undefined;
	const blacklistText = blacklistRules === 0 ? t('No blacklist rules') : formatRate(rate('loxilb_ipfilter_blacklist_packets_total'), t);

	const cbRaw = snapshot ? selectScalar(snapshot, 'loxilb_opa_circuit_breaker_state') : undefined;
	const cbState = circuitBreakerLabel(cbRaw);
	const cbText =
		cbRaw === undefined
			? t('No data')
			: cbState === 'closed'
				? t('Closed (healthy)')
				: cbState === 'open'
					? t('Open (not syncing)')
					: cbState === 'half-open'
						? t('Half-open (probing)')
						: String(cbRaw);

	// Fail CLOSED: each one is an AI request refused with 503 because the
	// API-key store is unreachable while the service requires a key.
	const storeUnavailable = rate('loxilb_ai_policy_store_unavailable_total');
	const refusing = storeUnavailable.kind === 'ok' && storeUnavailable.perSecond > 0;

	return (
		<Box sx={{p: 2}}>
			<Box display="flex" alignItems="center" gap={2} sx={{mb: 2}}>
				<Typography variant="h5" component="h2">{t('Security')}</Typography>
				{snapshot && !snapshot.failure && <FreshnessBadge receivedAtMs={snapshot.receivedAtMs} cadenceMs={cadenceMs} />}
				<CadenceSelector />
			</Box>

			<ObservabilityStateFrame state={state} absence={absence} name={t('Security')} onRetry={refetch}>
				<Grid container spacing={2}>
					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Connection protection')}>
							<StatRow label={t('SYN blocked')} value={formatRate(rate('loxilb_security_syn_blocked_total'), t)} />
							<StatRow label={t('Connections blocked')} value={formatRate(rate('loxilb_security_conn_blocked_total'), t)} />
							<StatRow label={t('UDP packets blocked')} value={formatRate(rate('loxilb_security_udp_blocked_total'), t)} />
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Firewall and IP filter')}>
							<StatRow label={t('Firewall rules active')} value={gauge('loxilb_firewall_rules')} />
							<StatRow label={t('Packets dropped (all rules)')} value={formatRate(rate('loxilb_fw_drop_packets_total'), t)} />
							<StatRow label={t('Blacklist hits')} value={blacklistText} />
							<StatRow label={t('L4 error events')} value={formatRate(rate('loxilb_l4_error_events_total'), t)} />
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('OPA policy engine')}>
							{cbState === 'open' && (
								<Alert severity="warning" sx={{mb: 1}}>
									{t('The OPA circuit breaker is open: the gateway has stopped fetching policy from OPA, so the OPA-managed firewall rules stay as they were at the last successful sync.')}
								</Alert>
							)}
							<StatRow label={t('Circuit breaker')} value={cbText} />
							<StatRow label={t('OPA-managed firewall rules')} value={gauge('loxilb_opa_firewall_rules')} />
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('AI security events')}>
							{refusing && (
								<Alert severity="error" sx={{mb: 1}}>
									{t('AI requests are being refused with 503: a service requires an API key and the key store is unconfigured or unreachable.')}
								</Alert>
							)}
							<StatRow label={t('Policy store unavailable')} value={formatRate(storeUnavailable, t)} />
							<StatRow label={t('Unmetered requests')} value={formatRate(rate('loxilb_ai_unmetered_requests_total'), t)} />
						</PanelPaper>
					</Grid>
				</Grid>
			</ObservabilityStateFrame>
		</Box>
	);
}
