//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {getStableHash} from 'common';
import SearchIcon from '@mui/icons-material/Search';
import {Alert, Button, MenuItem, Stack, TextField, Typography} from '@mui/material';
import TenantRateLimitInputForm from 'components/input/TenantRateLimitInputForm';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import TenantRateLimitTable from 'components/table/ai/TenantRateLimitTable';
import UserRateLimitTable from 'components/table/ai/UserRateLimitTable';
import UserRateLimitInputForm from 'components/input/UserRateLimitInputForm';
import RateLimitDefaultsInputForm from 'components/input/RateLimitDefaultsInputForm';
import RateLimitDefaultsTable from 'components/table/ai/RateLimitDefaultsTable';
import {query_get_ratelimit_defaults, query_get_ratelimit_defaults_for, query_get_tenant_ratelimit, query_get_tenant_ratelimits_for, query_get_user_ratelimit, query_get_user_ratelimits, request_delete_ratelimit_defaults, request_delete_user_ratelimit, request_set_ratelimit_defaults, request_set_tenant_ratelimit, request_set_user_ratelimit} from 'connector/instance/ai';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import TokenQuotaPanel from 'components/observability/TokenQuotaPanel';
import {PanelPaper, useObservabilityApplicable} from 'pages/observability/common';
import {useMetricsSnapshot} from 'hooks/query/observabilityHooks';
import {useApiKeys, useJWTAuthProfiles, useLoadBalancerConfig} from 'hooks/query/queryHooks';
import {
	NO_QUOTA_DEFAULTS,
	QUOTA_SCOPES,
	QuotaScope,
	ScopeAbsence,
	effectiveLimit,
	resolveQuotaDefaults,
	scopeAbsence,
	tokenQuotaReport,
} from 'observability/tokenQuota';
import {useQueryInstanceData} from 'hooks/query/common';
import {fromQueryRefetch} from 'hooks/query/reconcile';
import {useReconcileReporter} from 'hooks/query/reconcileReport';
import {rateLimitDefaultsApplied, rateLimitDefaultsGone, tenantRateLimitAppeared, userRateLimitAppeared, userRateLimitGone} from 'hooks/query/confirmPredicates';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {t} from 'i18next';
import React, {Fragment, useMemo, useRef, useState} from 'react';
import {IRateLimitDefaultsMod, ITenantRateLimitMod, IUserRateLimitMod} from 'types/ai';
import {hasRequiredApiKeyPolicy} from 'types/ai_gateway';
import {toPageState} from 'components/state/pageState';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------

// The gateway has no list-all for tenant rate limits (GET is per-tenant
// only), so the tenant set shown is derived from the tenants seen on API
// keys plus any tenants the user looked up or configured in this session.
export default function AITenantRateLimitPage() {
	const inst = useInstanceFromURL();

	const {data: apiKeys, refetch: refetchApiKeys} = useApiKeys(inst);
	const {data: loadBalancers, refetch: refetchLb} = useLoadBalancerConfig(inst);
	const [extraTenants, setExtraTenants] = useState<string[]>([]);

	const tenants = React.useMemo(() => {
		// Guard against a non-array hook result (gateway 402 returns an error object).
		const keyRows = Array.isArray(apiKeys) ? apiKeys : [];
		const fromKeys = keyRows.map(k => k.tenant_id ?? '').filter(id => id.length > 0);
		return Array.from(new Set([...fromKeys, ...extraTenants])).sort();
	}, [apiKeys, extraTenants]);

	const ratelimit_query = useQueryInstanceData(
		['ai_ratelimits', tenants.join('|')],
		instance => query_get_tenant_ratelimits_for(instance, tenants),
		inst,
	);
	const {data: entries, refetch} = ratelimit_query;
	const rows = useMemo(() => entries ?? [], [entries]);

	//---------------------------------------------------------
	// Per-user rate limits (Stage 4.2)
	//---------------------------------------------------------
	// ⚠️ TENANT-DRIVEN BY NECESSITY, not by preference. The gateway serves a
	// user list per TENANT and exposes nothing that enumerates tenants, so
	// there is no "all user limits" read to build a flat table from — the same
	// "reachable but not enumerable" shape Stage 3.6 hit. The tenant set here
	// is the same one the table above uses: tenants seen on API keys, plus any
	// looked up in this session.
	const [userTenant, setUserTenant] = useState('');
	// Fall back to the first known tenant rather than leaving the section
	// blank, but never overwrite an explicit choice.
	const effectiveUserTenant = userTenant || tenants[0] || '';

	const user_query = useQueryInstanceData(
		['ai_user_ratelimits', effectiveUserTenant],
		instance => query_get_user_ratelimits(instance, effectiveUserTenant),
		effectiveUserTenant ? inst : null,
	);
	const userRows = useMemo(() => user_query.data ?? [], [user_query.data]);
	const [selected_user_rows, set_selected_user_rows] = useState<number[]>([]);
	const selectedUser = selected_user_rows.length === 1
		? userRows.find(r => getStableHash(`${r.tenant_id ?? ''}|${r.user_id ?? ''}`) === selected_user_rows[0]) ?? null
		: null;

	//---------------------------------------------------------
	// Token-quota utilization (Stage 3.6)
	//---------------------------------------------------------
	// ⭐⭐ This panel sits on the CONFIGURATION page on purpose. Its finding is
	// not "how full is the bucket" but "is any of this being enforced?", and
	// the only thing that can answer it is the quota store's own reachability
	// — which is a property of the configuration read, not of the metric. An
	// operator who has just set a limit here is exactly the person who needs
	// to be told it is not in force.
	const quotaApplicable = useObservabilityApplicable('panel.tokenQuota');
	const {snapshot, refetch: refetchMetrics} = useMetricsSnapshot(quotaApplicable ? inst : null);
	// ⚠️ NOT gated on `quotaApplicable`, which it was until Stage 4.2b. That
	// gate is a METRICS applicability check, and this read now feeds two
	// consumers with different needs: the panel below (metrics) and the
	// defaults EDITOR (configuration). The REST ladder is configurable on any
	// flavor that serves the endpoint, so gating it on a panel's applicability
	// left the editor with nothing to show — and an empty editor reads as
	// "no defaults are configured", which is a claim about the gateway rather
	// than about which panels apply here.
	const defaults_query = useQueryInstanceData(
		['ai_ratelimit_defaults'],
		instance => query_get_ratelimit_defaults(instance),
		inst,
	);
	const {data: jwtProfiles, refetch: refetchJwtProfiles} = useJWTAuthProfiles(quotaApplicable ? inst : null);

	//---------------------------------------------------------
	// Rate-limit defaults editor (Stage 4.2b)
	//---------------------------------------------------------
	// ⚠️ THE RULE ROWS CANNOT BE ENUMERATED. `GET .../defaults/rule` without a
	// service answers 404 rather than a collection, so the services shown are
	// exactly those asked about: any row configured in this session, plus any
	// looked up by name. Same shape as the tenant table above, for the same
	// reason, and the section says so rather than letting an empty table imply
	// that no service has an override.
	const [ruleIdents, setRuleIdents] = useState<string[]>([]);
	const [lookupRule, setLookupRule] = useState('');

	const defaults_rules_query = useQueryInstanceData(
		['ai_ratelimit_defaults_rules', ruleIdents.join('|')],
		instance => query_get_ratelimit_defaults_for(instance, ruleIdents),
		ruleIdents.length > 0 ? inst : null,
	);

	const defaultsRows = useMemo(() => {
		const globalRow = defaults_query.data?.global;
		return [...(globalRow ? [globalRow] : []), ...(defaults_rules_query.data ?? [])];
	}, [defaults_query.data, defaults_rules_query.data]);

	const [selected_defaults_rows, set_selected_defaults_rows] = useState<number[]>([]);
	const selectedDefaults = selected_defaults_rows.length === 1
		? defaultsRows.find(r => getStableHash(`${r.scope ?? ''}|${r.rule_ident ?? ''}`) === selected_defaults_rows[0]) ?? null
		: null;

	const rememberRule = (ident: string) => {
		setRuleIdents(prev => (prev.includes(ident) ? prev : [...prev, ident]));
	};

	// ⚠️ Both reads, always. The global row lives in one query and the rule
	// rows in another, so confirming a write against only one of them would
	// report a landed change as unconfirmed whenever the other held the row.
	const refetchDefaultsRows = async () => {
		const [globalRead, ruleRead] = await Promise.all([defaults_query.refetch(), defaults_rules_query.refetch()]);
		const globalRow = globalRead.data?.global;
		return [...(globalRow ? [globalRow] : []), ...(ruleRead.data ?? [])];
	};

	const quota = useMemo(() => {
		const read = defaults_query.data;
		const defaults = read ? resolveQuotaDefaults(
			read.global ? {
				defaultTenantTpm: read.global.default_tenant_tpm,
				defaultUserTpm: read.global.default_user_tpm,
				vipSharedTpm: read.global.vip_shared_tpm,
			} : undefined,
			// ⚠️ No rule row is read here. A rule row overrides per SERVICE,
			// and this page is not scoped to one service — asking for one
			// arbitrary rule's row would report the wrong expected limit for
			// every other service on the gateway.
			undefined,
		) : NO_QUOTA_DEFAULTS;

		// ⚠️⚠️ A scope is listed here only when the page could actually CHECK
		// it. The gateway's rate-limit collection endpoints are POST-only, so
		// there is no way to enumerate users, keys or services — and a scope
		// left out of this map renders as "not checked", never as "no limit".
		// Reporting an unchecked scope as unconfigured would be a claim the
		// page has no evidence for.
		const limitResolvesByScope: Partial<Record<QuotaScope, boolean>> = {
			tenant: rows.some(r => effectiveLimit('tenant', r.tokens_per_min, defaults) !== undefined)
				// With no tenant row read yet, a positive tenant default alone
				// already means every attributed tenant gets a bucket.
				|| effectiveLimit('tenant', undefined, defaults) !== undefined,
			'tenant-model': rows.some(r => (r.model_limits ?? []).some(m => effectiveLimit('tenant-model', m.tokens_per_min, defaults) !== undefined)),
			vip: effectiveLimit('vip', undefined, defaults) !== undefined,
		};

		// ⚠️ "A profile exists" is the most this page can honestly claim. It
		// rules user identity OUT when there is no JWT auth profile at all —
		// the gateway then never validates a bearer and no user can be
		// attributed — but it cannot rule it IN, since a profile still has to
		// be bound to the service the traffic arrives on.
		const userIdentityAvailable = (jwtProfiles ?? []).length > 0;

		const report = tokenQuotaReport({
			snapshot,
			storeState: read?.storeState ?? 'unknown',
			anyLimitResolves: Object.values(limitResolvesByScope).some(Boolean),
			userIdentityAvailable,
		});

		const absenceByScope: Partial<Record<QuotaScope, ScopeAbsence>> = {};
		for (const spec of QUOTA_SCOPES) {
			const resolves = limitResolvesByScope[spec.scope];
			// Unchecked stays unchecked: no entry, so the panel says so.
			if (resolves === undefined) continue;
			absenceByScope[spec.scope] = scopeAbsence(spec.scope, report, resolves);
		}
		return {report, limitResolvesByScope, absenceByScope};
	}, [snapshot, defaults_query.data, jwtProfiles, rows]);

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const [lookupTenant, setLookupTenant] = useState('');
	const {openPopUp, enableYes} = usePopUp();
	const {errorPopup, showAddError, closeErrorPopup} = useErrorPopup();
	const {report} = useReconcileReporter();

	const rememberTenant = (tenant_id: string) => {
		setExtraTenants(prev => (prev.includes(tenant_id) ? prev : [...prev, tenant_id]));
	};

	const handleLookup = async () => {
		if (!inst) return;
		const tenant_id = lookupTenant.trim();
		if (tenant_id.length === 0) return;

		const entry = await query_get_tenant_ratelimit(inst, tenant_id);
		if (entry) {
			rememberTenant(tenant_id);
			setLookupTenant('');
			refetch();
		} else {
			openPopUp(t('Not Found'), t('No rate limit is configured for tenant "{{tenant}}".', {tenant: tenant_id}), t('OK'));
		}
	};

	const formRef = useRef<ITenantRateLimitMod | null>(null);
	const openUpsertForm = (initial?: ITenantRateLimitMod) => {
		if (!inst) return;

		const input_form = (
			<TenantRateLimitInputForm
				key={Date.now()}
					value={initial}
					onChange={data => {
						const {isValid, errors, ...cleanData} = data;
						formRef.current = cleanData;
					enableYes(isValid);
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			t('Apply'),
			t('Cancel'),
			async () => {
				if (!formRef.current) return;

				const tenantId = formRef.current.tenant_id;
				const res = await request_set_tenant_ratelimit(inst, formRef.current);
				if (res.status === 'confirmed') {
					rememberTenant(tenantId);
					set_selected_rows([]);
					await report({refetch: fromQueryRefetch(refetch), confirm: tenantRateLimitAppeared(tenantId)}, t('Applied successfully.'));
				} else showAddError('AI tenant rate limit', t(res.localeKey));
			},
			true,
		);
	};

	const handleAdd = () => openUpsertForm();

	const handleEdit = () => {
		if (selected_rows.length !== 1) return;
		const item = rows.find(r => getStableHash(String(r.tenant_id ?? '')) === selected_rows[0]);
		if (!item) return;
		openUpsertForm({
			tenant_id: item.tenant_id,
			rps: item.rps ?? 0,
			tokens_per_min: item.tokens_per_min ?? 0,
			burst_pct: item.burst_pct ?? 0,
			model_limits: item.model_limits ?? [],
		});
	};

	const userFormRef = useRef<IUserRateLimitMod | null>(null);

	// `seed` carries the entry being edited; its absence means Add.
	const openUserForm = (seed?: IUserRateLimitMod) => {
		if (!inst) return;
		userFormRef.current = null;
		const editing = seed?.user_id !== undefined && seed.user_id.length > 0;

		const input_form = (
			<UserRateLimitInputForm
				key={`${seed?.tenant_id ?? ''}|${seed?.user_id ?? ''}|${Date.now()}`}
				value={seed}
				identityLocked={editing}
				onChange={data => {
					const {isValid, errors, ...cleanData} = data;
					userFormRef.current = cleanData;
					enableYes(!!isValid);
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			t('Apply'),
			t('Cancel'),
			async () => {
				const payload = userFormRef.current;
				if (!payload) return;
				const res = await request_set_user_ratelimit(inst, payload);
				set_selected_user_rows([]);
				if (res.status === 'confirmed') {
					rememberTenant(payload.tenant_id);
					await report({refetch: fromQueryRefetch(user_query.refetch), confirm: userRateLimitAppeared(payload.user_id)}, t('Applied successfully.'));
				} else showAddError('AI user rate limit', t(res.localeKey));
			},
			true,
		);
	};

	const handleUserAdd = () => openUserForm({tenant_id: effectiveUserTenant, user_id: ''});

	// ⚠️⚠️ THE EDIT PATH MUST RE-READ THE USER, never open on the list row.
	// The list omits model limits and the upsert REPLACES the model set, so
	// saving a form seeded from the list row would delete every per-model
	// quota the user has. Verified on the gateway: re-posting without a model
	// row removes it.
	const handleUserEdit = async () => {
		if (!inst || !selectedUser?.user_id) return;
		const full = await query_get_user_ratelimit(inst, selectedUser.tenant_id ?? effectiveUserTenant, selectedUser.user_id);
		if (!full) {
			// Gone between the list read and now — say so rather than opening a
			// form that would recreate it as a new entry.
			openPopUp(t('Not Found'), t('This user no longer has an explicit rate-limit entry. Refresh the list.'), t('OK'));
			return;
		}
		openUserForm(full);
	};

	const handleUserDelete = async () => {
		if (!inst || !selectedUser?.user_id) return;
		const tenantId = selectedUser.tenant_id ?? effectiveUserTenant;
		const userId = selectedUser.user_id;
		const res = await request_delete_user_ratelimit(inst, tenantId, userId);
		set_selected_user_rows([]);
		if (res.status === 'confirmed') {
			await report({refetch: fromQueryRefetch(user_query.refetch), confirm: userRateLimitGone(userId)}, t('Deleted {{count}} item(s) successfully.', {count: 1}));
		} else showAddError('AI user rate limit', t(res.localeKey));
	};

	const defaultsFormRef = useRef<IRateLimitDefaultsMod | null>(null);

	// `seed` carries the row being edited; its absence means Add.
	const openDefaultsForm = (seed?: IRateLimitDefaultsMod) => {
		if (!inst) return;
		defaultsFormRef.current = null;
		const editing = seed !== undefined;

		const input_form = (
			<RateLimitDefaultsInputForm
				key={`${seed?.scope ?? ''}|${seed?.rule_ident ?? ''}|${Date.now()}`}
				value={seed}
				identityLocked={editing}
				onChange={data => {
					const {isValid, errors, ...cleanData} = data;
					defaultsFormRef.current = cleanData;
					enableYes(!!isValid);
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			t('Apply'),
			t('Cancel'),
			async () => {
				const payload = defaultsFormRef.current;
				if (!payload) return;
				const res = await request_set_ratelimit_defaults(inst, payload);
				set_selected_defaults_rows([]);
				if (res.status === 'confirmed') {
					// A rule row the operator has just written must join the
					// asked-about set, or their own change would not appear.
					if (payload.scope === 'rule' && payload.rule_ident) rememberRule(payload.rule_ident);
					await report({refetch: refetchDefaultsRows, confirm: rateLimitDefaultsApplied(payload)}, t('Applied successfully.'));
				} else showAddError('AI rate limit defaults', t(res.localeKey));
			},
			true,
		);
	};

	const handleDefaultsAdd = () => openDefaultsForm();

	// ⚠️⚠️ THE FORM IS SEEDED FROM THE FULL ROW, never from a subset, because
	// the POST REPLACES the row: a field missing from the seed would be sent as
	// zero and CLEAR a limit the operator never touched. The list read carries
	// every field, so the row itself is a complete seed — unlike the per-user
	// table above, whose list omits model limits and needs a re-read.
	const handleDefaultsEdit = () => {
		if (!selectedDefaults) return;
		openDefaultsForm({
			scope: selectedDefaults.scope,
			rule_ident: selectedDefaults.rule_ident,
			default_user_rps: selectedDefaults.default_user_rps ?? 0,
			default_user_tpm: selectedDefaults.default_user_tpm ?? 0,
			default_tenant_rps: selectedDefaults.default_tenant_rps ?? 0,
			default_tenant_tpm: selectedDefaults.default_tenant_tpm ?? 0,
			vip_shared_rps: selectedDefaults.vip_shared_rps ?? 0,
			vip_shared_tpm: selectedDefaults.vip_shared_tpm ?? 0,
		});
	};

	const handleDefaultsDelete = async () => {
		if (!inst || !selectedDefaults) return;
		const {scope, rule_ident} = selectedDefaults;
		const res = await request_delete_ratelimit_defaults(inst, scope, rule_ident);
		set_selected_defaults_rows([]);
		if (res.status === 'confirmed') {
			await report({refetch: refetchDefaultsRows, confirm: rateLimitDefaultsGone(scope, rule_ident)}, t('Deleted {{count}} item(s) successfully.', {count: 1}));
		} else showAddError('AI rate limit defaults', t(res.localeKey));
	};

	const handleRuleLookup = async () => {
		if (!inst) return;
		const ident = lookupRule.trim();
		if (ident.length === 0) return;
		const found = await query_get_ratelimit_defaults_for(inst, [ident]);
		if (found.length > 0) {
			rememberRule(ident);
			setLookupRule('');
			defaults_rules_query.refetch();
		} else {
			// ⚠️ Worded as inheritance, not as a missing object: a service with
			// no row is the normal case and means it uses the global defaults.
			openPopUp(t('Not Found'), t('No rate-limit defaults row is configured for service "{{service}}". It uses the global defaults.', {service: ident}), t('OK'));
		}
	};

	const handleRefresh = () => {
		set_selected_rows([]);
		// ⚠️⚠️ EVERY dependency, not just the rate-limit rows. Refreshing only
		// `refetch()` is the defect #106 fixed on the JWT page and this page
		// repeated: the table's rows are the one thing on this page that is
		// NOT the whole story, and each stale companion read makes the page
		// assert something false with no operator control able to correct it.
		refetch();
		// The tenant set is derived from the tenants seen on API keys (there is
		// no list-all for tenant rate limits), so a key created elsewhere —
		// another console, or the API-key page in this session — never joins
		// the list and its tenant's limit stays invisible.
		refetchApiKeys();
		// Gates the "enforcement is not proven" warning below. An operator can
		// attach a policy that requires data-plane API keys, press Refresh, and
		// still be told their quotas are inert.
		refetchLb();
		// ⭐ Added by Stage 3.6 and NOT in the stage brief, which predates it.
		// This read carries the quota store's STATE, which is the token-quota
		// panel's entire finding: leaving it stale means an operator who has
		// just configured (or lost) the quota store is shown the previous
		// verdict — including "quotas are not enforced" after they have been.
		defaults_query.refetch();
		// Decides whether the user-identity scopes can ever report. Creating a
		// JWT auth profile is exactly what changes that answer.
		refetchJwtProfiles();
		// Same reasoning one step further, matching the JWT page: an operator
		// pressing Refresh after setting a limit expects the utilization
		// verdict to move too, not just the configuration rows.
		refetchMetrics();
		// Stage 4.2's section is another read this page paints from.
		user_query.refetch();
		// ⭐ And 4.2b's. `defaults_query` above carries only the GLOBAL row;
		// the per-service rows are a separate read, so refreshing one and not
		// the other leaves half the ladder stale — the exact half-refresh
		// defect 4.0 fixed on this page.
		defaults_rules_query.refetch();
		set_selected_defaults_rows([]);
	};

	return (
		<Fragment>
			{rows.length > 0 && !hasRequiredApiKeyPolicy(loadBalancers ?? []) && (
				<Alert severity="warning" sx={{mb: 1}}>
					{t('Tenant quotas are configured, but no loaded service explicitly requires data-plane API keys. Quota enforcement is not proven until a required policy and a live request are verified.')}
				</Alert>
			)}
			<Stack direction="row" spacing={1} sx={{mb: 1}} alignItems="center">
				<TextField
					size="small"
					label={t('Tenant ID lookup')}
					value={lookupTenant}
					onChange={e => setLookupTenant(e.target.value)}
					onKeyDown={e => {
						if (e.key === 'Enter') handleLookup();
					}}
				/>
				{/* ⚠️ The page carries TWO buttons reading "Lookup" — this one and
				    the service-defaults one below — so the visible word alone names
				    neither. `aria-label` keeps the compact label on screen while
				    giving each its own accessible name; it CONTAINS the visible
				    text on purpose (WCAG 2.5.3 Label in Name), so speech control
				    still reaches it by saying "Lookup". */}
				<Button
					variant="outlined"
					size="small"
					aria-label={t('Lookup tenant')}
					startIcon={<SearchIcon />}
					onClick={handleLookup}
					disabled={lookupTenant.trim().length === 0}
				>
					{t('Lookup')}
				</Button>
			</Stack>

			{quotaApplicable && (
				<PanelPaper title={t('Token-quota utilization')}>
					<TokenQuotaPanel
						report={quota.report}
						limitResolvesByScope={quota.limitResolvesByScope}
						absenceByScope={quota.absenceByScope}
					/>
				</PanelPaper>
			)}

			<TenantRateLimitTable
				data={rows}
				selected_rows={selected_rows}
				onChangeSelectedRows={set_selected_rows}
				onAdd={handleAdd}
				onEdit={handleEdit}
				onRefresh={handleRefresh}
				state={toPageState(ratelimit_query, {op: 'ai_ratelimit.list'})}
			/>

			{/* ── Per-user overrides (Stage 4.2) ───────────────────────────
			    Scoped to one tenant because the gateway has no read that
			    enumerates them: there is a list per tenant and nothing above
			    it. */}
			<Stack spacing={1} sx={{mt: 3}}>
				<Stack direction="row" spacing={1} alignItems="center">
					<TextField
						select
						size="small"
						label={t('Per-user limits for tenant')}
						value={effectiveUserTenant}
						onChange={e => {
							setUserTenant(e.target.value);
							set_selected_user_rows([]);
						}}
						sx={{minWidth: 240}}
						disabled={tenants.length === 0}
					>
						{tenants.map(tenant => (
							<MenuItem value={tenant} key={tenant}>
								{tenant}
							</MenuItem>
						))}
					</TextField>
					{tenants.length === 0 && (
						<Typography variant="body2" color="text.secondary">
							{t('No tenant is known yet. Look one up above, or create an API key for it.')}
						</Typography>
					)}
				</Stack>

				{/* ⚠️ An empty list is not "nobody is limited". The gateway omits
				    users who have no explicit entry, and those users are governed
				    by the configured defaults — so absence here means inheritance,
				    and leaving the table's bare "No rows" to speak would imply the
				    opposite of the truth. */}
				{effectiveUserTenant && userRows.length === 0 && user_query.isSuccess && (
					<Alert severity="info">
						{t('No user in this tenant has an explicit override. Every user is governed by the configured rate-limit defaults, and by nothing if none are set.')}
					</Alert>
				)}

				{effectiveUserTenant && (
					<UserRateLimitTable
						data={userRows}
						selected_rows={selected_user_rows}
						onChangeSelectedRows={set_selected_user_rows}
						onAdd={handleUserAdd}
						onEdit={handleUserEdit}
						onDelete={handleUserDelete}
						onRefresh={() => {
							set_selected_user_rows([]);
							user_query.refetch();
						}}
						state={toPageState(user_query, {op: 'ai_user_ratelimit.list'})}
					/>
				)}
			</Stack>

			{/* ── Rate-limit defaults (Stage 4.2b) ─────────────────────────
			    Level 3 of the ladder: what applies to an identity with no entry
			    of its own. Placed last because it is what the two tables above
			    fall through TO. */}
			<Stack spacing={1} sx={{mt: 3}}>
				<Stack direction="row" spacing={1} alignItems="center">
					<TextField
						size="small"
						label={t('Service lookup')}
						value={lookupRule}
						onChange={e => setLookupRule(e.target.value)}
						onKeyDown={e => {
							if (e.key === 'Enter') handleRuleLookup();
						}}
					/>
					{/* The second "Lookup" — see the tenant one above. */}
					<Button
						variant="outlined"
						size="small"
						aria-label={t('Lookup service')}
						startIcon={<SearchIcon />}
						onClick={handleRuleLookup}
						disabled={lookupRule.trim().length === 0}
					>
						{t('Lookup')}
					</Button>
				</Stack>

				{/* ⚠️⚠️ AN UNREADABLE STORE MUST NOT RENDER AS "NO DEFAULTS". The
				    ladder lives in the AI key store, and when that store is
				    unreachable the read returns no rows — indistinguishable, on
				    screen, from a gateway that simply has none configured. The two
				    demand opposite actions, so the state is named explicitly and
				    the difference between "configured but unenforced" and "not
				    configured" is never left for the operator to guess. */}
				{defaults_query.data && defaults_query.data.storeState !== 'readable' && (
					<Alert severity={defaults_query.data.storeState === 'unavailable' ? 'error' : 'warning'}>
						{defaults_query.data.storeState === 'unavailable'
							? t('The AI key store is configured but not answering, so the defaults below could not be read and no token quota is being enforced while this lasts. An empty table here is not evidence that no defaults are set.')
							: defaults_query.data.storeState === 'unconfigured'
								? t('No AI key store is configured, so rate-limit defaults can be neither stored nor enforced. Configure a key store on the gateway before setting defaults here.')
								: t('The rate-limit defaults could not be read and the reason is not one this page can classify. An empty table here is not evidence that no defaults are set.')}
					</Alert>
				)}

				{/* ⚠️ Said before the table, not after: there is no read that
				    enumerates per-service rows, so the table's contents are a
				    function of what was asked for. Without this an operator would
				    reasonably conclude that no service overrides the global row. */}
				<Alert severity="info">
					{t('Per-service rows cannot be listed by the gateway. This table shows the global row and only the services looked up or configured in this session — a service that is absent here may still have its own row.')}
				</Alert>

				<RateLimitDefaultsTable
					data={defaultsRows}
					selected_rows={selected_defaults_rows}
					onChangeSelectedRows={set_selected_defaults_rows}
					onAdd={handleDefaultsAdd}
					onEdit={handleDefaultsEdit}
					onDelete={handleDefaultsDelete}
					onRefresh={() => {
						set_selected_defaults_rows([]);
						defaults_query.refetch();
						defaults_rules_query.refetch();
					}}
					state={toPageState(defaults_query, {
						op: 'ai_ratelimit_defaults.list',
						// ⚠️ The read's DATA is a ladder object, never an array, so
						// the default emptiness test can never be true and the table
						// would report `data` while showing nothing. Emptiness here
						// is a property of the two reads TOGETHER.
						isEmpty: read => !read.global && (defaults_rules_query.data ?? []).length === 0,
					})}
				/>
			</Stack>

			{/* Error Popup */}
			<ErrorPopUp
				isOpen={errorPopup.isOpen}
				onClose={closeErrorPopup}
				title={errorPopup.title}
				mainMessage={errorPopup.mainMessage}
				errorData={errorPopup.errorData}
				buttonText={t('OK')}
			/>
		</Fragment>
	);
}
