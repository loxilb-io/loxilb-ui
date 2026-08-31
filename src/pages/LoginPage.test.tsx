// UI-P6-1 batch 1 (N-3) — the login screen renders localized, mapped
// messages; raw backend prose must never appear (ES-10/ES-18/ES-27).
//
// The GS evaluation exercises exactly this screen for ES-27: a locked-out
// account must show a message distinct from a typo'd password, in the
// operator's language, and must not disclose the lockout policy details
// (Q-4 conservative default).
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import i18n from 'locales/i18n';
import LoginPage from './LoginPage';

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

describe('LoginPage message mapping (N-3)', () => {
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

	it('lockout message is localized in Korean (ES-18)', async () => {
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
		mockFetchByUrl(() => new Response(JSON.stringify({id: 1, token: 'jwt-token-value'}), {status: 200, headers: {'Content-Type': 'application/json'}}));
		render(<LoginPage />);
		await submitLogin();

		await waitFor(() => expect(moveForced).toHaveBeenCalledWith('/instance'));
		expect(localStorage.getItem('access_token')).toBe('jwt-token-value');
	});
});
