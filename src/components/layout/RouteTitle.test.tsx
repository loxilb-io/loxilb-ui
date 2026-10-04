//---------------------------------------------------------
// Per-route localized document.title.
//---------------------------------------------------------
import {cleanup, render, waitFor} from '@testing-library/react';
import RouteTitle, {PageHeading, titleKeyFor} from 'components/layout/RouteTitle';
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

//---------------------------------------------------------
// The page's one <h1> (Stage 5.2)
//---------------------------------------------------------
// `page-has-heading-one` was the last rule frozen in the route-level axe
// baseline, and it is checked here too because the axe pass only visits a
// dozen representative routes: this hook is what every OTHER route relies on,
// including pages not yet written.
describe('PageHeading', () => {
	function headingAt(path: string) {
		const {container} = render(
			<MemoryRouter initialEntries={[path]}>
				<PageHeading />
			</MemoryRouter>,
		);
		return container.querySelectorAll('h1');
	}

	it('renders exactly one h1 named for the route', () => {
		const h1s = headingAt('/instance/traffic/lb');
		expect(h1s).toHaveLength(1);
		// The same mapping document.title uses, so the tab and the heading a
		// screen reader announces cannot disagree.
		expect(h1s[0].textContent).toBe('LB Rule');
	});

	it('still emits an h1 on a route with no mapped name', () => {
		// ⚠️ A missing mapping is the app's problem, not the visitor's — an
		// unnamed route must not become a page with no heading at all.
		const h1s = headingAt('/definitely/unknown');
		expect(h1s).toHaveLength(1);
		expect(h1s[0].textContent).toBe('LoxiLB');
	});

	it('is localized like the document title', async () => {
		await i18n.changeLanguage('ko');
		const h1s = headingAt('/instance/status/logs');
		expect(h1s[0].textContent).not.toBe('Logs');
		expect(h1s[0].textContent?.length).toBeGreaterThan(0);
	});
});
