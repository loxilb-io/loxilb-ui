//---------------------------------------------------------
// Axe component checks over shared UI building blocks
// (npm run a11y:test). Each case renders a component and
// fails on any axe violation, so a regression in a shared
// component fails CI before it multiplies across pages.
//
// The route-level pass lives in e2e/tests/a11y.axe.spec.ts
// (needs the running app + testbed).
//---------------------------------------------------------
import axe from 'axe-core';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LanguageIcon from 'components/layout/LanguageIcon';
import {MemoryRouter} from 'react-router-dom';
import {afterEach, describe, expect, it, vi} from 'vitest';

vi.mock('react-router-dom', async importOriginal => {
	const mod = await importOriginal<typeof import('react-router-dom')>();
	return {...mod, useNavigate: () => vi.fn()};
});

afterEach(cleanup);

// jsdom has no layout engine: color-contrast (needs computed styles over real
// rendering) is meaningless here. 'region' asserts page-level landmark
// structure, which a bare test body cannot have. Both are covered at the
// route level by the Playwright axe pass instead.
const RULES = {rules: {'color-contrast': {enabled: false}, region: {enabled: false}}} as const;

async function expectNoViolations(node: Element) {
	const results = await axe.run(node, RULES);
	const report = results.violations.map(v => `${v.id}: ${v.help} → ${v.nodes.map(n => n.target.join(' ')).join('; ')}`).join('\n');
	expect(results.violations, report).toHaveLength(0);
}

describe('axe: language selector', () => {
	it('trigger button has no violations', async () => {
		const {container} = render(
			<MemoryRouter>
				<LanguageIcon />
			</MemoryRouter>,
		);
		await expectNoViolations(container);
	});

	it('open menu has no violations', async () => {
		const user = userEvent.setup();
		render(
			<MemoryRouter>
				<LanguageIcon />
			</MemoryRouter>,
		);
		await user.click(screen.getByRole('button', {name: /select a language/i}));
		await screen.findByRole('menu');
		// The menu renders into a portal — check the whole document body.
		await expectNoViolations(document.body);
	});
});

describe('axe gate self-test', () => {
	it('detects an injected violation (gate is red-capable)', async () => {
		// An image without alt text is a bread-and-butter axe finding; if this
		// stops failing, the gate is broken, not the page.
		const div = document.createElement('div');
		div.innerHTML = '<img src="x.png">';
		document.body.appendChild(div);
		const results = await axe.run(div, RULES);
		div.remove();
		expect(results.violations.map(v => v.id)).toContain('image-alt');
	});
});
