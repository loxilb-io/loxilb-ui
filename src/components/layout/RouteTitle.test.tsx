//---------------------------------------------------------
// Per-route localized document.title.
//---------------------------------------------------------
import {cleanup, render, waitFor} from '@testing-library/react';
import RouteTitle, {titleKeyFor} from 'components/layout/RouteTitle';
import i18n from 'locales/i18n';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, describe, expect, it} from 'vitest';

afterEach(() => {
	cleanup();
	return i18n.changeLanguage('en');
});

function renderAt(path: string) {
	return render(
		<MemoryRouter initialEntries={[path]}>
			<RouteTitle />
		</MemoryRouter>,
	);
}

describe('titleKeyFor', () => {
	it('maps static, menu-derived and unknown routes', () => {
		expect(titleKeyFor('/login')).toBe('Login');
		expect(titleKeyFor('/instance/traffic/lb')).toBe('LB Rule');
		expect(titleKeyFor('/instance/status/logs')).toBe('Logs');
		expect(titleKeyFor('/instance/dashboard')).toBe('Dashboard');
		expect(titleKeyFor('/instance/settings')).toBe('Log Settings');
		expect(titleKeyFor('/definitely/unknown')).toBeUndefined();
	});
});

describe('document.title per route and language', () => {
	const CASES: Array<{path: string; en: string; ko: string; ja: string}> = [
		{path: '/login', en: 'Login — LoxiLB', ko: '로그인 — LoxiLB', ja: 'ログイン — LoxiLB'},
		{path: '/instance/traffic/lb', en: 'LB Rule — LoxiLB', ko: 'LB 규칙 — LoxiLB', ja: 'LBルール — LoxiLB'},
		{path: '/instance/status/logs', en: 'Logs — LoxiLB', ko: '로그 — LoxiLB', ja: 'ログ — LoxiLB'},
	];

	for (const {path, en, ko, ja} of CASES) {
		it(`localizes the title on ${path}`, async () => {
			renderAt(path);
			await waitFor(() => expect(document.title).toBe(en));
			await i18n.changeLanguage('ko');
			await waitFor(() => expect(document.title).toBe(ko));
			await i18n.changeLanguage('ja');
			await waitFor(() => expect(document.title).toBe(ja));
		});
	}

	it('falls back to the bare product name on unknown routes', async () => {
		renderAt('/definitely/unknown');
		await waitFor(() => expect(document.title).toBe('LoxiLB'));
	});
});
