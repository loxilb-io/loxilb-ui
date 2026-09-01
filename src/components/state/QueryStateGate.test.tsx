//---------------------------------------------------------
// UI-P6-5 — how each page state actually renders
// (npm test src/components/state/QueryStateGate.test.tsx)
//
// RED against the stub. The assertions are written against what an operator
// (or a screen reader) can perceive, not against markup: today all four
// failure situations reach the same "Couldn't load …" banner, an empty
// resource and a failed read are both "No rows", and nothing announces a
// state change at all.
//---------------------------------------------------------
import i18n from 'locales/i18n';
import QueryStateGate from './QueryStateGate';
import {OpResult} from 'connector/fetcher/opResult';
import {PageDataState} from './pageState';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const FETCHED_AT = new Date('2026-09-01T12:00:00Z').getTime();

function opResult(over: Partial<OpResult>): OpResult {
	return {status: 'failed', code: 'test.list.failed', localeKey: 'The operation could not be completed.', retryable: false, ...over};
}

function renderGate(state: PageDataState<string[]>, onRetry?: () => void) {
	return render(
		<QueryStateGate state={state} name="Load Balancer Rule" onRetry={onRetry}>
			{(rows, ctx) => (
				<div>
					<span data-testid="rows">{(rows ?? []).join(',')}</span>
					<button type="button" disabled={!ctx.writesEnabled}>
						Add
					</button>
				</div>
			)}
		</QueryStateGate>,
	);
}

beforeEach(async () => {
	// i18n is a module singleton — a case that switches language leaks into
	// every later case unless it is reset here (UI-P6-6, the hard way).
	await i18n.changeLanguage('en');
});

afterEach(cleanup);

describe('the four states an operator must be able to tell apart', () => {
	it('empty says the resource is empty and shows no error styling', () => {
		renderGate({kind: 'empty', fetchedAt: FETCHED_AT});
		expect(screen.getByText(/no load balancer rule entries yet/i)).toBeDefined();
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('denied says it is a permission problem, not a missing resource', () => {
		renderGate({kind: 'denied', result: opResult({status: 'denied', localeKey: 'Permission denied'})});
		const text = document.body.textContent ?? '';
		expect(text).toMatch(/permission/i);
		expect(text).not.toMatch(/no load balancer rule entries yet/i);
	});

	it('unavailable says the service is not answering, and offers a retry', async () => {
		const onRetry = vi.fn();
		renderGate({kind: 'unavailable', result: opResult({status: 'unavailable', localeKey: 'The service is temporarily unavailable. Please try again later.', retryable: true})}, onRetry);
		expect(document.body.textContent).toMatch(/temporarily unavailable/i);
		await userEvent.click(screen.getByRole('button', {name: /retry/i}));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it('failed is announced assertively; the benign states are not', () => {
		const {unmount} = renderGate({kind: 'failed', result: opResult({})});
		expect(screen.getByRole('alert')).toBeDefined();
		unmount();

		renderGate({kind: 'empty', fetchedAt: FETCHED_AT});
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.getByRole('status')).toBeDefined();
	});

	it('never renders raw server prose', () => {
		renderGate({kind: 'failed', result: opResult({rawDetail: 'pq: duplicate key value violates unique constraint "lb_pkey"'})});
		expect(document.body.textContent).not.toMatch(/lb_pkey/);
	});
});

describe('stale — rows stay, and they are labelled as old', () => {
	const staleState: PageDataState<string[]> = {
		kind: 'stale',
		rows: ['rule-a', 'rule-b'],
		fetchedAt: FETCHED_AT,
		failure: opResult({status: 'unavailable', localeKey: 'The service is temporarily unavailable. Please try again later.', retryable: true}),
	};

	it('keeps the last known-good rows on screen', () => {
		renderGate(staleState);
		expect(screen.getByTestId('rows').textContent).toBe('rule-a,rule-b');
	});

	it('tells the operator the rows are out of date and when they were read', () => {
		renderGate(staleState);
		const text = document.body.textContent ?? '';
		expect(text).toMatch(/out of date|older|last updated|stale/i);
		// The timestamp must be a real rendered time, not the epoch number.
		expect(text).not.toContain(String(FETCHED_AT));
	});

	it('disables writes while the data cannot be trusted (ES-14)', () => {
		renderGate(staleState);
		expect(screen.getByRole('button', {name: 'Add'}).hasAttribute('disabled')).toBe(true);
	});

	it('re-enables writes once a refresh succeeds', () => {
		renderGate({kind: 'data', rows: ['rule-a'], fetchedAt: FETCHED_AT});
		expect(screen.getByRole('button', {name: 'Add'}).hasAttribute('disabled')).toBe(false);
	});
});

describe('loading', () => {
	it('shows a busy indicator with an accessible name, never an empty table', () => {
		renderGate({kind: 'loading'});
		expect(document.body.textContent).not.toMatch(/no load balancer rule entries yet/i);
		// A nameless progressbar is exactly the axe violation UI-P2-2 had to
		// fix on the setup spinner — do not reintroduce it here.
		const busy = screen.getByRole('progressbar');
		expect(busy.getAttribute('aria-label') || busy.getAttribute('aria-labelledby')).toBeTruthy();
	});
});

describe('localization', () => {
	it('renders the failure copy in the active language', async () => {
		renderGate({kind: 'unavailable', result: opResult({status: 'unavailable', localeKey: 'The service is temporarily unavailable. Please try again later.', retryable: true})});
		const english = document.body.textContent ?? '';
		cleanup();

		await i18n.changeLanguage('ko');
		renderGate({kind: 'unavailable', result: opResult({status: 'unavailable', localeKey: 'The service is temporarily unavailable. Please try again later.', retryable: true})});
		const korean = document.body.textContent ?? '';

		expect(korean).not.toBe(english);
		expect(korean).toMatch(/[가-힣]/);
	});
});
