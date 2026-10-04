//---------------------------------------------------------
// Language selection — persistence, <html lang> sync, and
// keyboard operability of the trigger.
//
// The persistence and html-lang cases guard behavior that
// already works (do-not-regress); the keyboard cases assert
// WCAG-level operability of the language trigger.
//---------------------------------------------------------
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LanguageIcon from 'components/layout/LanguageIcon';
import i18n, {support_lang} from 'locales/i18n';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

// LangSelMenu calls navigate(0) after a language change to force every
// cached string to re-render; a jsdom reload is meaningless, so stub it.
const navigateMock = vi.fn();
vi.mock('react-router-dom', async importOriginal => {
	const mod = await importOriginal<typeof import('react-router-dom')>();
	return {...mod, useNavigate: () => navigateMock};
});

function renderTrigger() {
	return render(
		<MemoryRouter>
			<LanguageIcon />
		</MemoryRouter>,
	);
}

beforeEach(() => {
	localStorage.clear();
	navigateMock.mockClear();
});

// RTL cannot self-register cleanup without vitest globals — without this,
// each render stacks on the last test's DOM and role queries multi-match.
afterEach(cleanup);

describe('language persistence (do not regress)', () => {
	it('restores a saved language from localStorage on mount', async () => {
		localStorage.setItem('language', 'ko');
		renderTrigger();
		await waitFor(() => expect(i18n.language).toBe('ko'));
		expect(document.documentElement.lang).toBe('ko');
	});

	it('falls back to en for an unknown saved language value', async () => {
		localStorage.setItem('language', 'xx-not-a-lang');
		renderTrigger();
		await waitFor(() => expect(i18n.language).toBe('en'));
		expect(document.documentElement.lang).toBe('en');
	});

	it('persists the chosen language and syncs <html lang> on change', async () => {
		const user = userEvent.setup();
		renderTrigger();
		await user.click(screen.getByRole('button', {name: /select a language/i}));
		await user.click(await screen.findByText('한국어'));
		await waitFor(() => expect(i18n.language).toBe('ko'));
		expect(localStorage.getItem('language')).toBe('ko');
		expect(document.documentElement.lang).toBe('ko');
	});
});

describe('keyboard operability', () => {
	it('trigger is a focusable button with menu semantics', async () => {
		renderTrigger();
		const trigger = screen.getByRole('button', {name: /select a language/i});
		expect(trigger).toHaveProperty('tagName', 'BUTTON');
		expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
	});

	it('Tab reaches the trigger; Enter opens the menu; arrows + Enter select', async () => {
		const user = userEvent.setup();
		renderTrigger();

		await user.tab();
		const trigger = screen.getByRole('button', {name: /select a language/i});
		expect(document.activeElement).toBe(trigger);

		await user.keyboard('{Enter}');
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		const menu = await screen.findByRole('menu');
		expect(menu).toBeTruthy();

		// Keyboard-open focuses the FIRST item (WAI-ARIA menu pattern), so a
		// single ArrowDown lands on 한국어 (position 2 in support_lang).
		expect(support_lang[1]?.code).toBe('ko');
		await user.keyboard('{ArrowDown}{Enter}');
		await waitFor(() => expect(i18n.language).toBe('ko'));
		expect(localStorage.getItem('language')).toBe('ko');
	});

	it('Escape closes the menu without changing the language', async () => {
		const user = userEvent.setup();
		localStorage.setItem('language', 'en');
		renderTrigger();
		const trigger = screen.getByRole('button', {name: /select a language/i});
		trigger.focus();
		await user.keyboard('{Enter}');
		await screen.findByRole('menu');
		await user.keyboard('{Escape}');
		await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
		expect(i18n.language).toBe('en');
	});
});
