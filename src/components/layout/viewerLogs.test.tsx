// The management backend serves an instance's process log and its archives to
// operators and administrators only; a viewer gets 403 on both. These pin that
// a viewer is not offered the page, is told why on a direct visit, and that
// neither the page nor the dashboard card sends a request that will be refused.
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {cleanup, render as rtlRender, screen} from '@testing-library/react';
import {ReactElement} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import 'locales/i18n';
import SystemLogCard from 'components/card/SystemLogCard';
import {IMenuItem, MENU_LIST} from 'types/menu';
import {LOG_READER_ROLES} from 'types/role';
import {RequireRoles} from './RouteGuards';

const role = vi.hoisted(() => ({current: null as string | null}));
const logReads = vi.hoisted(() => ({paging: vi.fn(), archives: vi.fn()}));

// The role comes from /users/me. `null` here is that read still in flight.
vi.mock('connector/oam/oam', async importOriginal => {
	const mod = await importOriginal<typeof import('connector/oam/oam')>();
	return {...mod, query_get_me: () => (role.current ? Promise.resolve({role: role.current}) : new Promise(() => {}))};
});

function render(ui: ReactElement) {
	const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
	return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
vi.mock('hooks/instanceHook', () => ({useInstanceFromURL: () => ({id: 1, name: 'gw'})}));
vi.mock('hooks/useInstanceLogPaging', () => ({
	useInstanceLogPaging: (...args: unknown[]) => {
		logReads.paging(...args);
		return {};
	},
}));
vi.mock('hooks/query/instanceHook', () => ({
	useInstanceLogArchives: (...args: unknown[]) => {
		logReads.archives(...args);
		return {data: undefined};
	},
}));
vi.mock('components/log/LogConsole', () => ({default: () => <div data-testid="log-console" />}));

beforeEach(() => {
	role.current = null;
	logReads.paging.mockClear();
	logReads.archives.mockClear();
});
afterEach(cleanup);

function flat(items: readonly IMenuItem[]): IMenuItem[] {
	return items.flatMap(item => [item, ...flat(item.items ?? [])]);
}

describe('who reads instance logs', () => {
	it('is operators and administrators, not viewers', () => {
		expect([...LOG_READER_ROLES].sort()).toEqual(['admin', 'operator']);
	});

	it('the Logs menu entry is offered to exactly those roles', () => {
		const logs = flat(MENU_LIST).filter(item => item.path === 'logs');
		expect(logs).toHaveLength(1);
		expect(logs[0].roles).toBe(LOG_READER_ROLES);
	});
});

describe('RequireRoles', () => {
	const page = (
		<RequireRoles roles={LOG_READER_ROLES}>
			<div data-testid="page" />
		</RequireRoles>
	);

	it('a viewer gets the reason in place of the page', async () => {
		role.current = 'viewer';
		render(page);
		expect((await screen.findByTestId('role-denied')).textContent).toMatch(/your role is not permitted to read/);
		expect(screen.queryByTestId('page')).toBeNull();
	});

	it.each([['operator'], ['admin'], ['user']])('%s gets the page', async r => {
		role.current = r;
		render(page);
		expect(await screen.findByTestId('page')).toBeTruthy();
		expect(screen.queryByTestId('role-denied')).toBeNull();
	});

	// Before /users/me answers nobody knows the role: mounting the page would
	// send the very requests this guard exists to hold back.
	it('renders neither while the role is not known yet', () => {
		const {container} = render(page);
		expect(container.innerHTML).toBe('');
	});
});

describe('the dashboard log card', () => {
	it('for a viewer says who can read logs and mounts no log read', async () => {
		role.current = 'viewer';
		render(<SystemLogCard />);
		expect((await screen.findByTestId('system-log-not-permitted')).textContent).toMatch(/operators and administrators/);
		expect(screen.queryByTestId('log-console')).toBeNull();
		expect(logReads.paging).not.toHaveBeenCalled();
		expect(logReads.archives).not.toHaveBeenCalled();
	});

	it('mounts no log read while the role is not known yet', () => {
		const {container} = render(<SystemLogCard />);
		expect(container.innerHTML).toBe('');
		expect(logReads.paging).not.toHaveBeenCalled();
		expect(logReads.archives).not.toHaveBeenCalled();
	});

	it.each([['operator'], ['admin']])('for %s shows the console', async r => {
		role.current = r;
		render(<SystemLogCard />);
		expect(await screen.findByTestId('log-console')).toBeTruthy();
		expect(logReads.paging).toHaveBeenCalled();
		expect(logReads.archives).toHaveBeenCalled();
	});
});
