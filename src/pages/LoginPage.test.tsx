// The login screen renders localized, mapped
// messages; raw backend prose must never appear.
//
// The contract for this screen: a locked-out
// account must show a message distinct from a typo'd password, in the
// operator's language, and must not disclose the lockout policy details
// (the conservative default).
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import i18n from 'locales/i18n';
import LoginPage from './LoginPage';

// A real OAM token is a JWT carrying a numeric `exp` (verified against the
// live testbed: claims {exp, role, user_id, username}). The login path now
// refuses anything it cannot read an expiry from, so fixtures must be shaped
// like the real thing.
const VALID_TOKEN = `header.${btoa(JSON.stringify({exp: Math.floor(Date.now() / 1000) + 3600, role: 'admin'}))}.signature`;

vi.setConfig({testTimeout: 20_000});

// Particles renders through WebGL — not available under jsdom.
vi.mock('components/animation/Particles', () => ({default: () => null}));

const moveForced = vi.hoisted(() => vi.fn());
vi.mock('common', async importOriginal => ({
	...(await importOriginal<typeof import('common')>()),
	move_forced: moveForced,
}));

function mockFetchByUrl(loginResponder: () => Response) {
	(global.fetch as Mock).mockImplementation(async (url: string) => {
		if (String(url).includes('/health')) return new Response('{}', {status: 200, headers: {'Content-Type': 'application/json'}});
		return loginResponder();
	});
}

async function submitLogin() {
	const user = userEvent.setup();
	await user.type(screen.getByLabelText(new RegExp(i18n.t('Username'))), 'operator');
	await user.type(screen.getByLabelText(new RegExp(i18n.t('Password'))), 'Str0ng!pass1');
	await user.click(screen.getByRole('button', {name: i18n.t('Login')}));
}

beforeEach(async () => {
	vi.stubGlobal('fetch', vi.fn());
	localStorage.clear();
	moveForced.mockReset();
	await i18n.changeLanguage('en');
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('LoginPage message mapping', () => {
	it('lockout (429) shows a localized locked-out message — no raw prose, no retry-after policy detail', async () => {
		mockFetchByUrl(() => new Response(JSON.stringify({error: 'Too many failed login attempts. Please try again later. Retry after 47 seconds.', retry_after_seconds: 47}), {status: 429, headers: {'Content-Type': 'application/json'}}));
		render(<LoginPage />);
		await submitLogin();

		const alert = await screen.findByRole('alert');
		expect(alert.textContent).not.toMatch(/Retry after/i);
		expect(alert.textContent).not.toContain('Too many failed login attempts. Please try again later.');
		// The mapped, localized message — distinct from the plain-failure text.
		expect(alert.textContent).toBe(i18n.t('Too many failed sign-in attempts. Please try again later.'));
	});

	it('lockout message is localized in Korean', async () => {
		await i18n.changeLanguage('ko');
		mockFetchByUrl(() => new Response(JSON.stringify({error: 'Too many failed login attempts. Please try again later. Retry after 47 seconds.'}), {status: 429, headers: {'Content-Type': 'application/json'}}));
		render(<LoginPage />);
		await submitLogin();

		const alert = await screen.findByRole('alert');
		// Must be the ko resource, not the English key text and not server prose.
		expect(alert.textContent).toBe(i18n.t('Too many failed sign-in attempts. Please try again later.'));
		expect(alert.textContent).not.toMatch(/[Tt]oo many failed/);
	});

	it('bad credentials (401) show the localized invalid-credentials message, not server prose', async () => {
		mockFetchByUrl(() => new Response(JSON.stringify({error: 'invalid username or password (user record miss on shard 2)'}), {status: 401, headers: {'Content-Type': 'application/json'}}));
		render(<LoginPage />);
		await submitLogin();

		const alert = await screen.findByRole('alert');
		expect(alert.textContent).not.toContain('shard');
		expect(alert.textContent).toBe(i18n.t('Invalid username or password.'));
	});

	it('successful login stores the token and moves to /instance', async () => {
		mockFetchByUrl(() => new Response(JSON.stringify({id: 1, token: VALID_TOKEN}), {status: 200, headers: {'Content-Type': 'application/json'}}));
		render(<LoginPage />);
		await submitLogin();

		await waitFor(() => expect(moveForced).toHaveBeenCalledWith('/instance'));
		expect(localStorage.getItem('access_token')).toBe(VALID_TOKEN);
	});

	it('refuses a token whose lifetime it cannot read, rather than starting an unbounded session', async () => {
		// without a readable `exp` there is no basis for a proactive
		// logout, so the session would run until some request happened to
		// bounce 401 — the very state this task removes. The old code stored
		// whatever string arrived.
		mockFetchByUrl(() => new Response(JSON.stringify({id: 1, token: 'not-a-jwt'}), {status: 200, headers: {'Content-Type': 'application/json'}}));
		render(<LoginPage />);
		await submitLogin();

		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toBe(i18n.t('The server returned a token this client cannot read. Please try again or contact your administrator.'));
		expect(localStorage.getItem('access_token')).toBeNull();
		expect(moveForced).not.toHaveBeenCalledWith('/instance');
	});

	it('explains why the previous session ended, and only once', async () => {
		sessionStorage.setItem('session_end_reason', 'idle');
		const {unmount} = render(<LoginPage />);
		await screen.findByText(i18n.t('You were signed out after a period of inactivity. Please sign in again.')); // throws if absent
		unmount();

		// A later reload must not re-accuse the operator of having gone idle.
		render(<LoginPage />);
		await waitFor(() => expect(screen.queryByText(i18n.t('You were signed out after a period of inactivity. Please sign in again.'))).toBeNull());
	});
});
