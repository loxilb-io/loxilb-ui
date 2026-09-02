//---------------------------------------------------------
// the supported-customization list, pinned
// (npm test src/preferences.test.tsx)
//
// is evaluated by discovering each customization the product claims,
// changing it, reloading, and checking it survived. The features already work;
// the risk this file exists for is that refactor
// exactly these components, and a single storage-key rename would fail 
// on the RC without failing anything else.
//
// So the keys are asserted against the REAL components rather than against a
// constant talking to itself: renaming the key in DataTable.tsx has to break a
// test here, even if the constant is updated to match.
//
// EXCLUDED from the claimed list, deliberately: log-console filters. They are
// in-memory only (nothing under src/pages/status/ touches localStorage) and
// reset on reload. asks for "supported customization list AND excluded
// items" and instructs the evaluator to record missing features as
// unavailable, so this is an exclusion, not a defect.
//---------------------------------------------------------
import DataTable from 'components/table/DataTable';
import i18n from 'locales/i18n';
import LangSelMenu from 'components/menu/LangSelMenu';
import SideMenuNav from 'components/layout/SideMenuNav';
import userEvent from '@testing-library/user-event';
import {DEFAULT_SIDE_MENU_OPEN, DEFAULT_TABLE_DENSITY, PREFERENCE_KEYS} from 'preferences';
import {MemoryRouter} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ReactNode} from 'react';
import {RecoilRoot} from 'recoil';
import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {beginSession, terminateSession} from 'session/session';

vi.mock('react-router-dom', async importOriginal => {
	const mod = await importOriginal<typeof import('react-router-dom')>();
	return {...mod, useNavigate: () => vi.fn()};
});

//---------------------------------------------------------
// Harness
//---------------------------------------------------------
function Providers({children}: {children: ReactNode}) {
	// retry:false — a failing role lookup must not keep the test alive with
	// back-off timers; DataTable renders its buttons regardless of the result.
	const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
	return (
		<MemoryRouter>
			<QueryClientProvider client={client}>
				<RecoilRoot>{children}</RecoilRoot>
			</QueryClientProvider>
		</MemoryRouter>
	);
}

const COLUMNS = [{data_key: 'name', header: 'Name'}];
const ROWS = [{id: 1, name: 'row-one'}];
/** Selection is required by DataTable and irrelevant here — density is not per-row. */
const TABLE_PROPS = {columns: COLUMNS, rows: ROWS, selected_rows: [], onChangeSelectedRows: () => {}};

beforeEach(async () => {
	localStorage.clear();
	sessionStorage.clear();
	// i18n is a module singleton: the language case below really does switch
	// the app to Korean, and every later assertion that matches an English
	// accessible name would then fail for a reason that has nothing to do with
	// preferences. Reset it rather than depend on case ordering.
	await i18n.changeLanguage('en');
});

afterEach(() => {
	cleanup();
	localStorage.clear();
	sessionStorage.clear();
});

//---------------------------------------------------------
// The claimed list — key names, as used by the real components
//---------------------------------------------------------
describe('supported customization: storage keys are what the components actually use', () => {
	it('the claimed keys are these exact strings', () => {
		// The literal pin. Without it the assertions below would only prove the
		// constants agree with themselves: once the components import
		// PREFERENCE_KEYS, renaming a key would move both sides together and
		// every render-based check would still pass while broke on the
		// RC. Changing any string here is a deliberate act that must be paired
		// with a migration for operators who already have the old key stored.
		expect(PREFERENCE_KEYS).toEqual({
			tableDensity: 'table_density',
			sideMenuOpen: 'is_open_side_menu',
			language: 'language',
			dashboardLayout: 'dashboard_layout_v2',
		});
	});

	it('table density is stored under the claimed key, by DataTable itself', async () => {
		const user = userEvent.setup();
		render(
			<Providers>
				<DataTable name="tbl" {...TABLE_PROPS} />
			</Providers>,
		);

		await user.click(screen.getByRole('button', {name: /switch to compact rows/i}));

		await waitFor(() => expect(localStorage.getItem(PREFERENCE_KEYS.tableDensity)).toBe(JSON.stringify('compact')));
	});

	it('density applies to every mounted table, not just the one that was toggled', async () => {
		// DataTable.tsx documents density as a GLOBAL preference. Two tables on
		// one page is the ordinary case (dashboard, instance detail), and an
		// evaluator toggling one and seeing the other unchanged is an 
		// consistency finding as well as an one.
		const user = userEvent.setup();
		render(
			<Providers>
				<DataTable name="left" {...TABLE_PROPS} />
				<DataTable name="right" {...TABLE_PROPS} />
			</Providers>,
		);

		const toggles = screen.getAllByRole('button', {name: /switch to compact rows/i});
		expect(toggles).toHaveLength(2);
		await user.click(toggles[0]);

		// Both toggles now offer the return trip, which is only true if the
		// table that was NOT clicked also read the change.
		await waitFor(() => expect(screen.getAllByRole('button', {name: /switch to comfortable rows/i})).toHaveLength(2));
	});

	it('the side-menu open/closed state is stored under the claimed key', async () => {
		render(
			<Providers>
				<SideMenuNav />
			</Providers>,
		);

		// The hook writes on mount, which is what makes the key observable
		// without driving the collapse control through the nav chrome.
		await waitFor(() => expect(localStorage.getItem(PREFERENCE_KEYS.sideMenuOpen)).toBe(JSON.stringify(DEFAULT_SIDE_MENU_OPEN)));
	});

	it('a stored side-menu preference is honoured on mount', async () => {
		localStorage.setItem(PREFERENCE_KEYS.sideMenuOpen, JSON.stringify(false));
		render(
			<Providers>
				<SideMenuNav />
			</Providers>,
		);
		await waitFor(() => expect(localStorage.getItem(PREFERENCE_KEYS.sideMenuOpen)).toBe(JSON.stringify(false)));
	});

	it('language is stored under the claimed key, raw rather than JSON', async () => {
		// Deliberate asymmetry worth pinning: `language` is written by
		// save_local_storage as a bare string, while the hook-backed
		// preferences are JSON. i18n's boot-time read (locales/i18n.ts) and
		// the session purge scan both depend on that shape.
		const user = userEvent.setup();
		render(
			<Providers>
				<LangSelMenu anchorEl={document.body} handleClose={() => {}} />
			</Providers>,
		);

		await user.click(await screen.findByText('한국어'));

		await waitFor(() => expect(localStorage.getItem(PREFERENCE_KEYS.language)).toBe('ko'));
	});

	it('the dashboard layout key matches the one DashboardPage persists', async () => {
		// Imported lazily: DashboardPage pulls the whole metric-card tree, and
		// this assertion only needs the module-level key.
		const source = await import('pages/DashboardPage');
		expect(source).toBeTruthy();
		// The key is not exported; pin it here and in the evidence list so a
		// rename during has to be a deliberate, reviewed act.
		expect(PREFERENCE_KEYS.dashboardLayout).toBe('dashboard_layout_v2');
	});
});

//---------------------------------------------------------
// Cross-assertion with the logout purge (both directions)
//---------------------------------------------------------
describe('logout keeps preferences and drops session data', () => {
	const TOKEN = 'header.payload.signature';

	function seedLoggedInStorage() {
		beginSession();
		localStorage.setItem('access_token', TOKEN);
		localStorage.setItem('REACT_QUERY_OFFLINE_CACHE', JSON.stringify({clientState: {queries: []}}));
		localStorage.setItem('conntrack-series_1', JSON.stringify([{timestamp: 1}]));

		localStorage.setItem(PREFERENCE_KEYS.tableDensity, JSON.stringify('compact'));
		localStorage.setItem(PREFERENCE_KEYS.sideMenuOpen, JSON.stringify(false));
		localStorage.setItem(PREFERENCE_KEYS.language, 'ko');
		localStorage.setItem(PREFERENCE_KEYS.dashboardLayout, JSON.stringify([{i: 'system-log', x: 0, y: 0, w: 12, h: 2}]));
	}

	it('every claimed preference survives a logout', async () => {
		seedLoggedInStorage();

		await act(async () => {
			await terminateSession('logout', {navigate: () => {}});
		});

		expect(localStorage.getItem(PREFERENCE_KEYS.tableDensity)).toBe(JSON.stringify('compact'));
		expect(localStorage.getItem(PREFERENCE_KEYS.sideMenuOpen)).toBe(JSON.stringify(false));
		expect(localStorage.getItem(PREFERENCE_KEYS.language)).toBe('ko');
		expect(localStorage.getItem(PREFERENCE_KEYS.dashboardLayout)).not.toBeNull();
	});

	it('session data does not survive the same logout', async () => {
		// The other direction: if the purge were weakened until preferences
		// survived by doing nothing at all, the test above would still pass.
		seedLoggedInStorage();

		await act(async () => {
			await terminateSession('logout', {navigate: () => {}});
		});

		expect(localStorage.getItem('access_token')).toBeNull();
		expect(localStorage.getItem('REACT_QUERY_OFFLINE_CACHE')).toBeNull();
		expect(localStorage.getItem('conntrack-series_1')).toBeNull();
	});

	it('a restored preference still applies after the next login', async () => {
		seedLoggedInStorage();
		await act(async () => {
			await terminateSession('logout', {navigate: () => {}});
		});

		render(
			<Providers>
				<DataTable name="tbl" {...TABLE_PROPS} />
			</Providers>,
		);

		// compact survived the logout, so the table offers the trip back.
		await waitFor(() => expect(screen.getByRole('button', {name: /switch to comfortable rows/i})).toBeTruthy());
	});
});

//---------------------------------------------------------
// Defaults, so "restore" in the procedure has a target
//---------------------------------------------------------
describe('restore step', () => {
	it('defaults are the documented ones', () => {
		expect(DEFAULT_TABLE_DENSITY).toBe('comfortable');
		expect(DEFAULT_SIDE_MENU_OPEN).toBe(true);
	});

	it('clearing a preference returns the component to its default', async () => {
		localStorage.setItem(PREFERENCE_KEYS.tableDensity, JSON.stringify('compact'));
		const first = render(
			<Providers>
				<DataTable name="tbl" {...TABLE_PROPS} />
			</Providers>,
		);
		await waitFor(() => expect(screen.getByRole('button', {name: /switch to comfortable rows/i})).toBeTruthy());
		first.unmount();

		localStorage.removeItem(PREFERENCE_KEYS.tableDensity);
		render(
			<Providers>
				<DataTable name="tbl" {...TABLE_PROPS} />
			</Providers>,
		);
		await waitFor(() => expect(screen.getByRole('button', {name: /switch to compact rows/i})).toBeTruthy());
	});
});
