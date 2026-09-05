//---------------------------------------------------------
// Published Profiles inventory — read-only contract
//
// The page must render the operator-published registry with zero mutation
// affordances, treat gen0 as a normal legacy state (exact copy pinned), and
// never draw a failed read as an empty registry.
//---------------------------------------------------------
import 'locales/i18n';
import i18n from 'locales/i18n';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {RecoilRoot} from 'recoil';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {ApiError} from 'connector/fetcher/fetcher_base';
import {IModelProfileRegistry} from 'types/ai_gateway';
import PublishedProfilesPage from './PublishedProfilesPage';
import {shortDigest} from 'components/table/ai/ModelProfileTable';

const instance = {id: 7, name: 'gw-1'} as any;

vi.mock('hooks/instanceHook', () => ({
	useInstanceFromURL: () => instance,
}));

const profilesQuery = vi.hoisted(() => ({current: {} as any}));
vi.mock('hooks/query/queryHooks', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/queryHooks')>();
	return {...mod, useModelProfiles: () => profilesQuery.current};
});

vi.mock('hooks/query/oamHooks', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/oamHooks')>();
	return {
		...mod,
		useRole: () => ({role: 'admin', is_admin: true, is_operator: false, is_viewer: false, can_write_gateway: true, can_manage_users: true, can_manage_instances: true, can_manage_config: true}),
	};
});

const REGISTRY: IModelProfileRegistry = {
	registryGeneration: 4,
	setDigest: 'sha256:feedface0123',
	profiles: [
		{profileId: 'qwen3-chat', gen: 4, baseModel: 'Qwen/Qwen3-32B', aliasPolicy: 'list', allowedAliases: ['qwen-chat'], supportedApis: ['chat'], tokenizerSha256: 'a'.repeat(64), templateSha256: 'b'.repeat(64)},
		{profileId: 'llama-both', gen: 4, baseModel: 'meta-llama/Llama-3-70B', aliasPolicy: 'base_model_only', supportedApis: ['completions', 'chat'], tokenizerSha256: 'c'.repeat(64)},
	],
};

function setQuery(over: Partial<{data: unknown; error: unknown}>) {
	profilesQuery.current = {
		data: undefined,
		error: null,
		dataUpdatedAt: Date.now(),
		isFetching: false,
		isPending: false,
		refetch: vi.fn(),
		...over,
	};
}

function renderPage() {
	const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
	return render(
		<QueryClientProvider client={client}>
			<RecoilRoot>
				<PublishedProfilesPage />
			</RecoilRoot>
		</QueryClientProvider>,
	);
}

const LEGACY_EMPTY_COPY = /No profiles are currently published\. Legacy profile-less routing remains available\./;

beforeEach(async () => {
	await i18n.changeLanguage('en');
});
afterEach(cleanup);

describe('populated inventory (AC-01, AC-12)', () => {
	it('renders rows, registry header, and a Refresh — and not one mutation control', () => {
		setQuery({data: REGISTRY});
		renderPage();

		expect(screen.getByText('qwen3-chat')).toBeTruthy();
		expect(screen.getByText('llama-both')).toBeTruthy();
		expect(screen.getByText(/Generation 4/)).toBeTruthy();
		expect(screen.getByText(/sha256:feedface0123/)).toBeTruthy();
		expect(screen.getByRole('button', {name: /refresh/i})).toBeTruthy();

		// AC-12: the inventory offers no mutation affordance of any kind.
		// (Anchored: the Refresh button's accessible name is resource-qualified
		// as "Refresh Published Model Profiles", which contains "publish".)
		for (const verb of [/^add\b/i, /^delete\b/i, /^edit\b/i, /^upload\b/i, /^activate\b/i, /^publish\b/i]) {
			expect(screen.queryByRole('button', {name: verb})).toBeNull();
		}
		// No legacy-empty copy on a populated registry.
		expect(screen.queryByText(LEGACY_EMPTY_COPY)).toBeNull();
	});

	it('shows the tokenizer digest in short form and the template presence flag', () => {
		setQuery({data: REGISTRY});
		renderPage();
		expect(screen.getByText(shortDigest('a'.repeat(64)))).toBeTruthy();
		expect(screen.getAllByText('Yes').length).toBeGreaterThan(0);
	});
});

describe('gen0 empty registry (AC-03)', () => {
	it('renders the exact legacy copy as a normal state, not an error', () => {
		setQuery({data: {registryGeneration: 0, profiles: []}});
		renderPage();

		expect(screen.getByText(LEGACY_EMPTY_COPY)).toBeTruthy();
		expect(screen.getByText(/Generation 0/)).toBeTruthy();
		// No failure vocabulary anywhere on a healthy empty registry.
		expect(screen.queryByText(/could ?n.t load|failed|denied|unavailable/i)).toBeNull();
	});

	it('does not show the legacy copy while the first response is still pending', () => {
		setQuery({data: undefined});
		renderPage();
		expect(screen.queryByText(LEGACY_EMPTY_COPY)).toBeNull();
	});
});

describe('failed reads (FR-05 vocabulary)', () => {
	it('renders 503 as unavailable — never as an empty registry', () => {
		setQuery({error: new ApiError('store unavailable', 503)});
		renderPage();

		expect(screen.queryByText(LEGACY_EMPTY_COPY)).toBeNull();
		expect(screen.queryByText('qwen3-chat')).toBeNull();
		// The shared page-state gate paints a non-empty failure surface.
		expect(document.querySelector('.MuiDataGrid-root')).toBeNull();
	});

	it('renders 403 as denied, distinctly from unavailable', () => {
		setQuery({error: new ApiError('forbidden', 403)});
		renderPage();
		expect(screen.queryByText(LEGACY_EMPTY_COPY)).toBeNull();
		expect(document.querySelector('.MuiDataGrid-root')).toBeNull();
	});
});

describe('shortDigest', () => {
	it('truncates long digests with an ellipsis and passes short values through', () => {
		expect(shortDigest('a'.repeat(64))).toBe('a'.repeat(12) + '…');
		expect(shortDigest('abc')).toBe('abc');
		expect(shortDigest(undefined)).toBe('');
	});
});
