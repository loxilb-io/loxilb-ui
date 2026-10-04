//---------------------------------------------------------
// Shared test base: every spec gets (1) a console-error
// collector that fails the test on uncaught errors, and
// (2) the no-redirect regression guard — the app must never redirect
// to a full error page during a flow.
//---------------------------------------------------------
import {test as base, expect} from '@playwright/test';
import {attachConsoleGuard, ConsoleGuard} from './helpers/consoleGuard';

export type {ConsoleGuard};

export const test = base.extend<{consoleGuard: ConsoleGuard}>({
	consoleGuard: [
		async ({page}, use) => {
			const guard = attachConsoleGuard(page);

			await use(guard);

			expect(guard.violations(), 'uncaught console errors during test').toEqual([]);
			// Gateway pass-through failures must degrade in-page,
			// never nuke the app onto an error route.
			expect(page.url(), 'app redirected to a full error page').not.toMatch(/\/(404|500|503|cors)(\?|$)/);
		},
		{auto: true},
	],
});

export {expect};
