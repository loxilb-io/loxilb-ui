//---------------------------------------------------------
// Token-quota utilization (Stage 3.6, on the AI Tenant Rate Limits page)
//---------------------------------------------------------
// How much of each configured tokens-per-minute bound is currently spent,
// across the six identity scopes the gateway meters on.
//
// ⭐⭐ THE QUESTION THIS PANEL ANSWERS, and it is not "how full is the
// bucket". It is "are these limits being enforced at all?" An empty
// exposition is the reading in both the benign case (nothing configured) and
// the dangerous one (the quota store is unreachable, every bucket drops out
// of the gateway's ladder, and traffic that should be throttled is admitted).
// The two are told apart by the configuration read's ERROR CODE, never by the
// metric — so the store state is rendered first and the table second.
//
// ⚠️⚠️ UTILIZATION IS NEVER CLAMPED. A value above 1.0 is the limiter working:
// a response's exact token usage is known only at settle, so a bucket goes
// into post-hoc debt and reads over 1.0 until it refills. Painting that red as
// an error, or capping the bar at 100%, would report correct behaviour as a
// fault. `in-debt` is a distinct, explained state.
//
// ⚠️ Chips and severities are built here rather than through DataTable's
// `type: 'state'` column: `state_color()` defaults to 'error' for any string
// it does not recognise and matches lowercase ENGLISH substrings, so a
// translated state paints ko/ja operators a red cell for a healthy gateway.

import {Alert, AlertTitle, Box, Chip, LinearProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography} from '@mui/material';
import {
	IQuotaAnomaly,
	IQuotaReport,
	IQuotaRow,
	QuotaScope,
	ScopeAbsence,
	quotaScope,
} from 'observability/tokenQuota';
import {useTranslation} from 'react-i18next';
import {TFunction} from 'i18next';
import {ModelName} from './modelLabel';

function scopeTitle(scope: QuotaScope, t: TFunction): string {
	switch (scope) {
		case 'tenant': return t('Tenant');
		case 'tenant-model': return t('Tenant × model');
		case 'user': return t('User');
		case 'user-model': return t('User × model');
		case 'key': return t('API key');
		case 'vip': return t('Service (shared)');
	}
}

/**
 * ⚠️ The VIP scope's wording is deliberately NOT the manifest's. The vendored
 * manifest and the gauge HELP both call this bucket "keyless", but
 * `quotaBucketsFor` appends it for EVERY request on a service whose
 * `vip_shared_tpm` is set, and the API's own field description says it is
 * "charged by every token-metered response on the service — credentialed and
 * keyless alike". Only the DENIAL is keyless-specific. Copying the manifest's
 * word here would tell an operator their credentialed traffic does not fill
 * this bucket, which is the opposite of what happens.
 */
function scopeDetail(scope: QuotaScope, t: TFunction): string {
	switch (scope) {
		case 'tenant':
			return t('The tenant’s aggregate bound. Every token-metered response from the tenant is charged here, whatever model or user it came from.');
		case 'tenant-model':
			return t('A bound on one model within a tenant, charged in addition to the tenant aggregate. It has no configured default: unset means no bucket.');
		case 'user':
			return t('One verified user’s bound. The user identity comes from bearer/JWT validation only.');
		case 'user-model':
			return t('A bound on one model for one verified user, charged in addition to the user aggregate. It has no configured default.');
		case 'key':
			return t('One API key’s own bound, keyed by the store’s opaque key identifier — never the key material.');
		case 'vip':
			return t('A service-wide shared bound, charged by every token-metered response on the service, credentialed and keyless alike. Only keyless requests are denied by it; credentialed traffic fills it but is admitted on its own bounds.');
	}
}

function absenceText(reason: ScopeAbsence, t: TFunction): string {
	switch (reason) {
		// ⚠️⚠️ Not "configure a limit". Nothing an operator sets on this scope
		// will make it appear while the gateway cannot attribute a user.
		case 'no-user-identity':
			return t('No series, and none is possible: this gateway resolves no user identity. User quotas are charged only for requests carrying a validated bearer/JWT identity — an API-key-only service attributes no user, so configuring a user limit here would change nothing.');
		case 'awaiting-charge':
			return t('A limit is configured, but the bucket is created by the first charge and removed again after a period of inactivity. No series means nothing has been charged recently — not that the limit is missing.');
		case 'no-limit':
			return t('No limit resolves for this scope, so the gateway creates no bucket and exports nothing. This is the expected reading, not a gap.');
		case 'unexplained':
			return t('A limit resolves and this scope publishes from the store rather than waiting for a charge, so a series was expected. Absence here is worth reporting.');
	}
}

//---------------------------------------------------------
// The store-state banner — rendered before anything else
//---------------------------------------------------------

function VerdictAlert({report}: {report: IQuotaReport}) {
	const {t} = useTranslation();
	switch (report.verdict) {
		// ⚠️⚠️ THE ONE ALARM. The store is configured and not answering, so
		// every bucket drops out of the gateway's ladder and nothing is being
		// enforced — while the metric looks exactly like a gateway with no
		// quotas at all.
		case 'enforcement-offline':
			return (
				<Alert severity="error">
					<AlertTitle>{t('Token quotas are not being enforced')}</AlertTitle>
					{t('The quota store is configured but not answering. The gateway drops a bucket it cannot read rather than failing requests, so every token limit below is currently unenforced and traffic that should be throttled is being admitted. The metrics look identical to a gateway with no quotas configured — this banner is the only thing that separates them.')}
				</Alert>
			);
		case 'not-configurable':
			return (
				<Alert severity="info">
					<AlertTitle>{t('No quota store is configured')}</AlertTitle>
					{t('This gateway has no quota store, so token limits can be neither configured nor enforced here and no quota series can appear. Nothing is wrong; nothing is being metered.')}
				</Alert>
			);
		case 'unconfigured':
			return (
				<Alert severity="info">
					<AlertTitle>{t('No token limits are configured')}</AlertTitle>
					{t('The quota store answered and holds no token-per-minute limit for any identity this page can resolve. Token spend is not bounded.')}
				</Alert>
			);
		case 'idle':
			return (
				<Alert severity="success">
					<AlertTitle>{t('Limits configured, nothing metered yet')}</AlertTitle>
					{t('At least one token limit resolves, but no bucket currently exists. A bucket appears on the first charge against it and is removed again after a period of inactivity, so this is the expected reading on an idle gateway.')}
				</Alert>
			);
		case 'active':
			return (
				<Alert severity="success">
					<AlertTitle>{t('Token quotas are being enforced')}</AlertTitle>
					{t('Live quota buckets, charged at scrape time: {{n}}.', {n: report.rows.length})}
				</Alert>
			);
		// ⚠️ 3.4's fourth state, carried forward: the configuration read did
		// not answer and did not say why, so neither answer may be defaulted to.
		case 'indeterminate':
			return (
				<Alert severity="warning">
					<AlertTitle>{t('Whether quotas are enforced cannot be determined')}</AlertTitle>
					{t('The quota configuration could not be read, and the failure did not identify the store’s state. An empty quota table below therefore means nothing either way — it is equally consistent with no quotas configured and with quotas silently not being enforced.')}
				</Alert>
			);
	}
}

/**
 * ⚠️ Rendered independently of the verdict, never folded into it. A gateway
 * can be actively metering AND have cold-opened, which means a window of
 * traffic after the restart went unmetered.
 */
function ColdOpenNote({report}: {report: IQuotaReport}) {
	const {t} = useTranslation();
	if (!report.coldOpened) return null;
	return (
		<Alert severity="warning">
			{t('This gateway started serving quota traffic on empty state, with no peer having warmed it up. Spend from before that start was not carried over, so quotas admitted more than their bound allowed until the buckets refilled.')}
		</Alert>
	);
}

function AnomalyNote({anomalies}: {anomalies: readonly IQuotaAnomaly[]}) {
	const {t} = useTranslation();
	if (anomalies.length === 0) return null;
	// ⭐ Scoped as a data-trust caveat, like 3.4's contradictory valves: the
	// collector emits a scope's utilization and limit from one loop iteration
	// and skips any bucket whose limit is not positive, so neither anomaly is
	// a state the gateway can be in. It is a scrape or parse defect.
	return (
		<Alert severity="warning">
			{t('{{n}} quota series could not be paired with a usable limit. The gateway publishes a bucket’s utilization and its limit together and never publishes a non-positive limit, so this is a defect in the scrape rather than a state of the gateway. Treat the affected rows as missing, not as zero.', {n: anomalies.length})}
		</Alert>
	);
}

//---------------------------------------------------------
// Rows
//---------------------------------------------------------

function PressureChip({row}: {row: IQuotaRow}) {
	const {t} = useTranslation();
	switch (row.pressure) {
		case 'within':
			return null;
		case 'saturated':
			return (
				<Tooltip title={t('The bucket is exactly at its bound, so the next charge is denied until it refills.')}>
					<Chip size="small" color="warning" variant="outlined" label={t('At limit')} />
				</Tooltip>
			);
		// ⚠️ "In debt" is explained, not alarmed. It is the documented shape
		// of a settled over-spend, not a fault.
		case 'in-debt':
			return (
				<Tooltip title={t('Spend settled past the bound. Exact token usage is known only when a response completes, so a bucket can legitimately end up over its limit and reads above 100% until it refills.')}>
					<Chip size="small" color="warning" variant="outlined" label={t('In debt')} />
				</Tooltip>
			);
	}
}

function identityCell(row: IQuotaRow) {
	const labels = quotaScope(row.scope).labels;
	return labels.map(l => (l === 'model' ? <ModelName key={l} model={row.labels[l]} /> : <span key={l}>{row.labels[l]}</span>));
}

function QuotaRowView({row}: {row: IQuotaRow}) {
	const {t} = useTranslation();
	const percent = row.utilization * 100;
	return (
		<TableRow>
			<TableCell>
				<Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
					{identityCell(row)}
					<PressureChip row={row} />
				</Box>
			</TableCell>
			<TableCell align="right">
				<Box display="flex" alignItems="center" gap={1} justifyContent="flex-end">
					{/* ⚠️ The BAR is capped at 100 because a progress bar has no
					    way to draw past full — the NUMBER beside it is not, and
					    it is the number that carries the reading. */}
					<LinearProgress
						variant="determinate"
						value={Math.min(100, Math.max(0, percent))}
						color={row.pressure === 'within' ? 'primary' : 'warning'}
						sx={{width: 80, height: 6, borderRadius: 3}}
					/>
					<Typography variant="body2">{t('{{percent}}%', {percent: percent.toFixed(1)})}</Typography>
				</Box>
			</TableCell>
			<TableCell align="right">{row.limitTokens}</TableCell>
			{/* ⚠️ Negative headroom is shown as negative: the magnitude is how
			    far past the bound the settle went. */}
			<TableCell align="right">{Math.round(row.headroomTokens)}</TableCell>
		</TableRow>
	);
}

export interface TokenQuotaPanelProps {
	report: IQuotaReport;
	/**
	 * Whether a limit resolves for each scope, from the caller's configuration
	 * read. ⚠️ A scope missing from this map is NOT "no limit" — the gateway's
	 * collection endpoints are POST-only, so the caller cannot enumerate every
	 * identity and a scope it could not check must not be reported as unset.
	 */
	limitResolvesByScope: Partial<Record<QuotaScope, boolean>>;
	/** Per-scope absence reasons, from `scopeAbsence`. */
	absenceByScope: Partial<Record<QuotaScope, ScopeAbsence>>;
}

export default function TokenQuotaPanel({report, absenceByScope}: TokenQuotaPanelProps) {
	const {t} = useTranslation();

	return (
		<Stack spacing={1.5}>
			<VerdictAlert report={report} />
			<ColdOpenNote report={report} />
			<AnomalyNote anomalies={report.anomalies} />

			{report.rows.length > 0 && (
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>{t('Identity')}</TableCell>
							<TableCell align="right">{t('Spent')}</TableCell>
							<TableCell align="right">{t('Limit (tokens/min)')}</TableCell>
							<TableCell align="right">{t('Headroom (tokens)')}</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{report.scopes.filter(s => s.rows.length > 0).map(s => (
							<>
								<TableRow key={`h-${s.scope}`}>
									<TableCell colSpan={4} sx={{bgcolor: 'action.hover'}}>
										<Typography variant="subtitle2">{scopeTitle(s.scope, t)}</Typography>
										<Typography variant="caption" color="text.secondary" component="p" sx={{maxWidth: 560}}>
											{scopeDetail(s.scope, t)}
										</Typography>
									</TableCell>
								</TableRow>
								{s.rows.map(row => <QuotaRowView key={`${s.scope}-${Object.values(row.labels).join('/')}`} row={row} />)}
							</>
						))}
					</TableBody>
				</Table>
			)}

			{/* ⭐ Every scope with no rows gets its OWN sentence. The six
			    preconditions differ in kind — one of them is not satisfiable at
			    all on this gateway — so a single shared "no data" would be
			    wrong for most of them. */}
			<Stack spacing={0.5}>
				{report.scopes.filter(s => s.rows.length === 0).map(s => {
					const reason = absenceByScope[s.scope];
					return (
						<Box key={s.scope}>
							<Typography variant="subtitle2">{scopeTitle(s.scope, t)}</Typography>
							{/* ⚠️ The scope's MEANING is rendered here too, not only in the
							    table header above. An absent scope is the common case, so a
							    description reachable only when the bucket is live would never
							    be read — and for the shared-service scope that description is
							    the correction that matters: the manifest calls that bucket
							    "keyless", and an operator who never sees this sentence would
							    go on believing their credentialed traffic does not fill it. */}
							<Typography variant="caption" color="text.secondary" component="p" sx={{maxWidth: 560}}>
								{scopeDetail(s.scope, t)}
							</Typography>
							<Typography variant="caption" color="text.secondary" component="p" sx={{maxWidth: 560}}>
								{reason ? absenceText(reason, t) : t('Whether this scope should have a bucket could not be checked: the gateway offers no way to list the identities configured for it.')}
							</Typography>
						</Box>
					);
				})}
			</Stack>
		</Stack>
	);
}
