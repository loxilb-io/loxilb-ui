//---------------------------------------------------------
// Final safety-net sweep + leak detector (docs/E2E_CRUD_TEST_PLAN.md §8).
// Runs LAST (path sorts after every tests/<group>/ directory): it removes any
// e2e-/documentation-range entity the per-spec afterEach hooks missed, then
// re-lists everything and FAILS the run if any marked entity survives. The
// persistent RBAC fixtures (e2e_operator / e2e_viewer) use underscore
// usernames and are never marked, so they are intentionally left alone.
//---------------------------------------------------------
import {test, expect} from '@playwright/test';
import * as api from '../helpers/api';

const {isE2eMarked, isDocAddr, gw, listUsers, TEST_USER_PREFIX} = api;

test.describe.serial('zz — cleanup & leak detector', () => {
	test('sweep every e2e-/doc-range resource', async () => {
		const swept = await Promise.all([
			api.sweepFirewallRules(),
			api.sweepEndpoints(),
			api.sweepSniCerts(),
			api.sweepMirrors(),
			api.sweepQosPolicies(),
			api.sweepIpFilterRules(),
			api.sweepIpAddresses('ipv4'),
			api.sweepIpAddresses('ipv6'),
			api.sweepVlans(),
			api.sweepVxlans(),
			api.sweepRoutes(),
			api.sweepNeighbors(),
			api.sweepIpsecTunnels(),
			api.sweepIpsecCerts(),
			api.sweepApiKeys(),
			api.sweepLbRules(),
			api.sweepTestUsers(),
		]);
		const total = swept.reduce((a, b) => a + b, 0);
		// Informational — a clean run sweeps 0 here because per-spec hooks already ran.
		console.log(`zz-cleanup swept ${total} leftover entities`);
	});

	test('no e2e-/doc-range entity remains (leak detector)', async () => {
		const leaks: string[] = []; // removable resource types → hard failure
		const inert: string[] = []; // documented-undeletable gateway/kernel artifacts → warn only

		// Helper: list a gateway collection and flag marked entries. Entries the
		// per-spec sweeps CAN delete but left behind are real leaks; a `tolerate`
		// predicate marks known-undeletable shapes as inert instead.
		async function scan(apiPath: string, key: string, mark: (o: any) => boolean, id: (o: any) => string, tolerate?: (o: any) => boolean): Promise<void> {
			const resp = await gw('GET', apiPath);
			if (!resp.ok) return; // endpoint unavailable (e.g. AI 501) — nothing to leak
			const data = await resp.json().catch(() => ({}));
			for (const o of data[key] ?? []) {
				if (!mark(o)) continue;
				(tolerate?.(o) ? inert : leaks).push(`${apiPath} → ${id(o)}`);
			}
		}

		// Firewall rules created WITH a port range are undeletable — every DELETE
		// 404s ("no-rule error"), a documented gateway bug (see helpers/api.ts).
		const hasPortRange = (r: any) => {
			const a = r.ruleArguments ?? {};
			return [a.minSourcePort, a.maxSourcePort, a.minDestinationPort, a.maxDestinationPort].some(v => v !== undefined && v !== null && v !== 0);
		};

		await scan('/config/loadbalancer/all', 'lbAttr', r => isE2eMarked(r.serviceArguments?.name) || isE2eMarked(r.serviceArguments?.externalIP), r => r.serviceArguments?.name ?? r.serviceArguments?.externalIP);
		await scan('/config/firewall/all', 'fwAttr', r => isE2eMarked(r.ruleArguments?.sourceIP) || isE2eMarked(r.ruleArguments?.destinationIP), r => JSON.stringify(r.ruleArguments), hasPortRange);
		await scan('/config/endpoint/all', 'Attr', e => isE2eMarked(e.name) || isE2eMarked(e.hostName), e => e.name ?? e.hostName);
		await scan('/config/ipfilter/all', 'ipFilterAttr', r => isE2eMarked(r.cidr), r => r.cidr);
		await scan('/config/mirror/all', 'mirrAttr', m => isE2eMarked(m.mirrorIdent), m => m.mirrorIdent);
		await scan('/config/policy/all', 'polAttr', p => isE2eMarked(p.policyIdent), p => p.policyIdent);
		await scan('/config/route/all', 'routeAttr', r => isDocAddr(r.destinationIPNet), r => r.destinationIPNet);
		// Doc-range neighbors are auto-derived kernel entries from secondary-IP
		// adds (network/ip.spec) and 404 on direct DELETE — inert, non-disruptive.
		await scan('/config/neighbor/all', 'neighborAttr', n => isDocAddr(n.ipAddress), n => n.ipAddress, () => true);
		await scan('/config/ipsec/tunnels/all', 'ipsecTunnelAttr', t => isE2eMarked(t.name) || isDocAddr(t.remoteIp), t => t.name);

		// IPv4/IPv6 secondaries (doc ranges only).
		for (const seg of ['ipv4address', 'ipv6address'] as const) {
			const resp = await gw('GET', `/config/${seg}/all`);
			if (resp.ok) {
				const data = await resp.json().catch(() => ({}));
				for (const attr of data.ipAttr ?? []) {
					for (const cidr of attr.ipAddress ?? []) {
						if (isDocAddr(cidr)) leaks.push(`/config/${seg} → ${cidr} on ${attr.dev}`);
					}
				}
			}
		}

		// OAM users (throwaway prefix; fixtures/admin are never flagged).
		for (const u of await listUsers()) {
			if (u.username?.startsWith(TEST_USER_PREFIX)) leaks.push(`user → ${u.username}`);
		}
		if (inert.length) console.warn(`zz-cleanup tolerated ${inert.length} known-undeletable artifact(s):\n${inert.join('\n')}`);
		expect(leaks, `leaked removable e2e-/doc-range entities:\n${leaks.join('\n')}`).toEqual([]);
	});
});
