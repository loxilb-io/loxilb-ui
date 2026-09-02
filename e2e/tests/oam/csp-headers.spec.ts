//---------------------------------------------------------
// UI-P2-1 Content-Security-Policy contract (ES-22 / ES-23 / ES-29), against a
// CONTAINER-BUILT image.
//
// Why this file is skipped by default, and must stay that way: the CSP lives
// in nginx-app.conf.template and is substituted by docker-entrypoint.sh at
// container start. The CRA dev server the rest of the suite runs against
// serves NO CSP header at all. Asserting the policy there would produce a test
// that is green for the wrong reason and would keep being green if the
// container's policy were deleted outright — the worst possible outcome for a
// security header.
//
// To run it, point E2E_CONTAINER_URL at a running container built from this
// tree (see docs/container-image.md; the campaign builds on the Linux testbed,
// not on macOS):
//
//   E2E_CONTAINER_URL=http://<host>:8080/netlox/ \
//     npx playwright test --project=gw e2e/tests/oam/csp-headers.spec.ts
//
// Scope: the policy contract on the served shell, plus zero violations on what
// that shell renders unauthenticated. The full authenticated 40-route walk is
// an evidence-run procedure (evidence/UI-P2-1/) because it needs a session on
// the container's own origin; this file is the part that can run every phase.
//---------------------------------------------------------
import {expect, test} from '../../fixtures';

const CONTAINER_URL = process.env.E2E_CONTAINER_URL;

test.describe('CSP on the container-built image', () => {
	test.skip(
		!CONTAINER_URL,
		'set E2E_CONTAINER_URL to a running container to run these — the dev server serves no CSP header, so running them there would assert nothing',
	);

	/** The policy as the container actually serves it, parsed into directives. */
	async function fetchPolicy(page: import('@playwright/test').Page): Promise<Record<string, string[]>> {
		const response = await page.goto(CONTAINER_URL!, {waitUntil: 'domcontentloaded'});
		expect(response, 'the container did not answer').not.toBeNull();
		const header =
			response!.headers()['content-security-policy'] ?? response!.headers()['Content-Security-Policy'];
		expect(header, 'no Content-Security-Policy header on the served shell').toBeTruthy();

		const directives: Record<string, string[]> = {};
		for (const part of header!.split(';')) {
			const [name, ...values] = part.trim().split(/\s+/);
			if (name) directives[name.toLowerCase()] = values;
		}
		return directives;
	}

	test('scripts run only from this origin — no unsafe-inline, no unsafe-eval', async ({page}) => {
		const csp = await fetchPolicy(page);
		const scriptSrc = csp['script-src'] ?? csp['default-src'] ?? [];

		// unsafe-eval was the reason the old policy mitigated nothing: with it,
		// any injected inline script executes and CSP is decoration.
		expect(scriptSrc, `script-src was: ${scriptSrc.join(' ')}`).not.toContain("'unsafe-eval'");
		expect(scriptSrc, `script-src was: ${scriptSrc.join(' ')}`).not.toContain("'unsafe-inline'");
		expect(scriptSrc).toContain("'self'");
	});

	test('the app can only talk back to its own origin', async ({page}) => {
		const csp = await fetchPolicy(page);
		const connectSrc = csp['connect-src'] ?? csp['default-src'] ?? [];

		// The SPA only ever calls same-origin /api/oam/* through its edge. The
		// old `connect-src https: http: ws: wss:` let compromised JS exfiltrate
		// to ANY origin, which is the whole value of the directive given away.
		for (const wildcard of ['https:', 'http:', 'ws:', 'wss:', '*']) {
			expect(connectSrc, `connect-src must not allow the bare scheme ${wildcard}: ${connectSrc.join(' ')}`).not.toContain(wildcard);
		}
		expect(connectSrc).toContain("'self'");
	});

	test('clickjacking and base-tag pivots are closed at the CSP level', async ({page}) => {
		const csp = await fetchPolicy(page);
		// Absent directives fall back to default-src for FETCH directives only —
		// these three do not, so each has to be stated explicitly.
		expect(csp, 'frame-ancestors missing — the app can be framed').toHaveProperty('frame-ancestors');
		expect(csp, 'object-src missing').toHaveProperty('object-src');
		expect(csp, 'base-uri missing — a <base> injection can repoint every relative URL').toHaveProperty('base-uri');
		expect(csp['frame-ancestors']).not.toContain('*');
	});

	test('the shell the container serves violates its own policy zero times', async ({page}) => {
		// A policy no one can load the app under is not a win. This is the
		// counterweight to the three assertions above: they tighten, this one
		// proves the product still runs inside what they allow.
		const violations: string[] = [];
		await page.addInitScript(() => {
			document.addEventListener('securitypolicyviolation', e => {
				(window as unknown as {__csp: string[]}).__csp ??= [];
				(window as unknown as {__csp: string[]}).__csp.push(`${e.violatedDirective} ← ${e.blockedURI}`);
			});
		});

		await page.goto(CONTAINER_URL!, {waitUntil: 'domcontentloaded'});
		// The login form is the whole unauthenticated surface; wait for it so the
		// bundle has actually executed before the count is read.
		await expect(page.getByRole('button').first()).toBeVisible({timeout: 30_000});
		violations.push(...((await page.evaluate(() => (window as unknown as {__csp?: string[]}).__csp ?? [])) ?? []));

		expect(violations, `the shell violated its own CSP:\n${violations.join('\n')}`).toEqual([]);
	});
});
