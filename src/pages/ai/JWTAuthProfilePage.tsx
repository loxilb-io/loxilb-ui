//---------------------------------------------------------
// JWT auth profiles page (J1)
//---------------------------------------------------------
// Profile CRUD for data-plane bearer-token admission. LB rules reference a
// profile BY NAME (AIGatewaySettingsForm's selector is populated from this
// same list), and several rules may share one.
//
// Two contract facts shape the whole page:
//   - POST is create-OR-REPLACE and there is NO PATCH, so an edit loads the
//     whole entry and sends it whole. A partial body reverts what it omits.
//   - A profile referenced by any LB rule is not deletable (409). The page
//     computes the referencing rule names from the LB config it already has,
//     so the refusal is explained — and warned about — rather than decoded
//     from a status code after the fact.

import {Alert, Stack} from '@mui/material';
import {getStableHash} from 'common';
import SingleTextField from 'components/element/SingleTextField';
import ValueBunch from 'components/element/ValueBunch';
import JWTAuthProfileInputForm from 'components/input/JWTAuthProfileInputForm';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import ErrorPopUp from 'components/modal/ErrorPopUp';
import JWTAuthProfileTable from 'components/table/ai/JWTAuthProfileTable';
import {toPageState} from 'components/state/pageState';
import {request_delete_jwtauthprofile, request_upsert_jwtauthprofile} from 'connector/instance/ai_jwt';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useJWTAuthProfiles, useLoadBalancerConfig} from 'hooks/query/queryHooks';
import {fromQueryRefetch} from 'hooks/query/reconcile';
import {useReconcileReporter} from 'hooks/query/reconcileReport';
import {useErrorPopup} from 'hooks/useErrorPopup';
import {t} from 'i18next';
import React, {Fragment, useRef, useState} from 'react';
import {IJWTAuthProfileEntry, JWT_PROFILE_DEFAULTS, rulesReferencingProfile} from 'types/ai_jwt';

function DetailPanel(props: {data: IJWTAuthProfileEntry; referencedBy: string[]}) {
	const {data, referencedBy} = props;
	const audiences = data.audiences ?? [];

	return (
		<SubTitlePannel title={data.name ?? ''} sub_title={t('Details')}>
			<Stack spacing={2}>
				<ValueBunch name={t('Issuer')}>
					<SingleTextField label={t('Issuer')} value={data.issuer} />
					<SingleTextField label={t('JWKS URL')} value={data.jwks_url || t('OIDC discovery')} />
					<SingleTextField label={t('JWKS refresh (s)')} value={String(data.refresh_sec ?? JWT_PROFILE_DEFAULTS.refresh_sec)} />
					<SingleTextField label={t('Clock skew (s)')} value={String(data.leeway_sec ?? JWT_PROFILE_DEFAULTS.leeway_sec)} />
				</ValueBunch>
				<ValueBunch name={t('Admission')}>
					<SingleTextField label={t('Audiences')} value={audiences.length > 0 ? audiences.join(', ') : t('Any (check skipped)')} />
					<SingleTextField label={t('Signature algorithms')} value={(data.algs ?? JWT_PROFILE_DEFAULTS.algs).join(', ')} />
					<SingleTextField label={t('Model authorization')} value={data.model_authz ?? JWT_PROFILE_DEFAULTS.model_authz} />
					<SingleTextField label={t('Default tenant')} value={data.default_tenant || t('None (such tokens are denied)')} />
				</ValueBunch>
				<ValueBunch name={t('Claims')}>
					<SingleTextField label={t('Tenant claim')} value={data.tenant_claim ?? JWT_PROFILE_DEFAULTS.tenant_claim} />
					<SingleTextField label={t('User claim')} value={data.user_claim ?? JWT_PROFILE_DEFAULTS.user_claim} />
					<SingleTextField label={t('Models claim')} value={data.models_claim || t('Derived from roles')} />
					<SingleTextField label={t('Roles claim')} value={data.roles_claim ?? JWT_PROFILE_DEFAULTS.roles_claim} />
					<SingleTextField label={t('Model role prefix')} value={data.model_role_prefix ?? JWT_PROFILE_DEFAULTS.model_role_prefix} />
					<SingleTextField label={t('Username claim')} value={data.username_claim ?? JWT_PROFILE_DEFAULTS.username_claim} />
				</ValueBunch>
				<ValueBunch name={t('Upstream')}>
					<SingleTextField label={t('Forward identity')} value={data.forward_identity ? t('Yes') : t('No')} />
					<SingleTextField label={t('Authorization passthrough')} value={data.authorization_passthrough ? t('Yes') : t('No')} />
					<SingleTextField label={t('Referenced by')} value={referencedBy.length > 0 ? referencedBy.join(', ') : t('None')} />
				</ValueBunch>
			</Stack>
		</SubTitlePannel>
	);
}

export default function JWTAuthProfilePage() {
	const inst = useInstanceFromURL();

	const profile_query = useJWTAuthProfiles(inst);
	const {data, refetch} = profile_query;
	// The rule list is only used to explain references. Its failure must never
	// break profile management, so it is read defensively and an empty answer
	// simply means "no references known" — the gateway still decides.
	const {data: lbData, refetch: refetchLb} = useLoadBalancerConfig(inst);

	const profiles = React.useMemo(() => {
		const rows = Array.isArray(data) ? data : [];
		return [...rows].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
	}, [data]);

	const referencesByName = React.useMemo(() => {
		const configs = Array.isArray(lbData) ? lbData : undefined;
		const out: Record<string, string[]> = {};
		for (const p of profiles) out[p.name ?? ''] = rulesReferencingProfile(configs, p.name ?? '');
		return out;
	}, [profiles, lbData]);

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const {openPopUp, enableYes} = usePopUp();
	const {errorPopup, showAddError, showDeleteError, closeErrorPopup} = useErrorPopup();
	const {report, reconcile} = useReconcileReporter();

	const selectedProfile = selected_rows.length === 1 ? profiles.find(p => getStableHash(p.name ?? '') === selected_rows[0]) ?? null : null;

	const formRef = useRef<IJWTAuthProfileEntry | null>(null);

	// One flow for create and edit, because the wire operation IS the same
	// create-or-replace POST; only the prefill differs.
	const openProfileForm = (initial?: IJWTAuthProfileEntry) => {
		if (!inst) return;
		formRef.current = null;

		const input_form = (
			<JWTAuthProfileInputForm
				key={initial?.name ?? Date.now()}
				initial={initial}
				onDispose={() => {
					formRef.current = null;
				}}
				onChange={data => {
					const {isValid, ...clean} = data;
					formRef.current = clean;
					enableYes(isValid ?? false);
				}}
			/>
		);

		openPopUp(
			'',
			input_form,
			initial ? t('Save') : t('Add'),
			t('Cancel'),
			async () => {
				if (!formRef.current) return;
				const request = formRef.current;
				formRef.current = null;

				const res = await request_upsert_jwtauthprofile(inst, request);
				if (res.status === 'confirmed') {
					set_selected_rows([]);
					await report({refetch: fromQueryRefetch(refetch)}, t('Saved successfully.'));
					return;
				}
				showAddError('JWT auth profile', t(res.localeKey));
			},
			true,
		);
	};

	const handleDelete = async () => {
		if (!inst || !selectedProfile?.name) return;
		const name = selectedProfile.name;

		// Warn from the data already on screen rather than letting the operator
		// discover the refusal as a 409. The gateway is still the authority —
		// a rule created since this read would refuse anyway — so this is a
		// pre-check, not a substitute for handling the error below.
		const refs = referencesByName[name] ?? [];
		if (refs.length > 0) {
			// ⚠️ The advice is "remove or recreate the rule", NOT "detach it".
			// A rule carrying a credential policy is fullproxy, and a fullproxy
			// rule CANNOT be updated in place — the rule form refuses the edit
			// outright and tells the operator to build a replacement on a
			// different VIP/port/protocol and drop the original. Telling them to
			// detach would send them to a control the product does not offer.
			showDeleteError(
				'JWT auth profile',
				t('{{name}} is referenced by {{count}} LB rule(s): {{rules}}. A fullproxy rule cannot be edited in place, so remove or recreate each rule without this profile before deleting it.', {
					name, count: refs.length, rules: refs.join(', '),
				}),
			);
			return;
		}

		const res = await request_delete_jwtauthprofile(inst, name);
		if (res.status === 'confirmed') {
			set_selected_rows([]);
			await report({refetch: fromQueryRefetch(refetch)}, t('Deleted {{count}} item(s) successfully.', {count: 1}));
			return;
		}
		// A 409 that arrives anyway means a rule referenced it between the read
		// and the delete; say what it means rather than showing a bare code.
		if (res.httpStatus === 409) {
			showDeleteError('JWT auth profile', t('{{name}} is referenced by an LB rule and cannot be deleted. A rule was attached since this list was read — refresh to see which, then remove or recreate that rule without this profile.', {name}));
			await reconcile({refetch: fromQueryRefetch(refetch)});
			return;
		}
		showDeleteError('JWT auth profile', t(res.localeKey));
	};

	const handleRefresh = () => {
		set_selected_rows([]);
		// ⚠️ BOTH queries, not just the profile list. "Referenced by" is computed
		// from the LB rules, and the gateway's rule list is eventually consistent
		// — a rule created moments ago (or from another console) can be missing
		// from the read that painted this page. Refreshing only the profiles
		// leaves that column asserting "None" for a profile that IS referenced,
		// with no operator control able to correct it, and "None" is exactly the
		// signal they use to decide whether a delete will be refused.
		refetch();
		refetchLb();
	};

	return (
		<Fragment>
			<Alert severity="info" sx={{mb: 2}}>
				{t('This list is desired configuration only. It does not report whether an issuer is reachable or its keyset healthy.')}
			</Alert>

			<JWTAuthProfileTable
				data={profiles}
				referencesByName={referencesByName}
				selected_rows={selected_rows}
				onChangeSelectedRows={set_selected_rows}
				onAdd={() => openProfileForm()}
				onEdit={() => selectedProfile && openProfileForm(selectedProfile)}
				onDelete={handleDelete}
				onRefresh={handleRefresh}
				state={toPageState(profile_query, {op: 'ai_jwtprofile.list'})}
			/>

			{selectedProfile && (
				<LowerSection>
					<DetailPanel data={selectedProfile} referencedBy={referencesByName[selectedProfile.name ?? ''] ?? []} />
				</LowerSection>
			)}

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
