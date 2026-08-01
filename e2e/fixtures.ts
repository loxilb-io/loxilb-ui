//---------------------------------------------------------
// Shared test base: every spec gets (1) a console-error
// collector that fails the test on uncaught errors, and
// (2) the F15 regression guard — the app must never redirect
// to a full error page during a flow.
//---------------------------------------------------------
import {test as base, expect} from '@playwright/test';

export interface ConsoleGuard {
	/** Allowlist an expected error for this test (e.g. a deliberate 4xx in a V-case). */
	allow(pattern: RegExp): void;
	violations(): string[];
}

// Ambient dev-server / browser noise that is not an app defect.
const GLOBAL_ALLOW: RegExp[] = [
	/Download the React DevTools/i,
	/WebSocket connection .* failed/i,
	/manifest\.json/i,
	/favicon/i,
];

export const test = base.extend<{consoleGuard: ConsoleGuard}>({
	consoleGuard: [
		async ({page}, use) => {
			const allowed = [...GLOBAL_ALLOW];
			const errors: string[] = [];
			page.on('console', msg => {
				if (msg.type() === 'error') errors.push(msg.text());
			});
			page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));

			const guard: ConsoleGuard = {
				allow: p => allowed.push(p),
				violations: () => errors.filter(e => !allowed.some(p => p.test(e))),
			};

			await use(guard);

			expect(guard.violations(), 'uncaught console errors during test').toEqual([]);
			// F15 guard: gateway pass-through failures must degrade in-page,
			// never nuke the app onto an error route.
			expect(page.url(), 'app redirected to a full error page (F15 regression)').not.toMatch(/\/(404|500|503|cors)(\?|$)/);
		},
		{auto: true},
	],
});

export {expect};
