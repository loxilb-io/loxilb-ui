//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import SearchIcon from '@mui/icons-material/Search';
import {Button, Stack, TextField} from '@mui/material';
import TenantRateLimitInputForm from 'components/input/TenantRateLimitInputForm';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import TenantRateLimitTable from 'components/table/ai/TenantRateLimitTable';
import {query_get_tenant_ratelimit, query_get_tenant_ratelimits_for, request_set_tenant_ratelimit} from 'connector/instance/ai';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useApiKeys} from 'hooks/query/queryHooks';
import {useQueryInstanceData} from 'hooks/query/common';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {t} from 'i18next';
import React, {Fragment, useRef, useState} from 'react';
import {ITenantRateLimitMod} from 'types/ai';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------

// The gateway has no list-all for tenant rate limits (GET is per-tenant
// only), so the tenant set shown is derived from the tenants seen on API
// keys plus any tenants the user looked up or configured in this session.
export default function AITenantRateLimitPage() {
	const inst = useInstanceFromURL();

	const {data: apiKeys} = useApiKeys(inst);
	const [extraTenants, setExtraTenants] = useState<string[]>([]);

	const tenants = React.useMemo(() => {
		// Guard against a non-array hook result (gateway 402 returns an error object).
		const keyRows = Array.isArray(apiKeys) ? apiKeys : [];
		const fromKeys = keyRows.map(k => k.tenant_id ?? '').filter(id => id.length > 0);
		return Array.from(new Set([...fromKeys, ...extraTenants])).sort();
	}, [apiKeys, extraTenants]);

	const {data: entries, refetch} = useQueryInstanceData(
		['ai_ratelimits', tenants.join('|')],
		instance => query_get_tenant_ratelimits_for(instance, tenants),
		inst,
	);
	const rows = entries ?? [];

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const [lookupTenant, setLookupTenant] = useState('');
	const {openPopUp, enableYes} = usePopUp();
	const {errorPopup, showAddError, closeErrorPopup} = useErrorPopup();

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
					const {isValid, ...cleanData} = data;
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

				const res = await request_set_tenant_ratelimit(inst, formRef.current);
				if (res.status === 'success') {
					rememberTenant(formRef.current.tenant_id);
					openPopUp(t('Success'), t('Applied successfully.'), t('OK'));
					set_selected_rows([]);
					setTimeout(() => {
						refetch();
					}, 1000);
				} else showAddError('AI tenant rate limit', res.error);
			},
			true,
		);
	};

	const handleAdd = () => openUpsertForm();

	const handleEdit = () => {
		if (selected_rows.length !== 1) return;
		const item = rows[selected_rows[0]];
		if (!item) return;
		openUpsertForm({tenant_id: item.tenant_id, rps: item.rps ?? 0, tokens_per_min: item.tokens_per_min ?? 0});
	};

	const handleRefresh = () => {
		set_selected_rows([]);
		refetch();
	};

	return (
		<Fragment>
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
				<Button variant="outlined" size="small" startIcon={<SearchIcon />} onClick={handleLookup} disabled={lookupTenant.trim().length === 0}>
					{t('Lookup')}
				</Button>
			</Stack>

			<TenantRateLimitTable
				data={rows}
				selected_rows={selected_rows}
				onChangeSelectedRows={set_selected_rows}
				onAdd={handleAdd}
				onEdit={handleEdit}
				onRefresh={handleRefresh}
			/>

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
