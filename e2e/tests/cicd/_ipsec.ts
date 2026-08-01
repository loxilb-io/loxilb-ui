//---------------------------------------------------------
// Shared scaffolding for the cicd IPsec scenarios
// (docs/E2E_CICD_SCENARIO_TEST_PLAN.md — Group D ipsec1/2/3/-e2e).
//
// The cicd ipsec dirs bring a site-to-site tunnel up out-of-band (raw
// `ip xfrm`/strongswan with static SPI + keys) and then place an LB rule
// whose backends sit across the tunnel. That raw-xfrm form is not what the
// loxilb-ui tunnel dialog expresses — the UI models a strongswan PSK/IKE
// tunnel via `/config/ipsec/tunnels`. So (as with the gRPC dissolution)
// we reproduce the SCENARIO — a config-created tunnel + the LB rule — using
// the UI's own model, and validate both round-trip via REST. Peer liveness /
// real bring-up is out of scope on the single-node testbed (the tunnel lands
// DOWN, which is asserted).
//
// Safety: every tunnel is e2e- named with a documentation-range remote peer
// and startup=add (responder — never dials out). sweepIpsecTunnels() clears
// leftovers; the LB half reuses the _recipes safety envelope.
//---------------------------------------------------------
import {expect, Page} from '@playwright/test';
import {gw, gwJson} from '../../helpers/api';
import {dialog, dialogButton, expectSuccessAndDismiss} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {refreshUntilRow, showAllRows, toolbarButton} from '../../helpers/table';

export const TUN_PATH = '/config/ipsec/tunnels';
// localIp must be an on-box address; reuse the real gateway address the
// existing ipsec/tunnels.spec.ts uses (kept green on this testbed).
export const TUN_LOCAL_IP = '10.0.0.12';

export interface TunnelRecipe {
	/** Origin: cicd/<dir>. */
	cicd: string;
	/** e2e- named — swept by sweepIpsecTunnels. */
	name: string;
	/** documentation-range remote peer (never reachable → tunnel stays DOWN). */
	remoteIp: string;
	psk: string;
	/** protected subnets across the tunnel (the cicd routes/policies). */
	localSubnet?: string;
	remoteSubnet?: string;
}

/** Drives the IPsec Tunnel Add dialog to create `r`; asserts 2xx + Success + row DOWN. */
export async function driveTunnelCreate(page: Page, instName: string, r: TunnelRecipe): Promise<any> {
	await page.goto(`instance/ipsec/tunnels?name=${instName}`); // relative — baseURL carries /netlox
	await expect(toolbarButton(page, 'Add')).toBeVisible({timeout: 20_000});
	await showAllRows(page);

	await toolbarButton(page, 'Add').click();
	await expect(dialog(page).getByRole('heading', {name: 'New IPsec Tunnel'})).toBeVisible();
	await field(page, 'Name').fill(r.name);
	await field(page, 'Local IP').fill(TUN_LOCAL_IP);
	await field(page, 'Remote IP').fill(r.remoteIp);
	await field(page, 'Pre-Shared Key').fill(r.psk);
	if (r.localSubnet) await field(page, 'Local Subnet (CIDR)').fill(r.localSubnet);
	if (r.remoteSubnet) await field(page, 'Remote Subnet (CIDR)').fill(r.remoteSubnet);

	await page.mouse.move(0, 0); // drop any sticky ParamBox tooltip over the footer
	const [req] = await Promise.all([
		page.waitForRequest(rq => rq.method() === 'POST' && rq.url().endsWith(TUN_PATH)),
		dialogButton(page, 'Add').click(),
	]);
	const resp = await req.response();
	expect(resp?.status(), `gateway accepted ${r.cicd} tunnel`).toBeLessThan(300);
	await expectSuccessAndDismiss(page);

	// A documentation-range peer is unreachable and the tunnel is a responder
	// (startup=add, never dials out), so strongSwan never establishes it — it
	// sits in CONNECTING (loaded, retrying/awaiting the peer) and, once given
	// up on, DOWN. Either non-established state is correct; assert it is simply
	// not UP. (The UI faithfully surfaces the gateway's real state — it must not
	// be forced to DOWN just because the peer will never answer.)
	await refreshUntilRow(page, r.name);
	await expect(page.locator('.MuiDataGrid-row', {hasText: r.name}).first()).toContainText(/DOWN|CONNECTING/);
	return req.postDataJSON();
}

/** The REST validation: re-GET the tunnel and assert the peer + subnets persisted. */
export async function assertTunnelReadback(r: TunnelRecipe): Promise<void> {
	const data = await gwJson<{ipsecTunnelAttr?: any[]}>(`${TUN_PATH}/all`);
	const tun = (data.ipsecTunnelAttr ?? []).find(x => x.name === r.name);
	expect(tun, `${r.cicd}: tunnel ${r.name} present in read-back`).toBeTruthy();
	expect(tun.remoteIp, `${r.cicd}: remote peer round-trips`).toBe(r.remoteIp);
	if (r.remoteSubnet) expect(tun.selector?.dstCidr, `${r.cicd}: remote subnet round-trips`).toBe(r.remoteSubnet);
	if (r.localSubnet) expect(tun.selector?.srcCidr, `${r.cicd}: local subnet round-trips`).toBe(r.localSubnet);
	// The stored PSK must be mirrored into the downloadable peer config verbatim.
	const peer = await (await gw('GET', `${TUN_PATH}/${encodeURIComponent(r.name)}/peerconfig`)).json();
	expect(peer.ipsecSecrets ?? '', `${r.cicd}: PSK mirrored to peer config`).toContain(r.psk);
}

/** DELETE the tunnel by name (afterEach cleanup); tolerant if already gone. */
export async function cleanupTunnel(name: string): Promise<void> {
	await gw('DELETE', `${TUN_PATH}/${encodeURIComponent(name)}`);
}
