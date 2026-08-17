//---------------------------------------------------------
// Spec-driven backward-compatibility guard for plain upstream
// loxilb (loxilb-oss).
//
// The gateway is a strict additive superset of loxilb on the same
// /netlox/v1 base, so "does the UI stay within loxilb's API" is a
// question the two swagger files already answer. `npm run gen:api`
// diffs them into src/api/gen/loxilb-capability-map.json; this helper
// replays that map against the requests the browser actually sends.
//
// Why request interception rather than response assertions: the two
// failure classes look completely different from the outside.
//
//   - enum values / paths / methods loxilb lacks -> 422, 404, 405.
//     Visible, but only if a spec happens to exercise that control.
//   - gateway-only BODY FIELDS -> accepted with 200 and silently
//     dropped (go-swagger's default for unknown properties, verified
//     live: POST with model_name/path_prefix returns {"result":
//     "Success"} and the fields are absent on read-back). NOTHING in
//     the response says the config did not take effect.
//
// The second class is the dangerous one — an operator configures AI
// routing or mTLS on a loxilb box, gets a green Success popup, and
// nothing happens. It is only catchable on the request side, which is
// what this guard watches.
//
// Read-side leniency is deliberate: unknown QUERY params are ignored by
// go-swagger too (loxilb answers `/logs?cursor=…` with 200 and no
// cursor in the body), so those are reported as 'param' violations —
// degraded pagination, not a hard break — and kept distinguishable from
// the write-side classes by `kind`.
//---------------------------------------------------------
import {Page, Request} from '@playwright/test';
import fs from 'fs';
import path from 'path';
import {activeInstance} from './api';

//---------------------------------------------------------
// The generated capability map (single source of truth)
//---------------------------------------------------------
// Read from disk rather than imported: the E2E project has no tsconfig of
// its own and is transpiled per-file by Playwright, so a JSON import would
// depend on the transform's module interop. fs is unambiguous, and it keeps
// the map a runtime input — regenerating it (npm run gen:api) changes what
// these specs assert without touching a line of test code.
const MAP_PATH = path.resolve(__dirname, '../../src/api/gen/loxilb-capability-map.json');

interface CapabilityMap {
	gatewayOnlyPaths: string[];
	gatewayOnlyMethods: Record<string, string[]>;
	gatewayOnlyParams: Record<string, string[]>;
	gatewayOnlyFields: Record<string, string[]>;
	gatewayOnlyEnumValues: Record<string, (string | number)[]>;
}

export function capabilityMap(): CapabilityMap {
	return JSON.parse(fs.readFileSync(MAP_PATH, 'utf-8')) as CapabilityMap;
}

//---------------------------------------------------------
// Swagger path templates -> matchers
//---------------------------------------------------------
/** '/config/ai/apikey/{key_id}' -> /^\/config\/ai\/apikey\/[^/]+$/ */
function templateToRegExp(template: string): RegExp {
	const escaped = template
		.split('/')
		.map(seg => (seg.startsWith('{') && seg.endsWith('}') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
		.join('/');
	return new RegExp(`^${escaped}$`);
}

//---------------------------------------------------------
// Request body -> schema context
//---------------------------------------------------------
// Maps an instance API path to the capability-map schema contexts its write
// body carries. Only write-side models appear here: ConntrackEntry, Logs and
// FirewallRuleEntry exist in the map as READ shapes (the UI never sends them),
// and a field the backend returns is the backend's business, not ours.
//
// Each entry yields (context, object) pairs to check. `select` walks the body
// to the sub-object the context describes.
interface BodyContext {
	context: string;
	select: (body: any) => unknown[];
}

const BODY_CONTEXTS: Array<{match: RegExp; contexts: BodyContext[]}> = [
	{
		match: /^\/config\/loadbalancer(\/|$)/,
		contexts: [
			{context: 'LoadbalanceEntry', select: b => [omit(b, ['serviceArguments', 'endpoints'])]},
			{context: 'LoadbalanceEntry.serviceArguments', select: b => [b?.serviceArguments]},
			{context: 'LoadbalanceEntry.endpoints[]', select: b => (Array.isArray(b?.endpoints) ? b.endpoints : [])},
		],
	},
	{
		match: /^\/config\/endpoint(\/|$)/,
		contexts: [{context: 'EndPoint', select: b => [b]}],
	},
	{
		match: /^\/config\/firewall(\/|$)/,
		contexts: [{context: 'FirewallEntry.ruleArguments', select: b => [b?.ruleArguments]}],
	},
];

/** Shallow copy minus the keys that are checked under their own context. */
function omit(obj: any, keys: string[]): unknown {
	if (!obj || typeof obj !== 'object') return obj;
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(obj)) if (!keys.includes(k)) out[k] = v;
	return out;
}

//---------------------------------------------------------
// Enum sites the UI can send
//---------------------------------------------------------
// context -> how to pull the sent value(s) out of a request body on `match`.
const ENUM_SITES: Array<{match: RegExp; context: string; select: (body: any) => unknown[]}> = [
	{match: /^\/config\/loadbalancer(\/|$)/, context: 'LoadbalanceEntry.serviceArguments.sel', select: b => [b?.serviceArguments?.sel]},
	{match: /^\/config\/loadbalancer(\/|$)/, context: 'LoadbalanceEntry.serviceArguments.security', select: b => [b?.serviceArguments?.security]},
	{match: /^\/config\/endpoint(\/|$)/, context: 'EndPoint.probeType', select: b => [b?.probeType]},
];

//---------------------------------------------------------
// Guard
//---------------------------------------------------------
export type ViolationKind = 'path' | 'method' | 'field' | 'enum' | 'param';

export interface Violation {
	/** 'path'/'method'/'enum' break hard on loxilb (404/405/422); 'field' is
	 * silently dropped; 'param' is silently ignored (degraded, not broken). */
	kind: ViolationKind;
	/** Human-readable, and the string `allow()` patterns are tested against. */
	detail: string;
	method: string;
	/** Instance-relative API path (the OAM proxy prefix stripped). */
	apiPath: string;
}

export interface ContractGuard {
	/** Everything recorded since attach (or the last reset). */
	violations(): Violation[];
	/** Violations whose `detail` no allow() pattern matches — what specs assert on. */
	unexpected(): Violation[];
	/** Waive a known, accepted gap. Always comment WHY at the call site. */
	allow(pattern: RegExp): void;
	/** Drops everything recorded so far. Call once the flavor has resolved:
	 * gating is permissive while the /version probe is in flight, so a page
	 * mounted before it lands may legitimately fire a gateway-only read. */
	reset(): void;
	/** Every instance API request seen, for coverage assertions. */
	seen(): Array<{method: string; apiPath: string}>;
}

/**
 * Watches every request the page sends to the active instance through the OAM
 * proxy and records anything upstream loxilb's swagger does not declare.
 *
 * Attach before the first navigation — Playwright delivers 'request' events
 * only for requests started after the listener is installed.
 */
export async function attachContractGuard(page: Page): Promise<ContractGuard> {
	const map = capabilityMap();
	const inst = await activeInstance();
	// Requests reach the backend as {oam}/loxilbs/{id}/netlox/v1{apiPath}.
	const proxyPrefix = `/loxilbs/${inst.id}/netlox/v1`;

	const gatewayOnlyPaths = map.gatewayOnlyPaths.map(t => ({template: t, re: templateToRegExp(t)}));
	const gatewayOnlyMethods = Object.entries(map.gatewayOnlyMethods).map(([t, methods]) => ({template: t, re: templateToRegExp(t), methods}));
	const gatewayOnlyParams = Object.entries(map.gatewayOnlyParams).map(([key, params]) => {
		const [method, template] = key.split(' ');
		return {method: method.toUpperCase(), template, re: templateToRegExp(template), params: params.map(p => p.replace(/^query:/, ''))};
	});

	const violations: Violation[] = [];
	const allowed: RegExp[] = [];
	const requests: Array<{method: string; apiPath: string}> = [];

	const listener = (req: Request) => {
		let url: URL;
		try {
			url = new URL(req.url());
		} catch {
			return;
		}
		const idx = url.pathname.indexOf(proxyPrefix);
		if (idx === -1) return; // not an instance API call (OAM's own routes, assets, …)
		const apiPath = url.pathname.slice(idx + proxyPrefix.length) || '/';
		const method = req.method().toUpperCase();
		requests.push({method, apiPath});

		const record = (kind: ViolationKind, detail: string) => violations.push({kind, detail, method, apiPath});

		// 1. Whole endpoint families the gateway added (404 upstream).
		for (const {template, re} of gatewayOnlyPaths) {
			if (re.test(apiPath)) record('path', `gateway-only path ${template}`);
		}

		// 2. Methods the gateway added to a shared path (405 upstream) — e.g.
		//    GET/PATCH on the per-VIP LB path, which the UI must replace with a
		//    full-body POST upsert on loxilb.
		for (const {template, re, methods} of gatewayOnlyMethods) {
			if (re.test(apiPath) && methods.includes(method.toLowerCase())) record('method', `gateway-only method ${method} ${template}`);
		}

		// 3. Query params only the gateway declares (ignored upstream).
		for (const p of gatewayOnlyParams) {
			if (p.method !== method || !p.re.test(apiPath)) continue;
			for (const name of p.params) {
				if (url.searchParams.has(name)) record('param', `gateway-only query param ?${name} on ${method} ${p.template}`);
			}
		}

		// 4/5. Body-borne fields and enum values. postData() is synchronous and
		//      returns the raw string; a non-JSON body (multipart config import)
		//      simply fails to parse and is skipped.
		const raw = req.postData();
		if (!raw) return;
		let body: any;
		try {
			body = JSON.parse(raw);
		} catch {
			return;
		}

		for (const {match, contexts} of BODY_CONTEXTS) {
			if (!match.test(apiPath)) continue;
			for (const {context, select} of contexts) {
				const gatewayOnly = map.gatewayOnlyFields[context] ?? [];
				if (!gatewayOnly.length) continue;
				for (const target of select(body)) {
					if (!target || typeof target !== 'object') continue;
					for (const field of Object.keys(target)) {
						if (gatewayOnly.includes(field)) record('field', `gateway-only field ${context}.${field} (silently dropped upstream)`);
					}
				}
			}
		}

		for (const {match, context, select} of ENUM_SITES) {
			if (!match.test(apiPath)) continue;
			const gatewayOnly = map.gatewayOnlyEnumValues[context] ?? [];
			if (!gatewayOnly.length) continue;
			for (const value of select(body)) {
				if (value === undefined || value === null) continue;
				if (gatewayOnly.includes(value as string | number)) record('enum', `gateway-only enum value ${context}=${String(value)} (422 upstream)`);
			}
		}
	};

	page.on('request', listener);

	return {
		violations: () => [...violations],
		unexpected: () => violations.filter(v => !allowed.some(p => p.test(v.detail))),
		allow: p => allowed.push(p),
		reset: () => {
			violations.length = 0;
			requests.length = 0;
		},
		seen: () => [...requests],
	};
}

/** Renders violations one per line for an assertion message. */
export function formatViolations(list: Violation[]): string {
	if (!list.length) return '(none)';
	return list.map(v => `  [${v.kind}] ${v.method} ${v.apiPath} — ${v.detail}`).join('\n');
}
