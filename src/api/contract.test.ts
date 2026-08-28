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
const gatewayExtras = YAML.parse(fs.readFileSync(path.join(root, 'api-spec/gateway-swagger-extras.yml'), 'utf8'));
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

	it('LoadbalanceEntry exposes the complete AI engine contract', () => {
		const serviceArguments = gateway.definitions.LoadbalanceEntry.properties.serviceArguments.properties;
		expect(serviceArguments.kvEngineType.enum).toEqual(['vllm', 'sglang', 'trtllm', 'llamacpp']);
		expect(serviceArguments.kvHashAlgo.enum).toEqual([
			'sha256_cbor',
			'xxhash_cbor',
			'sha256_sglang',
			'blockhash_trtllm',
		]);
		expect(serviceArguments.pdBootstrapPort).toEqual(
			expect.objectContaining({type: 'integer', minimum: 0, maximum: 65535}),
		);
		expect(serviceArguments.security.enum).toEqual([0, 1, 2]);
		expect(serviceArguments.api_key_auth.enum).toEqual(['disabled', 'required']);
		expect(serviceArguments.api_key_auth.default, 'omission must not materialize explicit disabled').toBeUndefined();
		expect(serviceArguments.api_key_auth.description).toContain('Omission is a first-class state');
	});

	it('API-key import and create response keep the secret-safe wire contract', () => {
		const imported = gateway.definitions.ApiKeyCreateRequest.properties.api_key;
		expect(imported).toEqual(expect.objectContaining({
			type: 'string',
			minLength: 16,
			maxLength: 512,
			pattern: '^[!-~]{16,512}$',
		}));
		const response = gateway.definitions.ApiKeyCreateResponse;
		expect(response.required).toContain('key_id');
		expect(response.required ?? []).not.toContain('raw_key');
		expect(response.properties.raw_key).toEqual(expect.objectContaining({type: 'string'}));
	});

	it('PolicyEntry exposes rule, port-ingress, and port-egress attachments', () => {
		const attachment = gateway.definitions.PolicyEntry.properties.targetObject.properties.attachment;
		expect(attachment.enum).toEqual([0, 1, 2]);
	});

	it('tenant rate limits expose per-model quotas on writes and reads', () => {
		for (const name of ['TenantRateLimitMod', 'TenantRateLimitEntry']) {
			const modelLimits = gateway.definitions[name].properties.model_limits;
			expect(modelLimits.type).toBe('array');
			expect(modelLimits.items.$ref).toBe('#/definitions/TenantModelRateLimit');
			expect(gateway.definitions[name].properties.burst_pct).toEqual(
				expect.objectContaining({type: 'integer', minimum: 0, maximum: 1000}),
			);
		}
		expect(propNames(gateway, gateway.definitions.TenantModelRateLimit)).toEqual(
			expect.arrayContaining(['model', 'tokens_per_min']),
		);
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

	it('all four tuple LB DELETE shapes carry model_name', () => {
		const paths = Object.entries<any>(gateway.paths)
			.filter(([p, item]) => p.startsWith('/config/loadbalancer/') && item.delete)
			.filter(([p]) => p.includes('/externalipaddress/') && !p.includes('/name/'));
		const keyed = paths.filter(([p]) => /\/protocol\/\{proto\}$/.test(p));
		expect(keyed).toHaveLength(4);
		for (const [p, item] of keyed) {
			const names = (item.delete.parameters ?? []).map((parameter: any) => parameter.name);
			expect(names, p).toContain('model_name');
		}
	});

	it('Gateway users use password-free summaries for list and create responses', () => {
		expect(propNames(gateway, gateway.definitions.UserSummary)).not.toContain('password');
		expect(gateway.paths['/auth/users'].get.responses['200'].schema.items.$ref).toBe('#/definitions/UserSummary');
		expect(gateway.paths['/auth/users'].post.responses['201'].schema.$ref).toBe('#/definitions/UserSummary');
	});

	it('/sni/certificates GET keeps certificates/totalCertificates', () => {
		expect(propNames(gateway, successSchema(gateway, '/sni/certificates', 'get'))).toEqual(
			expect.arrayContaining(['certificates', 'totalCertificates']),
		);
	});

	it('/metrics stays a Prometheus text endpoint (GET declared)', () => {
		expect(gateway.paths['/metrics']?.get, 'gateway /metrics GET disappeared').toBeTruthy();
		expect(gateway.paths['/metrics'].get.security).toEqual([]);
	});
});

describe('gateway management authentication response matrices', () => {
	it('every protected main operation declares 401, 403, and 503', () => {
		for (const [pathName, pathItem] of Object.entries<any>(gateway.paths)) {
			for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
				const operation = pathItem[method];
				if (!operation) continue;
				const security = operation.security === undefined ? gateway.security : operation.security;
				if (!Array.isArray(security) || security.length === 0) continue;
				expect(operation.responses, `${method.toUpperCase()} ${pathName}`).toEqual(
					expect.objectContaining({'401': expect.anything(), '403': expect.anything(), '503': expect.anything()}),
				);
			}
		}
		expect(gateway.paths['/config/ai/apikey'].post.responses['409']).toBeTruthy();
	});

	it('every raw extras operation declares bearer auth and 401/403/503', () => {
		expect(gatewayExtras.securityDefinitions.BearerAuth).toEqual(
			expect.objectContaining({type: 'apiKey', name: 'Authorization', in: 'header'}),
		);
		expect(gatewayExtras.security).toEqual([{BearerAuth: []}]);
		for (const [pathName, pathItem] of Object.entries<any>(gatewayExtras.paths)) {
			for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
				const operation = pathItem[method];
				if (!operation) continue;
				expect(operation.responses, `${method.toUpperCase()} ${pathName}`).toEqual(
					expect.objectContaining({'401': expect.anything(), '403': expect.anything(), '503': expect.anything()}),
				);
			}
		}
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
