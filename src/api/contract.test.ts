import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import YAML from 'yaml';

// Backward-compatibility contract between this UI and the vendored backend
// specs (api-spec/*). When a new loxilb-inference-gateway or oam-loxilb
// version is vendored (npm run sync:specs), these tests fail if the backend
// renamed/removed anything the UI actually reads — the exact break class that
// version bumps introduce silently.
//
// Keep the tables below in sync with src/connector/** reads. A failure here
// means: the new backend spec is not backward compatible — fix the connector
// (and likely the page) before merging the spec bump.

const root = path.resolve(__dirname, '../..');
const gateway = YAML.parse(fs.readFileSync(path.join(root, 'api-spec/gateway-swagger.yml'), 'utf8'));
const oam = JSON.parse(fs.readFileSync(path.join(root, 'api-spec/oam-swagger.json'), 'utf8'));

// response JSON pointer helpers (swagger 2.0)
function resolveRef(spec: any, node: any): any {
	if (node && node.$ref) {
		const parts = node.$ref.replace(/^#\//, '').split('/');
		return resolveRef(spec, parts.reduce((acc: any, k: string) => acc?.[k], spec));
	}
	return node;
}

function successSchema(spec: any, p: string, method: string): any {
	const op = spec.paths?.[p]?.[method];
	expect(op, `${method.toUpperCase()} ${p} missing from spec`).toBeTruthy();
	const responses = op.responses ?? {};
	const code = ['200', '201', '204'].find(c => responses[c]);
	return resolveRef(spec, responses[code!]?.schema);
}

function propNames(spec: any, schema: any): string[] {
	return Object.keys(resolveRef(spec, schema)?.properties ?? {});
}

//---------------------------------------------------------
// Gateway: list-envelope keys every table page reads
//---------------------------------------------------------
const GATEWAY_LIST_KEYS: [string, string][] = [
	['/config/loadbalancer/all', 'lbAttr'],
	['/config/conntrack/all', 'ctAttr'],
	['/config/port/all', 'portAttr'],
	['/config/route/all', 'routeAttr'],
	['/config/ipv4address/all', 'ipAttr'],
	['/config/neighbor/all', 'neighborAttr'],
	['/config/fdb/all', 'fdbAttr'],
	['/config/vlan/all', 'vlanAttr'],
	['/config/tunnel/vxlan/all', 'vxlanAttr'],
	['/config/policy/all', 'polAttr'],
	['/config/mirror/all', 'mirrAttr'],
	['/config/firewall/all', 'fwAttr'],
	['/config/endpoint/all', 'Attr'],
	['/config/bfd/all', 'Attr'],
	['/config/cistate/all', 'Attr'],
	['/config/ipfilter/all', 'ipFilterAttr'],
	['/config/securityrate/all', 'securityrateAttr'],
	['/config/synflood/all', 'synfloodAttr'],
	['/config/bgp/neigh/all', 'bgpNeiAttr'],
	['/config/bgp/policy/definitions/all', 'bgpPolicyAttr'],
];

describe('gateway spec contract — list envelopes', () => {
	it.each(GATEWAY_LIST_KEYS)('GET %s exposes %s', (p, key) => {
		expect(propNames(gateway, successSchema(gateway, p, 'get'))).toContain(key);
	});
});

describe('gateway spec contract — models the UI depends on', () => {
	it('LoadbalanceEntry keeps the serviceArguments/endpoints envelope', () => {
		const props = propNames(gateway, gateway.definitions.LoadbalanceEntry);
		expect(props).toEqual(expect.arrayContaining(['serviceArguments', 'endpoints', 'secondaryIPs', 'allowedSources']));
	});

	it('Logs model declares the pagination fields the log viewer reads', () => {
		const props = propNames(gateway, gateway.definitions.Logs);
		expect(props).toEqual(expect.arrayContaining(['logs', 'next_cursor', 'has_more', 'log_count']));
	});

	it('GET /logs declares the query params the UI sends', () => {
		const names = (gateway.paths['/logs'].get.parameters ?? []).map((p: any) => p.name);
		expect(names).toEqual(expect.arrayContaining(['lines', 'level', 'keyword', 'cursor']));
	});

	it('DELETE /config/endpoint/epipaddress/{ip} declares the identifying query params', () => {
		const names = (gateway.paths['/config/endpoint/epipaddress/{ip_address}'].delete.parameters ?? []).map((p: any) => p.name);
		expect(names).toEqual(expect.arrayContaining(['name', 'probe_type', 'probe_port']));
	});

	it('/sni/certificates GET keeps certificates/totalCertificates', () => {
		expect(propNames(gateway, successSchema(gateway, '/sni/certificates', 'get'))).toEqual(
			expect.arrayContaining(['certificates', 'totalCertificates']),
		);
	});

	it('/metrics stays a Prometheus text endpoint (GET declared)', () => {
		expect(gateway.paths['/metrics']?.get, 'gateway /metrics GET disappeared').toBeTruthy();
	});
});

describe('gateway spec hygiene', () => {
	it('every operation the UI must not call is still flagged x-not-implemented', () => {
		// If the gateway implements these later, this test reminds us to unflag
		// them and (optionally) build the UI — see docs/API_COVERAGE_REPORT.md.
		for (const p of Object.keys(gateway.paths).filter(p => p.startsWith('/metrics/'))) {
			expect(gateway.paths[p].get?.['x-not-implemented'], `${p} implemented? update flag + coverage report`).toBe(true);
		}
	});
});

//---------------------------------------------------------
// OAM: endpoints the UI reads structured data from
//---------------------------------------------------------
describe('oam spec contract', () => {
	it.each([
		['/oam/loxilbs', 'get'],
		['/oam/users/me', 'get'],
		['/oam/logs', 'get'],
		['/oam/setup/status', 'get'],
		['/oam/login', 'post'],
	] as [string, string][])('%s %s exists with a success schema', (p, m) => {
		expect(successSchema(oam, p, m)).toBeTruthy();
	});

	it('login response returns a token', () => {
		const props = propNames(oam, successSchema(oam, '/oam/login', 'post'));
		expect(props).toEqual(expect.arrayContaining(['token']));
	});
});
