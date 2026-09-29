//---------------------------------------------------------
// LB edit (PATCH) refused with 412 — mock contract layer (SYNC-E2E-01)
//---------------------------------------------------------
// The gateway declares 412 on the LB tuple PATCH: adding allowedSources to a
// rule allocated a slot past the source-check range (slots 0-28) is refused
// whatever the body says. C-01 (tests/ai/kvexact-readiness.mock.spec.ts) pins
// how the CREATE path reports that; nothing covered the edit path, and the
// edit path did not render the gateway's sentence at all.
//
// ⭐ Only the rule list and the PATCH are intercepted. `/version` and `/meta`
// stay real, so the flavor gate that picks the PATCH strategy is exercised.
import type {Page, Request, Route} from '@playwright/test';
import {expect, test} from '../../fixtures';
import {activeInstance} from '../../helpers/api';
import {dialog, dialogButton, openToolbarDialog} from '../../helpers/dialogs';
import {expandSection, field} from '../../helpers/form';
import {selectRowByText} from '../../helpers/table';

const LB_ALL_RE = /\/netlox\/v1\/config\/loadbalancer\/all(\?.*)?$/;
const LB_TUPLE_RE = /\/netlox\/v1\/config\/loadbalancer\/externalipaddress\/192\.0\.2\.81\/port\/18081\/protocol\/tcp(\?.*)?$/;

const RULE_NAME = 'e2e-lb-patch-412';
const SOURCE = '198.51.100.0/26';

// The gateway's own sentence (common/lb_source_check_precondition.go at
// 64d95c2e), with the numbers a 30-rule gateway would put in it. Asserted
// verbatim: a paraphrase in the UI is a regression.
const GW_SENTENCE =
	'source checks (allowedSources) can be carried by at most 29 load-balancer rules (rule slots 0-28) and all 29 of those slots are held by existing rules; this rule was allocated slot 31. Delete a load-balancer rule holding a lower slot and create this one again -- freed slots are reused first';

// An L4 (mode 0) rule with no sources: the edit goes through the merge PATCH.
const RULE = {
	serviceArguments: {name: RULE_NAME, externalIP: '192.0.2.81', port: 18081, protocol: 'tcp', sel: 0, mode: 0, inactiveTimeOut: 30},
	endpoints: [{endpointIP: '198.51.100.81', targetPort: 18081, weight: 1, state: 'active'}],
	secondaryIPs: null,
	allowedSources: null,
};

let instName: string;

async function mockRuleList(page: Page): Promise<{count: () => number}> {
	let calls = 0;
	await page.route(LB_ALL_RE, (route: Route) => {
		calls += 1;
		return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({lbAttr: [RULE]})});
	});
	return {count: () => calls};
}

test.describe('@gw LB edit precondition — mock contract', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
	});

	test('SYNC-E2E-01: a 412 on the LB PATCH is a deployment precondition, with the gateway sentence', async ({page, consoleGuard}) => {
		consoleGuard.allowRequest({status: 412, path: /\/config\/loadbalancer\/externalipaddress\//});
		const list = await mockRuleList(page);
		const writes: Request[] = [];
		await page.route(LB_TUPLE_RE, (route: Route) => {
			writes.push(route.request());
			if (route.request().method() !== 'PATCH') return route.fallback();
			return route.fulfill({status: 412, contentType: 'application/json', body: JSON.stringify({code: 412, message: 'Server precondition not met for API call', result: GW_SENTENCE})});
		});

		await page.goto(`instance/traffic/lb?name=${instName}`);
		await selectRowByText(page, RULE_NAME);
		await openToolbarDialog(page, 'Edit', 'Edit Load Balancer Rule');
		const sources = await expandSection(page, /^Allowed Sources$/);
		await sources.getByRole('button', {name: 'Add', exact: true}).click();
		await field(page, 'IP Address', sources).first().fill(SOURCE);

		const listReadsBeforeSubmit = list.count();
		await dialogButton(page, 'Update').click();

		// The mapped headline says whose problem it is; the gateway sentence says
		// what to change. Both, and not the "fix your input" wording.
		await expect(page.getByText(/its deployment must change/)).toBeVisible({timeout: 20_000});
		await expect(page.getByText(GW_SENTENCE, {exact: false})).toBeVisible();
		await expect(page.getByText('The request was rejected as invalid.')).toHaveCount(0);
		// Non-retryable: the same PATCH is refused identically until the
		// deployment changes, so there is nothing to retry.
		await expect(page.getByRole('button', {name: 'Retry'})).toHaveCount(0);
		await expect(page.getByText('Load balancer rule updated successfully.')).toHaveCount(0);

		// Exactly one write, a PATCH carrying only the operator's change: the
		// strategy was the merge PATCH, not a delete + re-create.
		expect(writes.map(r => r.method())).toEqual(['PATCH']);
		expect(writes[0].postDataJSON()).toEqual({allowedSources: [{prefix: SOURCE}]});
		// A refusal is not reported as a success, so the list is not re-read
		// to confirm a write that did not happen.
		expect(list.count()).toBe(listReadsBeforeSubmit);

		const errorHeading = page.getByRole('heading', {name: 'Error'});
		const errorModal = page.locator('.MuiModal-root').filter({has: errorHeading}).last();
		await errorModal.getByRole('button', {name: 'OK', exact: true}).click();
		await expect(errorHeading).toHaveCount(0);
		await expect(dialog(page)).toHaveCount(0);
	});
});
