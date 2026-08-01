//---------------------------------------------------------
// cicd source: cicd/secfilter — an LB VIP guarded by an XDP ipfilter.
//   create_lb_rule llb1 20.20.20.1 --tcp=2020:8080 --endpoints=31.31.31.1:1
//   + (validation.sh) POST /config/ipfilter blacklist/drop + whitelist/allow
// The data-plane drop/precedence is traffic-only (out of scope); this spec
// reproduces the CONFIG surface from the UI — the LB rule + the ipfilter
// rules — and validates each round-trips through the gateway REST.
//
// Adversarial focus: the cicd precedence invariant (a whitelist /32 must beat
// an overlapping blacklist /24 at EQUAL priority) depends entirely on the
// gateway storing `priority` faithfully. So this asserts priority round-trips
// exactly on the overlapping pair — a dropped/coerced priority is a real
// gateway bug that a happy-path create-only check would hide.
//---------------------------------------------------------
import {Page} from '@playwright/test';
import {expect, test} from '../../../fixtures';
import {activeInstance, gwJson, sweepFirewallRules, sweepIpFilterRules, sweepLbRules} from '../../../helpers/api';
import {dialog, dialogButton, expectSuccessAndDismiss, selectOption} from '../../../helpers/dialogs';
import {field} from '../../../helpers/form';
import {refreshUntilRow, showAllRows, toolbarButton} from '../../../helpers/table';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../_recipes';

const IPF_PATH = '/config/ipfilter';

const lb: LbRecipe = {
	cicd: 'cicd/secfilter',
	name: 'e2e-cicd-secfilter-lb',
	vip: '203.0.113.80',
	port: '2020',
	protocol: 'tcp',
	endpoints: [{ip: '198.51.100.1', targetPort: '8080'}],
};

interface FilterRule {
	filterType: 'whitelist' | 'blacklist';
	cidr: string;
	action: 'allow' | 'drop';
	priority: number;
}

// The cicd scenario's rules, re-keyed onto documentation ranges: a plain
// blacklist/drop, then the overlapping equal-priority precedence pair.
const blacklist: FilterRule = {filterType: 'blacklist', cidr: '203.0.113.90/32', action: 'drop', priority: 200};
const overlapBlack: FilterRule = {filterType: 'blacklist', cidr: '203.0.113.0/24', action: 'drop', priority: 100};
const overlapWhite: FilterRule = {filterType: 'whitelist', cidr: '203.0.113.91/32', action: 'allow', priority: 100};

async function driveIpFilterCreate(page: Page, instName: string, r: FilterRule): Promise<void> {
	await page.goto(`instance/security/ipfilter?name=${instName}`);
	await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
	await showAllRows(page);

	await toolbarButton(page, 'Add').click();
	await expect(dialog(page).getByText('New IP Filter Rule Configuration')).toBeVisible();
	if (r.filterType !== 'whitelist') await selectOption(page, 'Filter Type', r.filterType);
	if (r.action !== 'allow') await selectOption(page, 'Action', r.action);
	await field(page, 'CIDR').fill(r.cidr);
	await field(page, 'Priority').fill(String(r.priority));

	await page.mouse.move(0, 0);
	const [req] = await Promise.all([
		page.waitForRequest(rq => rq.method() === 'POST' && rq.url().includes(IPF_PATH)),
		dialogButton(page, 'Add').click(),
	]);
	const body = req.postDataJSON();
	expect(body).toMatchObject({filterType: r.filterType, cidr: r.cidr, action: r.action, priority: r.priority});
	expect(body.isValid, 'isValid must not leak into the ipfilter payload').toBeUndefined();
	expect((await req.response())?.status(), `gateway accepted ${r.cidr}`).toBeLessThan(300);
	await expectSuccessAndDismiss(page);
	await refreshUntilRow(page, r.cidr);
}

async function assertFilterReadback(r: FilterRule): Promise<void> {
	const data = await gwJson<{ipFilterAttr?: any[]}>(`${IPF_PATH}/all`);
	const rule = (data.ipFilterAttr ?? []).find(x => x.cidr === r.cidr && x.filterType === r.filterType);
	expect(rule, `secfilter: ipfilter ${r.filterType} ${r.cidr} present in read-back`).toBeTruthy();
	expect(rule.action, `secfilter: ${r.cidr} action round-trips`).toBe(r.action);
	// The precedence invariant is meaningless if priority does not round-trip.
	expect(rule.priority, `secfilter: ${r.cidr} priority round-trips exactly`).toBe(r.priority);
}

let instName: string;

test.describe('cicd/secfilter — LB VIP + XDP ipfilter config round-trip', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepLbRules();
		await sweepFirewallRules();
		await sweepIpFilterRules();
	});

	test.afterEach(async () => {
		await cleanupLbByName(lb.name);
		await sweepLbRules();
		await sweepFirewallRules();
		await sweepIpFilterRules();
	});

	test('LB rule + blacklist + equal-priority precedence pair all round-trip', async ({page}) => {
		// The guarded VIP.
		await runLbScenario(page, instName, lb);

		// A plain blacklist/drop and the overlapping equal-priority pair (the
		// whitelist-beats-blacklist precedence config).
		await driveIpFilterCreate(page, instName, blacklist);
		await driveIpFilterCreate(page, instName, overlapBlack);
		await driveIpFilterCreate(page, instName, overlapWhite);

		await assertFilterReadback(blacklist);
		await assertFilterReadback(overlapBlack);
		await assertFilterReadback(overlapWhite);
	});
});
