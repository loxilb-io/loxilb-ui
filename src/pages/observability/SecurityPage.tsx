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

import {Box, Grid, Table, TableBody, TableCell, TableHead, TableRow, Typography} from '@mui/material';
import FreshnessBadge from 'components/observability/FreshnessBadge';
import ObservabilityStateFrame from 'components/observability/ObservabilityStateFrame';
import {classifyViewState} from 'components/observability/observabilityState';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useMetricsSnapshot} from 'hooks/query/observabilityHooks';
import {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {estimateQuantile, mergeHistogramSeries} from 'observability/histogram';
import {selectSamples, selectScalar} from 'observability/selectors';
import {familySumRate, groupRates, rateMaxGapMs} from 'observability/snapshotRates';
import {CadenceSelector, PanelPaper, StatRow, formatRate, useObservabilityApplicable} from './common';

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
	const maxGap = rateMaxGapMs(cadenceMs);

	const ruleDrops = useMemo(() => (snapshot ? groupRates(history, 'loxilb_fw_rule_drop_packets_total', ['fw_rule'], maxGap) : []), [snapshot, history, maxGap]);
	const l4Errors = useMemo(() => (snapshot ? groupRates(history, 'loxilb_l4_error_events_total', ['proto', 'reason'], maxGap) : []), [snapshot, history, maxGap]);
	const opaSyncs = useMemo(() => (snapshot ? groupRates(history, 'loxilb_opa_watcher_syncs_total', ['status'], maxGap) : []), [snapshot, history, maxGap]);
	const rateLimitHits = useMemo(() => (snapshot ? groupRates(history, 'loxilb_ai_rate_limit_hits_total', ['reason'], maxGap) : []), [snapshot, history, maxGap]);
	const ipfilterRules = useMemo(() => (snapshot ? selectSamples(snapshot, 'loxilb_ipfilter_rules') : []), [snapshot]);

	const opaSyncDuration = useMemo(() => {
		const family = snapshot?.families.get('loxilb_opa_sync_duration_seconds');
		if (!family || family.samples.length === 0) return undefined;
		const merged = mergeHistogramSeries(family);
		if (merged.kind !== 'ok') return {invalid: merged.reason} as const;
		const q = (p: number) => estimateQuantile(merged.series, p);
		return {p50: q(0.5), p95: q(0.95), count: merged.series.count} as const;
	}, [snapshot]);

	const hasData = (snapshot?.diagnostics.totalSamples ?? 0) > 0;
	const state = classifyViewState({
		applicable,
		isLoading,
		snapshot,
		hasData,
		nowMs: Date.now(),
		cadenceMs,
	});

	const quantileText = (r: ReturnType<typeof estimateQuantile>) => {
		if (r.kind === 'ok') return `${(r.value * 1000).toFixed(0)} ms`;
		if (r.kind === 'above-ladder') return t('Above bucket range');
		return t('N/A');
	};

	const gauge = (family: string, labels?: Record<string, string>) => {
		const v = snapshot ? selectScalar(snapshot, family, labels) : undefined;
		return v === undefined ? t('No data') : v;
	};

	const cbRaw = snapshot ? selectScalar(snapshot, 'loxilb_opa_circuit_breaker_state') : undefined;
	const cbState = circuitBreakerLabel(cbRaw);
	const cbText =
		cbRaw === undefined
			? t('No data')
			: cbState === 'closed'
				? t('Closed (healthy)')
				: cbState === 'open'
					? t('Open (bypassing OPA)')
					: cbState === 'half-open'
						? t('Half-open (probing)')
						: String(cbRaw);

	return (
		<Box sx={{p: 2}}>
			<Box display="flex" alignItems="center" gap={2} sx={{mb: 2}}>
				<Typography variant="h5">{t('Security')}</Typography>
				{snapshot && !snapshot.failure && <FreshnessBadge receivedAtMs={snapshot.receivedAtMs} cadenceMs={cadenceMs} />}
				<CadenceSelector />
			</Box>

			<ObservabilityStateFrame state={state} name={t('Security')} onRetry={refetch}>
				<Grid container spacing={2}>
					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Connection protection')}>
							<StatRow label={t('SYN blocked')} value={formatRate(familySumRate(history, 'loxilb_security_syn_blocked_total', maxGap), t)} />
							<StatRow label={t('SYN passed')} value={formatRate(familySumRate(history, 'loxilb_security_syn_passed_total', maxGap), t)} />
							<StatRow label={t('SYN cookies issued')} value={formatRate(familySumRate(history, 'loxilb_security_syn_cookies_total', maxGap), t)} />
							<StatRow label={t('Connections blocked')} value={formatRate(familySumRate(history, 'loxilb_security_conn_blocked_total', maxGap), t)} />
							<StatRow label={t('Connections passed')} value={formatRate(familySumRate(history, 'loxilb_security_conn_passed_total', maxGap), t)} />
							<StatRow label={t('Unique source IPs tracked')} value={gauge('loxilb_security_unique_ips')} />
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('UDP protection')}>
							<StatRow label={t('UDP packets blocked')} value={formatRate(familySumRate(history, 'loxilb_security_udp_blocked_total', maxGap), t)} />
							<StatRow label={t('UDP packets passed')} value={formatRate(familySumRate(history, 'loxilb_security_udp_passed_total', maxGap), t)} />
							<StatRow label={t('UDP bytes blocked')} value={formatRate(familySumRate(history, 'loxilb_security_udp_bytes_blocked_total', maxGap), t, ' B/s')} />
							<StatRow label={t('UDP bytes passed')} value={formatRate(familySumRate(history, 'loxilb_security_udp_bytes_passed_total', maxGap), t, ' B/s')} />
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('Firewall')}>
							<StatRow label={t('Firewall rules active')} value={gauge('loxilb_firewall_rules')} />
							<StatRow label={t('Packets dropped (all rules)')} value={formatRate(familySumRate(history, 'loxilb_fw_drop_packets_total', maxGap), t)} />
							{ruleDrops.length > 0 && (
								<Table size="small" sx={{mt: 1}}>
									<TableHead>
										<TableRow>
											<TableCell>{t('Rule')}</TableCell>
											<TableCell align="right">{t('Drop rate')}</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{ruleDrops.map(g => (
											<TableRow key={g.labels.fw_rule ?? ''}>
												<TableCell>{g.labels.fw_rule ?? t('Unknown value')}</TableCell>
												<TableCell align="right">{formatRate(g.rate, t)}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('IP filter')}>
							{ipfilterRules.map(s => (
								<StatRow key={s.labelKey} label={`${t('Filter rules')} (${s.labels.type ?? t('Unknown value')})`} value={Number.isFinite(s.value) ? s.value : t('N/A')} />
							))}
							<StatRow label={t('Blacklist packets')} value={formatRate(familySumRate(history, 'loxilb_ipfilter_blacklist_packets_total', maxGap), t)} />
							<StatRow label={t('Blacklist bytes')} value={formatRate(familySumRate(history, 'loxilb_ipfilter_blacklist_bytes_total', maxGap), t, ' B/s')} />
							<StatRow label={t('Whitelist packets')} value={formatRate(familySumRate(history, 'loxilb_ipfilter_whitelist_packets_total', maxGap), t)} />
							<StatRow label={t('Whitelist bytes')} value={formatRate(familySumRate(history, 'loxilb_ipfilter_whitelist_bytes_total', maxGap), t, ' B/s')} />
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('L4 errors')}>
							{l4Errors.length === 0 ? (
								<Typography variant="body2" color="text.secondary">
									{t('No data')}
								</Typography>
							) : (
								<Table size="small">
									<TableHead>
										<TableRow>
											<TableCell>{t('Protocol')}</TableCell>
											<TableCell>{t('Reason')}</TableCell>
											<TableCell align="right">{t('Rate')}</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{l4Errors.map(g => (
											<TableRow key={`${g.labels.proto ?? ''} ${g.labels.reason ?? ''}`}>
												<TableCell>{g.labels.proto ?? t('Unknown value')}</TableCell>
												<TableCell>{g.labels.reason ?? t('Unknown value')}</TableCell>
												<TableCell align="right">{formatRate(g.rate, t)}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('OPA policy engine')}>
							<StatRow label={t('Circuit breaker')} value={cbText} />
							<StatRow label={t('OPA-managed firewall rules')} value={gauge('loxilb_opa_firewall_rules')} />
							{opaSyncs.map(g => (
								<StatRow key={g.labels.status ?? ''} label={`${t('Syncs')} (${g.labels.status ?? t('Unknown value')})`} value={formatRate(g.rate, t)} />
							))}
							{opaSyncDuration && !('invalid' in opaSyncDuration) && (
								<>
									<StatRow label={t('Sync duration p50')} value={quantileText(opaSyncDuration.p50)} />
									<StatRow label={t('Sync duration p95')} value={quantileText(opaSyncDuration.p95)} />
								</>
							)}
						</PanelPaper>
					</Grid>

					<Grid item xs={12} md={6}>
						<PanelPaper title={t('AI security events')}>
							<StatRow label={t('Model not allowed')} value={formatRate(familySumRate(history, 'loxilb_ai_model_not_allowed_total', maxGap), t)} />
							{rateLimitHits.map(g => (
								<StatRow
									key={g.labels.reason ?? ''}
									label={`${t('Rate limited')} (${g.labels.reason ?? t('Unknown value')})`}
									value={formatRate(g.rate, t)}
								/>
							))}
							{rateLimitHits.length === 0 && <StatRow label={t('Rate limited')} value={formatRate(familySumRate(history, 'loxilb_ai_rate_limit_hits_total', maxGap), t)} />}
							<StatRow label={t('Unmetered requests')} value={formatRate(familySumRate(history, 'loxilb_ai_unmetered_requests_total', maxGap), t)} />
							<StatRow label={t('Policy store unavailable')} value={formatRate(familySumRate(history, 'loxilb_ai_policy_store_unavailable_total', maxGap), t)} />
						</PanelPaper>
					</Grid>
				</Grid>
			</ObservabilityStateFrame>
		</Box>
	);
}
