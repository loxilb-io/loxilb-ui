//---------------------------------------------------------
// Network identities — read-only list (gateway 9f5017e2).
//
// Pins: no mutation control at all; the match in words; defaults named as
// defaults (a binding's class defaults to standard); a route 404 named.
//---------------------------------------------------------
import 'locales/i18n';
import i18n from 'locales/i18n';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {RecoilRoot} from 'recoil';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {ApiError} from 'connector/fetcher/fetcher_base';
import NetIdentityPage, {describeMatch} from './NetIdentityPage';

vi.mock('hooks/instanceHook', () => ({useInstanceFromURL: () => ({id: 7, name: 'gw-1'})}));
const query = vi.hoisted(() => ({current: {} as any}));
vi.mock('hooks/query/queryHooks', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/queryHooks')>();
	return {...mod, useNetIdentities: () => query.current};
});
vi.mock('hooks/query/oamHooks', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/oamHooks')>();
	return {...mod, useRole: () => ({role: 'admin', is_admin: true, is_operator: false, is_viewer: false, can_write_gateway: true, can_manage_users: true, can_manage_instances: true, can_manage_config: true})};
});

function setQuery(over: Partial<{data: unknown; error: unknown}>) {
	query.current = {data: undefined, error: null, dataUpdatedAt: Date.now(), isFetching: false, isPending: false, refetch: vi.fn(), ...over};
}

function renderPage() {
	const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
	return render(
		<QueryClientProvider client={client}>
			<RecoilRoot>
				<NetIdentityPage />
			</RecoilRoot>
		</QueryClientProvider>,
	);
}

beforeEach(async () => {
	await i18n.changeLanguage('en');
});
afterEach(cleanup);

describe('NetIdentityPage', () => {
	it('lists bindings with no Add, Edit or Delete', () => {
		setQuery({data: [{name: 'lab', tenant: 'acme', match: {cidr: ['10.0.0.0/8']}}, {name: 'vpn', tenant: 'beta', match: {ipsec_tunnel: 't1'}, priority_class: 'critical'}]});
		renderPage();
		expect(screen.getByText('lab')).toBeTruthy();
		expect(screen.getByText('Source 10.0.0.0/8')).toBeTruthy();
		expect(screen.getByText('IPsec tunnel t1 (its interface)')).toBeTruthy();
		expect(screen.getByText('standard (default)')).toBeTruthy();
		expect(screen.queryByRole('button', {name: /^Add/})).toBeNull();
		expect(screen.queryByRole('button', {name: /^Delete/})).toBeNull();
		expect(screen.queryByRole('button', {name: /^Edit/})).toBeNull();
	});

	it('names the route when the gateway does not serve network identities', () => {
		setQuery({error: new ApiError('route not served (404)', 404)});
		renderPage();
		expect(screen.getByText(/This gateway does not serve \/config\/ai\/netidentity/)).toBeTruthy();
	});

	it('describes each kind of match', () => {
		expect(describeMatch({ingress_if: 'eth1'})).toBe('Interface eth1');
		expect(describeMatch({vlan: 100})).toBe('VLAN 100');
		expect(describeMatch({vni: 5000})).toBe('VNI 5000');
		expect(describeMatch({})).toBe('–');
	});
});
