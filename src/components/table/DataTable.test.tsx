//---------------------------------------------------------
// the shared table's page-state contract
// (npm test src/components/table/DataTable.test.tsx)
//
// RED against the current DataTable, which knows only `error?: boolean`.
// Every family table in the app renders through this component, so what it
// can and cannot express IS the app's answer to that question:
//
//   - a failed read still draws the grid, so the operator reads
//     "No Widget entries yet" under the banner — the exact "an error looks
//     like an empty resource" defect this task exists to close;
//   - denied / unavailable / failed all collapse into one boolean, so a
//     permission problem and an outage are the same sentence;
//   - a refresh that failed over cached rows cannot be expressed at all,
//     and the Add / Edit / Delete buttons stay live against data that may no
//     longer match the server (the parent's "stale data must not enable
//     destructive actions");
//   - the first load renders "No Widget entries yet" before the first
//     response arrives — a claim about the server made before it answered.
//
// The must-not-change pins at the bottom are expected to be GREEN today:
// the legacy `error` prop keeps working for the non-query callers.
//---------------------------------------------------------
import 'locales/i18n';
import i18n from 'locales/i18n';
import DataTable from './DataTable';
import {OpResult} from 'connector/fetcher/opResult';
import {PageDataState} from 'components/state/pageState';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {RecoilRoot} from 'recoil';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {IDataTableColumnDef} from 'types/global';

// The role probe is a network query of its own; this suite is about page
// states, so pin an admin (RBAC hiding of the buttons is oamHooks' contract,
// covered by role.test.ts).
vi.mock('hooks/query/oamHooks', async importOriginal => {
	const mod = await importOriginal<typeof import('hooks/query/oamHooks')>();
	return {
		...mod,
		useRole: () => ({
			role: 'admin',
			is_admin: true,
			is_operator: false,
			is_viewer: false,
			can_write_gateway: true,
			can_manage_users: true,
			can_manage_instances: true,
			can_manage_config: true,
		}),
	};
});

const FETCHED_AT = new Date('2026-09-01T12:00:00Z').getTime();
const COLS: IDataTableColumnDef[] = [{data_key: 'name', header: 'Name'}];
const ROWS = [
	{id: 'r1', name: 'alpha'},
	{id: 'r2', name: 'beta'},
];

function opResult(over: Partial<OpResult>): OpResult {
	return {status: 'failed', code: 'widget.list.failed', localeKey: 'The operation could not be completed.', retryable: false, ...over};
}

function renderTable(props: Record<string, unknown>) {
	const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
	return render(
		<QueryClientProvider client={client}>
			<RecoilRoot>
				<DataTable
					name="Widget"
					columns={COLS}
					rows={[]}
					selected_rows={[]}
					onChangeSelectedRows={() => {}}
					onAdd={() => {}}
					onEdit={() => {}}
					onDelete={() => {}}
					onRefresh={() => {}}
					{...(props as any)}
				/>
			</RecoilRoot>
		</QueryClientProvider>,
	);
}

/** The grid body — present only when there is something the grid may honestly show. */
function grid(): Element | null {
	return document.querySelector('.MuiDataGrid-root');
}

function button(name: RegExp): HTMLButtonElement {
	return screen.getByRole('button', {name}) as HTMLButtonElement;
}

beforeEach(async () => {
	// i18n is a module singleton — a case that switches language leaks into
	// every later case unless it is reset here (the hard way).
	await i18n.changeLanguage('en');
});
afterEach(cleanup);

//---------------------------------------------------------
// 1. A failed read must never be drawn as an empty resource
//---------------------------------------------------------
describe('a failed read is not an empty table', () => {
	const HARD: {kind: 'failed' | 'denied' | 'unavailable'; result: OpResult}[] = [
		{kind: 'failed', result: opResult({status: 'failed', retryable: true})},
		{kind: 'denied', result: opResult({status: 'denied', code: 'widget.list.denied', retryable: false})},
		{kind: 'unavailable', result: opResult({status: 'unavailable', code: 'widget.list.unavailable', retryable: true})},
	];

	for (const state of HARD) {
		it(`${state.kind}: the words "No Widget entries yet" appear nowhere on screen`, () => {
			renderTable({state});
			expect(screen.queryByText(/no widget entries yet/i)).toBeNull();
		});

		it(`${state.kind}: the empty grid body is not rendered at all`, () => {
			renderTable({state});
			expect(grid()).toBeNull();
		});
	}

	it('denied says it is a permission problem, not a server error', () => {
		renderTable({state: HARD[1]});
		expect(screen.getByText(/permission to view Widget/i)).toBeDefined();
	});

	it('unavailable says the resource is temporarily unavailable, not that it failed', () => {
		renderTable({state: HARD[2]});
		expect(screen.getByText(/Widget is temporarily unavailable/i)).toBeDefined();
	});

	it('failed interrupts a screen reader; denied and unavailable are polite', () => {
		const {unmount} = renderTable({state: HARD[0]});
		expect(screen.getByRole('alert')).toBeDefined();
		unmount();
		renderTable({state: HARD[1]});
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.getByRole('status')).toBeDefined();
	});

	it('retry is offered for a retryable failure and withheld from a permission denial', () => {
		const {unmount} = renderTable({state: HARD[2]});
		expect(screen.queryByRole('button', {name: /^retry$/i})).not.toBeNull();
		unmount();
		renderTable({state: HARD[1]});
		expect(screen.queryByRole('button', {name: /^retry$/i})).toBeNull();
	});
});

//---------------------------------------------------------
// 2. Stale rows may be read, never acted on (§2.3)
//---------------------------------------------------------
describe('stale rows disable every write', () => {
	const staleState: PageDataState<unknown> = {
		kind: 'stale',
		rows: ROWS,
		fetchedAt: FETCHED_AT,
		failure: opResult({status: 'unavailable', retryable: true}),
	};

	it('keeps the rows on screen — stale data is still worth reading', () => {
		renderTable({state: staleState, rows: ROWS});
		expect(grid()).not.toBeNull();
		expect(screen.getByText('alpha')).toBeDefined();
	});

	it('says the rows are out of date', () => {
		renderTable({state: staleState, rows: ROWS});
		// Exact, not a substring: the write-guard's own explanation ends in
		// "…out of date." too, and a loose matcher there matches both and
		// reports an ambiguity rather than the banner's absence.
		expect(screen.getByText('Out of date')).toBeDefined();
		expect(screen.getByRole('status').textContent).toMatch(/last read at/i);
	});

	it('disables Add, Edit and Delete', () => {
		renderTable({state: staleState, rows: ROWS, selected_rows: ['r1']});
		expect(button(/^add/i).disabled).toBe(true);
		expect(button(/^edit/i).disabled).toBe(true);
		expect(button(/^delete/i).disabled).toBe(true);
	});

	it('leaves Refresh enabled — recovering is the one action that still makes sense', () => {
		renderTable({state: staleState, rows: ROWS});
		expect(button(/^refresh/i).disabled).toBe(false);
	});

	it('explains why the write buttons are unavailable rather than just greying them out', () => {
		// The reason must be readable, not merely hoverable: a disabled button
		// with no explanation is indistinguishable from a permissions problem.
		// Its accessible NAME stays "Add Widget" — E2E locators and screen
		// reader users both depend on that being stable — so the reason
		// arrives as a description instead.
		renderTable({state: staleState, rows: ROWS});
		const described = button(/^add/i).getAttribute('aria-describedby');
		expect(described, 'the disabled Add button carries no description').toBeTruthy();
		expect(document.getElementById(described!)?.textContent).toMatch(/out of date/i);
	});

	it('a hard failure still disables the row-targeted actions', () => {
		renderTable({state: {kind: 'unavailable', result: opResult({status: 'unavailable', retryable: true})}, selected_rows: ['r1']});
		expect(button(/^edit/i).disabled).toBe(true);
		expect(button(/^delete/i).disabled).toBe(true);
	});
});

//---------------------------------------------------------
// 2b. Add is not an action ON the rows, and is guarded differently
//---------------------------------------------------------
// Edit and Delete operate on a SELECTED ROW, so rows we cannot vouch for make
// them unsafe. Add creates something new and reads nothing off the table, so
// the same reasoning does not reach it. Blocking it anyway took away the one
// action that still makes sense when a list will not load — proven by
// `cicd/ha/bgp-neighbor.spec.ts`, which creates a neighbour on an instance
// whose neighbour list answers 403 because BGP mode is off. That is a
// supported operator flow, and the first cut of this guard broke it.
describe('Add survives a read that failed, because it does not depend on the read', () => {
	const hardFailures = [
		{name: 'denied', state: {kind: 'denied' as const, result: opResult({status: 'denied' as const})}},
		{name: 'unavailable', state: {kind: 'unavailable' as const, result: opResult({status: 'unavailable' as const, retryable: true})}},
		{name: 'failed', state: {kind: 'failed' as const, result: opResult({status: 'failed' as const})}},
	];

	for (const {name, state} of hardFailures) {
		it(`${name}: Add stays available — there are no rows to be wrong about`, () => {
			renderTable({state});
			expect(button(/^add/i).disabled).toBe(false);
		});
	}

	it('loading: Add stays available — nothing has been claimed yet, let alone gone stale', () => {
		renderTable({state: {kind: 'loading'}});
		expect(button(/^add/i).disabled).toBe(false);
	});

	it('stale is the exception: rows exist but may be wrong, so a duplicate is a real hazard', () => {
		renderTable({
			state: {kind: 'stale', rows: ROWS, fetchedAt: FETCHED_AT, failure: opResult({status: 'unavailable', retryable: true})},
			rows: ROWS,
		});
		expect(button(/^add/i).disabled).toBe(true);
	});
});

//---------------------------------------------------------
// 3. Empty and loading are different claims about the server
//---------------------------------------------------------
describe('empty and loading are told apart', () => {
	it('empty: a successful response with no rows says so, with no error styling', () => {
		renderTable({state: {kind: 'empty', fetchedAt: FETCHED_AT}});
		// Two nodes carry this sentence on purpose: the grid's overlay shows it
		// where the rows would be, and a visually-hidden live region outside
		// the grid announces it. They cannot be one node — role="grid" forbids
		// a role="status" child (see the aria-required-children case below).
		expect(screen.getAllByText(/no widget entries yet/i).length).toBeGreaterThan(0);
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('empty: writes stay enabled — there is nothing wrong, there is just nothing yet', () => {
		renderTable({state: {kind: 'empty', fetchedAt: FETCHED_AT}});
		expect(button(/^add/i).disabled).toBe(false);
	});

	it('empty is announced, so a screen reader learns the table filled or emptied', () => {
		renderTable({state: {kind: 'empty', fetchedAt: FETCHED_AT}});
		expect(screen.getByRole('status')).toBeDefined();
	});

	it('the announcement is NOT a child of the grid — role="grid" forbids it', () => {
		// axe `aria-required-children` (critical, WCAG 1.3.1): a role="grid"
		// may contain only row/rowgroup. Announcing emptiness from inside the
		// DataGrid's own overlay put a role="status" in there and failed the
		// route-level axe pass on the LB page. Caught by the AFTER-run.
		renderTable({state: {kind: 'empty', fetchedAt: FETCHED_AT}});
		expect(document.querySelector('[role="grid"] [role="status"]')).toBeNull();
		expect(document.querySelector('[role="grid"] [aria-live]')).toBeNull();
	});

	it('loading: does NOT claim the resource is empty before the server has answered', () => {
		renderTable({state: {kind: 'loading'}});
		expect(screen.queryByText(/no widget entries yet/i)).toBeNull();
	});

	it('loading: shows no error banner', () => {
		renderTable({state: {kind: 'loading'}});
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('data: no banner at all, and every write is available', () => {
		renderTable({state: {kind: 'data', rows: ROWS, fetchedAt: FETCHED_AT}, rows: ROWS, selected_rows: ['r1']});
		expect(screen.queryByRole('alert')).toBeNull();
		expect(button(/^add/i).disabled).toBe(false);
		expect(button(/^edit/i).disabled).toBe(false);
		expect(button(/^delete/i).disabled).toBe(false);
	});
});

//---------------------------------------------------------
// 4. The copy is localized like everything else 
//---------------------------------------------------------
describe('page-state copy follows the operator language', () => {
	it('renders the failure in Korean once the language is Korean', async () => {
		await i18n.changeLanguage('ko');
		renderTable({state: {kind: 'unavailable', result: opResult({status: 'unavailable', retryable: true})}});
		// Two halves, and both are needed. Asserting only the absence of the
		// English sentence passes trivially while nothing renders at all —
		// which is precisely the state this suite starts in.
		const banner = screen.getByRole('status');
		expect(banner.textContent).toMatch(/Widget/);
		expect(banner.textContent).not.toMatch(/is temporarily unavailable/i);
	});
});

//---------------------------------------------------------
// 5. Must-not-change pins — expected GREEN today
//---------------------------------------------------------
describe('the legacy error prop keeps working for non-query callers', () => {
	it('error={true} still renders the "Couldn\'t load" banner', () => {
		renderTable({error: true});
		expect(screen.getByText(/couldn't load widget/i)).toBeDefined();
	});

	it('error={false} renders no banner', () => {
		renderTable({error: false});
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('with neither prop the table renders exactly as before', () => {
		renderTable({});
		expect(grid()).not.toBeNull();
		expect(screen.getByText(/no widget entries yet/i)).toBeDefined();
	});
});
