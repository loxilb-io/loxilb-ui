//---------------------------------------------------------
// Objectives page — read states and controls (gateway 9f5017e2).
//
// Pins: rows sorted by priority with their class; a route 404 names the
// route and offers no Add; a last-known-good list and an unreachable store
// each say so; a viewer gets no mutation control.
//---------------------------------------------------------
import 'locales/i18n';
import i18n from 'locales/i18n';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {RecoilRoot} from 'recoil';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {ApiError} from 'connector/fetcher/fetcher_base';
import {IObjectiveList} from 'connector/instance/ai_objective';
import {sortObjectivesForDisplay} from 'components/table/ai/ObjectiveTable';
import AIObjectivesPage from './AIObjectivesPage';

const instance = {id: 7, name: 'gw-1'} as any;
vi.mock('hooks/instanceHook', () => ({useInstanceFromURL: () => instance}));

const objectivesQuery = vi.hoisted(() => ({current: {} as any}));
const role = vi.hoisted(() => ({viewer: false}));
vi.mock('hooks/query/queryHooks', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/queryHooks')>();
	return {
		...mod,
		useAIObjectives: () => objectivesQuery.current,
		useApiKeys: () => ({data: [{key_id: 'k1', name: 'ops', default_objective: 'gold'}], refetch: vi.fn()}),
	};
});
vi.mock('hooks/query/oamHooks', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/oamHooks')>();
	return {
		...mod,
		useRole: () => ({role: role.viewer ? 'viewer' : 'admin', is_admin: !role.viewer, is_operator: false, is_viewer: role.viewer, can_write_gateway: !role.viewer, can_manage_users: false, can_manage_instances: false, can_manage_config: !role.viewer}),
	};
});

function setQuery(over: Partial<{data: IObjectiveList; error: unknown}>) {
	objectivesQuery.current = {data: undefined, error: null, dataUpdatedAt: Date.now(), isFetching: false, isPending: false, refetch: vi.fn(async () => ({data: over.data})), ...over};
}

function renderPage() {
	const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
	return render(
		<QueryClientProvider client={client}>
			<RecoilRoot>
				<AIObjectivesPage />
			</RecoilRoot>
		</QueryClientProvider>,
	);
}

const LIST: IObjectiveList = {
	objectives: [
		{name: 'batch', priority: -5},
		{name: 'gold', priority: 10, services: ['10.0.0.1:443']},
		{name: 'normal', priority: 0},
	],
	source: 'store',
	sourceTimestamp: '2026-10-27T03:00:00Z',
	storeReachable: true,
	storeLastRead: '2026-10-27T03:00:00Z',
};

beforeEach(async () => {
	role.viewer = false;
	await i18n.changeLanguage('en');
});
afterEach(cleanup);

describe('objectives list', () => {
	it('sorts by priority, highest first', () => {
		expect(sortObjectivesForDisplay(LIST.objectives).map(o => o.name)).toEqual(['gold', 'normal', 'batch']);
	});

	it('shows each row with its class and offers Add', () => {
		setQuery({data: LIST});
		renderPage();
		expect(screen.getByText('gold')).toBeTruthy();
		expect(screen.getByText('critical')).toBeTruthy();
		expect(screen.getByText('sheddable')).toBeTruthy();
		expect(screen.getByRole('button', {name: 'Add Objectives'})).toBeTruthy();
		expect(screen.queryAllByRole('alert').filter(a => a.textContent?.includes('key store'))).toHaveLength(0);
	});

	it('names the route and offers no Add when the gateway does not serve objectives', () => {
		setQuery({error: new ApiError('Get Objectives: route not served (404)', 404)});
		renderPage();
		expect(screen.getByText(/This gateway does not serve \/config\/ai\/objective/)).toBeTruthy();
		expect(screen.queryByRole('button', {name: 'Add Objectives'})).toBeNull();
		expect(screen.queryByText(/No Objectives entries yet/)).toBeNull();
	});

	it('says when the list is the last-known-good file', () => {
		setQuery({data: {...LIST, source: 'lkg', storeReachable: false}});
		renderPage();
		expect(screen.getByText(/This is the last-known-good file it applies/)).toBeTruthy();
	});

	it('says when the store did not answer, apart from where the list came from', () => {
		setQuery({data: {...LIST, storeReachable: false}});
		renderPage();
		expect(screen.getByText(/The key store did not answer this read/)).toBeTruthy();
	});

	it('gives a viewer no mutation control', () => {
		role.viewer = true;
		setQuery({data: LIST});
		renderPage();
		expect(screen.queryByRole('button', {name: 'Add Objectives'})).toBeNull();
	});
});
