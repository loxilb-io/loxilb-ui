import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import YAML from 'yaml';

// Backward-compat invariant between upstream loxilb and loxilb-inference-gateway:
// the gateway evolves /netlox/v1 as a strict additive superset of loxilb, so the
// same UI can drive both flavors. This test makes that relationship a CI gate —
// it recursively asserts loxilb-spec ⊆ gateway-spec across paths, methods,
// parameters, definitions, nested inline objects and enum value sets. A failure
// here means one of the vendored specs drifted in a way that breaks the shared
// surface (the exact class of break that let serviceArguments diverge silently),
// and the flavor capability map generated from these specs can no longer be
// trusted. Fix the backend spec (or consciously re-scope the shared surface)
// before merging the spec bump.

const root = path.resolve(__dirname, '../..');
const loxilb = YAML.parse(fs.readFileSync(path.join(root, 'api-spec/loxilb-swagger.yml'), 'utf8'));
const gateway = YAML.parse(fs.readFileSync(path.join(root, 'api-spec/gateway-swagger.yml'), 'utf8'));

function resolveRef(spec: any, node: any): any {
	if (node && node.$ref) {
		const parts = node.$ref.replace(/^#\//, '').split('/');
		return resolveRef(spec, parts.reduce((acc: any, k: string) => acc?.[k], spec));
	}
	return node;
}

// Recursively asserts that every structural element of a loxilb schema exists
// compatibly in the corresponding gateway schema. Descriptions/docs are ignored;
// what matters to a shared client is: properties present, types matching, enums
// a subset, arrays/items compatible. Collects human-readable problems instead of
// throwing so one run reports every divergence at once.
function assertSchemaSubset(lNode: any, gNode: any, ctx: string, problems: string[], seen: Set<string>): void {
	// cycle guard on $ref pairs (swagger 2.0 allows self-referencing definitions)
	if (lNode?.$ref || gNode?.$ref) {
		const key = `${lNode?.$ref ?? ''}=>${gNode?.$ref ?? ''}@${ctx.replace(/\[.*/, '')}`;
		if (seen.has(key)) return;
		seen.add(key);
	}
	const l = resolveRef(loxilb, lNode);
	const g = resolveRef(gateway, gNode);
	if (!l) return;
	if (!g) {
		problems.push(`${ctx}: present in loxilb but missing from gateway`);
		return;
	}
	if (l.type && g.type && l.type !== g.type) {
		problems.push(`${ctx}: type ${l.type} (loxilb) vs ${g.type} (gateway)`);
		return;
	}
	if (Array.isArray(l.enum)) {
		if (!Array.isArray(g.enum)) {
			// gateway widened an enum into a free-form field — additive, allowed
		} else {
			const missing = l.enum.filter((v: any) => !g.enum.includes(v));
			if (missing.length) {
				problems.push(`${ctx}: enum values ${JSON.stringify(missing)} accepted by loxilb but not by gateway`);
			}
		}
	}
	for (const [name, prop] of Object.entries(l.properties ?? {})) {
		const gProp = (g.properties ?? {})[name];
		if (!gProp) {
			problems.push(`${ctx}.${name}: property missing from gateway schema`);
			continue;
		}
		assertSchemaSubset(prop, gProp, `${ctx}.${name}`, problems, seen);
	}
	if (l.items) assertSchemaSubset(l.items, g.items, `${ctx}[]`, problems, seen);
}

describe('loxilb ⊆ gateway API subset contract', () => {
	it('agrees on the API base path', () => {
		expect(loxilb.basePath).toBe('/netlox/v1');
		expect(gateway.basePath).toBe('/netlox/v1');
	});

	it('every loxilb path+method exists on the gateway', () => {
		const problems: string[] = [];
		for (const [p, ops] of Object.entries<any>(loxilb.paths ?? {})) {
			const gOps = gateway.paths?.[p];
			if (!gOps) {
				problems.push(`path ${p} missing from gateway`);
				continue;
			}
			for (const method of Object.keys(ops)) {
				if (method === 'parameters') continue;
				if (!gOps[method]) problems.push(`${method.toUpperCase()} ${p} missing from gateway`);
			}
		}
		expect(problems, problems.join('\n')).toEqual([]);
	});

	it('every loxilb operation parameter exists compatibly on the gateway', () => {
		const problems: string[] = [];
		const seen = new Set<string>();
		for (const [p, ops] of Object.entries<any>(loxilb.paths ?? {})) {
			for (const [method, op] of Object.entries<any>(ops)) {
				if (method === 'parameters' || !gateway.paths?.[p]?.[method]) continue;
				const gParams: any[] = gateway.paths[p][method].parameters ?? [];
				for (const param of op.parameters ?? []) {
					const gParam = gParams.find(q => q.name === param.name && q.in === param.in);
					if (!gParam) {
						problems.push(`${method.toUpperCase()} ${p}: parameter ${param.in}:${param.name} missing from gateway`);
						continue;
					}
					if (param.in === 'body') {
						assertSchemaSubset(param.schema, gParam.schema, `${method.toUpperCase()} ${p} body`, problems, seen);
					} else if (param.type && gParam.type && param.type !== gParam.type) {
						problems.push(`${method.toUpperCase()} ${p}: parameter ${param.name} type ${param.type} vs ${gParam.type}`);
					}
				}
			}
		}
		expect(problems, problems.join('\n')).toEqual([]);
	});

	it('every shared definition is a recursive structural subset (incl. nested objects and enums)', () => {
		const problems: string[] = [];
		const seen = new Set<string>();
		for (const [name, def] of Object.entries<any>(loxilb.definitions ?? {})) {
			const gDef = gateway.definitions?.[name];
			if (!gDef) {
				problems.push(`definition ${name} missing from gateway`);
				continue;
			}
			assertSchemaSubset(def, gDef, name, problems, seen);
		}
		expect(problems, problems.join('\n')).toEqual([]);
	});

	// The three enum extensions that motivated flavor gating (§2a of the
	// backward-compat plan). Spelled out so a change to either side is caught
	// with an explicit, named failure — these are the values where "additive on
	// the gateway" means "hard 422 on loxilb", verified live 2026-08-13.
	it('documents the known gateway-extended enums as true supersets', () => {
		const lSa = resolveRef(loxilb, loxilb.definitions.LoadbalanceEntry).properties.serviceArguments.properties;
		const gSa = resolveRef(gateway, gateway.definitions.LoadbalanceEntry).properties.serviceArguments.properties;
		expect(lSa.sel.enum).toEqual([0, 1, 2, 3, 4, 5, 6]);
		expect(gSa.sel.enum).toEqual(expect.arrayContaining(lSa.sel.enum));
		expect(lSa.security.enum).toEqual([0, 1, 2]);
		expect(gSa.security.enum).toEqual(expect.arrayContaining(lSa.security.enum));
		const lProbe = resolveRef(loxilb, loxilb.definitions.EndPoint).properties.probeType.enum;
		const gProbe = resolveRef(gateway, gateway.definitions.EndPoint).properties.probeType.enum;
		expect(gProbe).toEqual(expect.arrayContaining(lProbe));
	});
});
