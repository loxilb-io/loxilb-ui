//---------------------------------------------------------
// Final safety-net sweep + leak detector for the loxilb-oss suite.
//
// Runs LAST (the `zz-` prefix sorts after every other spec in this flat
// tree): it removes any e2e-/documentation-range entity the per-spec
// afterEach hooks missed, then re-lists everything and FAILS the run if a
// marked entity survives.
//
// Deliberately narrower than the gateway tree's zz-cleanup: it sweeps only
// the families this suite can create. The gateway-only families (ipsec, sni,
// ipfilter, ipv6, AI keys) 404 upstream, and the OAM-side entities (users,
// instance registrations) belong to the gateway tree's specs — sweeping
// those from here would let one leg tidy up after the other and hide a real
// leak in whichever suite actually created it.
//---------------------------------------------------------
import {expect, test} from '@playwright/test';
import * as api from '../../helpers/api';
import {requireLoxilbInstance} from '../_loxilb';

const {isE2eMarked, isDocAddr, gw} = api;

test.describe.serial('@loxilb zz — cleanup & leak detector (loxilb-oss)', () => {
	test.beforeAll(async () => {
		await requireLoxilbInstance();
	});

	test('sweep every e2e-/doc-range resource this suite can create', async () => {
		const swept = await Promise.all([
			api.sweepLbRules(),
			api.sweepFirewallRules(),
			api.sweepEndpoints(),
			api.sweepMirrors(),
			api.sweepQosPolicies(),
			api.sweepIpAddresses('ipv4'),
			api.sweepVlans(),
			api.sweepVxlans(),
			api.sweepRoutes(),
			api.sweepNeighbors(),
		]);
		// Informational — a clean run sweeps 0 because per-spec hooks already ran.
		console.log(`zz-cleanup (oss) swept ${swept.reduce((a, b) => a + b, 0)} leftover entities`);
	});

	test('no e2e-/doc-range entity remains (leak detector)', async () => {
		const leaks: string[] = []; // removable → hard failure
		const inert: string[] = []; // documented-undeletable → warn only

		async function scan(apiPath: string, key: string, mark: (o: any) => boolean, id: (o: any) => string, tolerate?: (o: any) => boolean): Promise<void> {
			const resp = await gw('GET', apiPath);
			if (!resp.ok) return;
			const data = await resp.json().catch(() => ({}));
			for (const o of data[key] ?? []) {
				if (!mark(o)) continue;
				(tolerate?.(o) ? inert : leaks).push(`${apiPath} → ${id(o)}`);
			}
		}

		// Firewall rules created WITH a port range are undeletable — every
		// DELETE 404s ("no-rule error"); see helpers/api.ts.
		const hasPortRange = (r: any) => {
			const a = r.ruleArguments ?? {};
			return [a.minSourcePort, a.maxSourcePort, a.minDestinationPort, a.maxDestinationPort].some(v => v !== undefined && v !== null && v !== 0);
		};

		await scan('/config/loadbalancer/all', 'lbAttr', r => isE2eMarked(r.serviceArguments?.name) || isE2eMarked(r.serviceArguments?.externalIP), r => r.serviceArguments?.name ?? r.serviceArguments?.externalIP);
		await scan('/config/firewall/all', 'fwAttr', r => isE2eMarked(r.ruleArguments?.sourceIP) || isE2eMarked(r.ruleArguments?.destinationIP), r => JSON.stringify(r.ruleArguments), hasPortRange);
		await scan('/config/endpoint/all', 'Attr', e => isE2eMarked(e.name) || isE2eMarked(e.hostName), e => e.name ?? e.hostName);
		await scan('/config/mirror/all', 'mirrAttr', m => isE2eMarked(m.mirrorIdent), m => m.mirrorIdent);
		await scan('/config/policy/all', 'polAttr', p => isE2eMarked(p.policyIdent), p => p.policyIdent);
		await scan('/config/route/all', 'routeAttr', r => isDocAddr(r.destinationIPNet), r => r.destinationIPNet);
		// Doc-range neighbors are kernel entries auto-derived from secondary-IP
		// adds and 404 on direct DELETE — inert, non-disruptive.
		await scan('/config/neighbor/all', 'neighborAttr', n => isDocAddr(n.ipAddress), n => n.ipAddress, () => true);

		const resp = await gw('GET', '/config/ipv4address/all');
		if (resp.ok) {
			const data = await resp.json().catch(() => ({}));
			for (const attr of data.ipAttr ?? []) {
				for (const cidr of attr.ipAddress ?? []) {
					if (isDocAddr(cidr)) leaks.push(`/config/ipv4address → ${cidr} on ${attr.dev}`);
				}
			}
		}

		if (inert.length) console.warn(`zz-cleanup (oss) tolerated ${inert.length} known-undeletable artifact(s):\n${inert.join('\n')}`);
		expect(leaks, `leaked removable e2e-/doc-range entities on the loxilb instance:\n${leaks.join('\n')}`).toEqual([]);
	});
});
