//---------------------------------------------------------
// IP-validation guard (loxilb-ui, FIXED) — the Firewall form let a malformed
// Source IP / Destination IP / SNAT To IP through to the gateway.
//
// RCA: useFormWithParams' validateForm only checks required/integer/enum —
// it never validates ipaddress/ipaddress_cidr string formats. IPAddressBox
// shows a red helper but still forwards the invalid value on onChange. Every
// other IP-bearing form (IPFilter/IPsec/LB/Endpoint/Vip) adds an explicit
// isValidIPAddress gate; FirewallInputForm was the lone omission, so its
// submit was gated only on required fields (none of these three are) + port
// ranges. A user could POST a garbage SNAT target.
//
// Fix: FirewallInputForm.formValid now also requires src/dst/toIP to be a
// valid IP (or empty). This is a pure UI hardening — surfaced by the
// ipmasquerade cicd scenario, which is the only e2e coverage the Firewall
// form has. Adversarial, not happy-path (see e2e-testing-philosophy).
//---------------------------------------------------------
import {expect, test} from '../../../fixtures';
import {activeInstance, sweepFirewallRules} from '../../../helpers/api';
import {dialogButton, openToolbarDialog} from '../../../helpers/dialogs';
import {field, isEventuallyDisabled} from '../../../helpers/form';
import {showAllRows, toolbarButton} from '../../../helpers/table';

let instName: string;

test.describe('cicd/ipmasquerade — Firewall form IP validation', () => {
	test.beforeAll(async () => {
		instName = (await activeInstance()).name;
		await sweepFirewallRules();
	});

	test.afterEach(async () => {
		await sweepFirewallRules();
	});

	test('V-invalid-ip: malformed Source IP / SNAT To IP block submit', async ({page}) => {
		await page.goto(`instance/traffic/fw?name=${instName}`);
		await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
		await showAllRows(page);

		await openToolbarDialog(page, 'Add', 'Firewall Rule Arguments');
		const addBtn = dialogButton(page, 'Add');

		// A well-formed masquerade rule (doc-range source + doc SNAT target) submits.
		await field(page, 'Source IP').fill('203.0.113.200/32');
		await field(page, 'Do SNAT').check();
		await field(page, 'To IP').fill('198.51.100.254');
		await expect(addBtn).toBeEnabled();

		// Out-of-range octet in the SNAT target (the old form accepted this and
		// POSTed a garbage toIP) → must block.
		await field(page, 'To IP').fill('999.1.1.1');
		expect(await isEventuallyDisabled(addBtn), 'garbage SNAT To IP must block submit').toBe(true);
		await field(page, 'To IP').fill('198.51.100.254');
		await expect(addBtn).toBeEnabled();

		// Garbage Source IP → must block.
		await field(page, 'Source IP').fill('not-an-ip');
		expect(await isEventuallyDisabled(addBtn), 'garbage Source IP must block submit').toBe(true);
		await field(page, 'Source IP').fill('203.0.113.0/33'); // /33 is out of range
		expect(await isEventuallyDisabled(addBtn), 'out-of-range prefix must block submit').toBe(true);
		await field(page, 'Source IP').fill('203.0.113.200/32');
		await expect(addBtn).toBeEnabled();

		await dialogButton(page, 'Cancel').click();
	});
});
