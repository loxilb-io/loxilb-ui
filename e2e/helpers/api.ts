//---------------------------------------------------------
// Direct OAM / gateway API access for the E2E suite: seeding,
// cleanup-verify and the per-spec leftover sweep. Reuses the
// token captured by auth.setup.ts (never logs in again — the
// OAM login endpoint is rate-limited).
//---------------------------------------------------------
import fs from 'fs';
import path from 'path';

export const OAM_BASE = process.env.E2E_OAM_URL ?? 'http://203.0.113.99:8080/oam';
const ADMIN_STATE = path.resolve(__dirname, '../../.auth/admin.json');

export interface Instance {
	id: number;
	name: string;
	host: string;
	is_active: boolean;
}

export function adminToken(): string {
	const state = JSON.parse(fs.readFileSync(ADMIN_STATE, 'utf-8'));
	for (const origin of state.origins ?? []) {
		for (const entry of origin.localStorage ?? []) {
			if (entry.name === 'access_token' && entry.value) return entry.value;
		}
	}
	throw new Error(`No access_token in ${ADMIN_STATE} — did the setup project run?`);
}

async function oamFetch(pathname: string, init: RequestInit = {}): Promise<Response> {
	return fetch(`${OAM_BASE}${pathname}`, {
		...init,
		headers: {
			Accept: 'application/json',
			Authorization: `Bearer ${adminToken()}`,
			'Content-Type': 'application/json',
			...(init.headers ?? {}),
		},
	});
}

let cachedInstance: Instance | null = null;

/** The single active testbed instance every page operates on (?name=…). */
export async function activeInstance(): Promise<Instance> {
	if (cachedInstance) return cachedInstance;
	const resp = await oamFetch('/loxilbs');
	if (!resp.ok) throw new Error(`GET /loxilbs failed: ${resp.status}`);
	const list = (await resp.json()) as Instance[];
	const active = list.find(i => i.is_active) ?? list[0];
	if (!active) throw new Error('No loxilb instance registered on the OAM');
	cachedInstance = active;
	return active;
}

/** Raw gateway call through the OAM proxy (…/loxilbs/{id}/netlox/v1{path}). */
export async function gw(method: string, apiPath: string, body?: unknown): Promise<Response> {
	const inst = await activeInstance();
	return oamFetch(`/loxilbs/${inst.id}/netlox/v1${apiPath}`, {
		method,
		...(body !== undefined ? {body: JSON.stringify(body)} : {}),
	});
}

export async function gwJson<T = any>(apiPath: string): Promise<T> {
	const resp = await gw('GET', apiPath);
	if (!resp.ok) throw new Error(`GET ${apiPath} failed: ${resp.status}`);
	return (await resp.json()) as T;
}

//---------------------------------------------------------
// Entity markers — every test entity is identifiable so the
// safety-net sweep can never touch real config.
//---------------------------------------------------------
export const E2E_PREFIX = 'e2e-';
/** Reserved documentation ranges (RFC 5737) — inert on the testbed. */
export const DOC_IP = /^(203\.0\.113\.|198\.51\.100\.)/;
/** Reserved IPv6 documentation range (RFC 3849) — inert on the testbed. */
export const DOC_IP6 = /^2001:db8:/i;

export function isE2eMarked(value: string | undefined | null): boolean {
	if (!value) return false;
	return value.startsWith(E2E_PREFIX) || DOC_IP.test(value);
}

/** True for any documentation-range address (v4 or v6), with or without a CIDR mask. */
export function isDocAddr(value: string | undefined | null): boolean {
	if (!value) return false;
	return DOC_IP.test(value) || DOC_IP6.test(value);
}

//---------------------------------------------------------
// Per-resource safety-net sweeps
//---------------------------------------------------------

export function firewallDeleteQuery(ra: Record<string, unknown>): string {
	const params = new URLSearchParams();
	for (const key of ['sourceIP', 'destinationIP', 'minSourcePort', 'maxSourcePort', 'minDestinationPort', 'maxDestinationPort', 'protocol', 'portName', 'preference']) {
		const v = ra[key];
		if (v !== undefined && v !== null && v !== '') params.append(key, String(v));
	}
	return params.toString();
}

/**
 * Deletes every firewall rule whose source/dest sits in a documentation
 * range. Also covers the allow-rules the gateway auto-creates for dnat LB
 * VIPs (they carry the documentation-IP VIP as destination).
 * NOTE: rules created WITH port ranges are undeletable — known gateway bug
 * (every DELETE 404s "no-rule error"); those survive the sweep inert.
 */
export async function sweepFirewallRules(): Promise<number> {
	const resp = await gw('GET', '/config/firewall/all');
	if (!resp.ok) return 0;
	const data = await resp.json();
	let removed = 0;
	for (const rule of data.fwAttr ?? []) {
		const ra = rule.ruleArguments ?? {};
		if (isE2eMarked(ra.sourceIP) || isE2eMarked(ra.destinationIP)) {
			const del = await gw('DELETE', `/config/firewall?${firewallDeleteQuery(ra)}`);
			if (del.ok) removed++;
		}
	}
	return removed;
}

/**
 * Deletes every endpoint with an e2e- name or documentation-range host.
 * DELETE /config/endpoint/epipaddress/{host}?name=&probe_type=&probe_port=
 * (the same identifying tuple the UI delete uses).
 */
export async function sweepEndpoints(): Promise<number> {
	const resp = await gw('GET', '/config/endpoint/all');
	if (!resp.ok) return 0;
	const data = await resp.json();
	let removed = 0;
	for (const ep of data.Attr ?? []) {
		if (isE2eMarked(ep.name) || isE2eMarked(ep.hostName)) {
			const q = new URLSearchParams();
			if (ep.name) q.append('name', ep.name);
			if (ep.probeType) q.append('probe_type', ep.probeType);
			if (ep.probePort) q.append('probe_port', String(ep.probePort));
			const qs = q.toString();
			const del = await gw('DELETE', `/config/endpoint/epipaddress/${ep.hostName}${qs ? `?${qs}` : ''}`);
			if (del.ok) removed++;
		}
	}
	return removed;
}

/** Unregisters every SNI certificate whose hostname is e2e- marked. */
export async function sweepSniCerts(): Promise<number> {
	const resp = await gw('GET', '/sni/certificates');
	if (!resp.ok) return 0;
	const data = await resp.json();
	let removed = 0;
	// The gateway list key has been observed as both `certificates` and
	// `sniAttr` (and may be null); tolerate all shapes.
	for (const c of data.certificates ?? data.sniAttr ?? []) {
		if (isE2eMarked(c.hostname)) {
			const del = await gw('DELETE', '/sni/certificates', {hostname: c.hostname});
			if (del.ok) removed++;
		}
	}
	return removed;
}

/** Deletes every mirror with an e2e- ident. */
export async function sweepMirrors(): Promise<number> {
	const resp = await gw('GET', '/config/mirror/all');
	if (!resp.ok) return 0;
	const data = await resp.json();
	let removed = 0;
	for (const m of data.mirrAttr ?? []) {
		if (isE2eMarked(m.mirrorIdent)) {
			const del = await gw('DELETE', `/config/mirror/ident/${encodeURIComponent(m.mirrorIdent)}`);
			if (del.ok) removed++;
		}
	}
	return removed;
}

/** Live port names on the active instance (for mirror/QoS attachment). */
export async function portNames(): Promise<string[]> {
	const resp = await gw('GET', '/config/port/all');
	if (!resp.ok) return [];
	const data = await resp.json();
	const attr = data.portAttr ?? data.Attr ?? [];
	return attr.map((p: any) => p.portName).filter(Boolean);
}

/** Deletes every QoS policy with an e2e- ident. */
export async function sweepQosPolicies(): Promise<number> {
	const resp = await gw('GET', '/config/policy/all');
	if (!resp.ok) return 0;
	const data = await resp.json();
	let removed = 0;
	for (const pol of data.polAttr ?? []) {
		if (isE2eMarked(pol.policyIdent)) {
			const del = await gw('DELETE', `/config/policy/ident/${encodeURIComponent(pol.policyIdent)}`);
			if (del.ok) removed++;
		}
	}
	return removed;
}

/**
 * Deletes every IP-filter rule whose CIDR sits in a documentation range.
 * DELETE /config/ipfilter?filterType=&cidr=&zone= (the UI delete tuple).
 * Safety: only documentation-range CIDRs are ever touched — real filter
 * rules (0.0.0.0/0, mgmt ranges) can never match DOC_IP.
 */
export async function sweepIpFilterRules(): Promise<number> {
	const resp = await gw('GET', '/config/ipfilter/all');
	if (!resp.ok) return 0;
	const data = await resp.json();
	let removed = 0;
	for (const rule of data.ipFilterAttr ?? []) {
		if (isE2eMarked(rule.cidr)) {
			const q = new URLSearchParams({filterType: rule.filterType, cidr: rule.cidr});
			if (rule.zone !== undefined && rule.zone !== null) q.append('zone', String(rule.zone));
			const del = await gw('DELETE', `/config/ipfilter?${q.toString()}`);
			if (del.ok) removed++;
		}
	}
	return removed;
}

/**
 * Deletes every documentation-range address on the given family.
 * DELETE /config/ip{v4,v6}address/{ip}/{mask}/dev/{dev}. Only doc-range
 * addresses are ever matched, so real interface IPs are never touched.
 */
export async function sweepIpAddresses(family: 'ipv4' | 'ipv6'): Promise<number> {
	const seg = family === 'ipv6' ? 'ipv6address' : 'ipv4address';
	const resp = await gw('GET', `/config/${seg}/all`);
	if (!resp.ok) return 0;
	const data = await resp.json();
	let removed = 0;
	for (const attr of data.ipAttr ?? []) {
		for (const cidr of attr.ipAddress ?? []) {
			if (!isDocAddr(cidr)) continue;
			const [ip, mask] = cidr.split('/');
			const del = await gw('DELETE', `/config/${seg}/${encodeURIComponent(ip)}/${mask}/dev/${attr.dev}`);
			if (del.ok) removed++;
		}
	}
	return removed;
}

/** Reserved high VLAN/VXLAN IDs the network specs use — never real config.
 * (3999 is intentionally avoided — it got wedged during bring-up.) */
export const TEST_VLAN_IDS = [3990, 3991, 3992];
export const TEST_VXLAN_IDS = [3999, 3998];

/**
 * Deletes every reserved-test VLAN. A VLAN with members is undeletable, and
 * the gateway lists a tagged member as "<dev>.<vid>" but only deletes it by
 * the base dev — so strip the suffix and remove members first, or the VLAN
 * wedges (404s forever).
 */
export async function sweepVlans(): Promise<number> {
	const resp = await gw('GET', '/config/vlan/all');
	if (!resp.ok) return 0;
	const data = await resp.json();
	let removed = 0;
	for (const v of data.vlanAttr ?? []) {
		if (!TEST_VLAN_IDS.includes(v.vid)) continue;
		for (const m of v.member ?? []) {
			const baseDev = typeof m.dev === 'string' && m.dev.endsWith(`.${v.vid}`) ? m.dev.slice(0, m.dev.length - `.${v.vid}`.length) : m.dev;
			await gw('DELETE', `/config/vlan/${v.vid}/member/${baseDev}/tagged/${m.tagged}`);
		}
		const del = await gw('DELETE', `/config/vlan/${v.vid}`);
		if (del.ok) removed++;
	}
	return removed;
}

/** Deletes every VXLAN whose id is a reserved test id. */
export async function sweepVxlans(): Promise<number> {
	const resp = await gw('GET', '/config/tunnel/vxlan/all');
	if (!resp.ok) return 0;
	const data = await resp.json();
	let removed = 0;
	for (const v of data.vxlanAttr ?? []) {
		if (!TEST_VXLAN_IDS.includes(v.vxlanID)) continue;
		const del = await gw('DELETE', `/config/tunnel/vxlan/${v.vxlanID}`);
		if (del.ok) removed++;
	}
	return removed;
}

/** Deletes every route whose destination sits in a documentation range. */
export async function sweepRoutes(): Promise<number> {
	const resp = await gw('GET', '/config/route/all');
	if (!resp.ok) return 0;
	const data = await resp.json();
	let removed = 0;
	for (const r of data.routeAttr ?? []) {
		if (!isDocAddr(r.destinationIPNet)) continue;
		const [ip, mask] = r.destinationIPNet.split('/');
		const del = await gw('DELETE', `/config/route/destinationIPNet/${encodeURIComponent(ip)}/${mask}`);
		if (del.ok) removed++;
	}
	return removed;
}

/** Deletes every neighbor whose IP sits in a documentation range. */
export async function sweepNeighbors(): Promise<number> {
	const resp = await gw('GET', '/config/neighbor/all');
	if (!resp.ok) return 0;
	const data = await resp.json();
	let removed = 0;
	for (const n of data.neighborAttr ?? []) {
		if (!isDocAddr(n.ipAddress)) continue;
		const del = await gw('DELETE', `/config/neighbor/${encodeURIComponent(n.ipAddress)}/dev/${n.dev}`);
		if (del.ok) removed++;
	}
	return removed;
}

/**
 * Deletes every IPsec tunnel with an e2e- name or a documentation-range peer.
 * DELETE /config/ipsec/tunnels/{name}. Only e2e-/doc-marked tunnels match, so
 * a real production tunnel can never be swept.
 */
export async function sweepIpsecTunnels(): Promise<number> {
	const resp = await gw('GET', '/config/ipsec/tunnels/all');
	if (!resp.ok) return 0;
	const data = await resp.json();
	let removed = 0;
	for (const t of data.ipsecTunnelAttr ?? []) {
		if (isE2eMarked(t.name) || isDocAddr(t.remoteIp)) {
			const del = await gw('DELETE', `/config/ipsec/tunnels/${encodeURIComponent(t.name)}`);
			if (del.ok) removed++;
		}
	}
	return removed;
}

/** Deletes every e2e- named IPsec endpoint + CA certificate. */
export async function sweepIpsecCerts(): Promise<number> {
	let removed = 0;
	const ep = await gw('GET', '/config/ipsec/certificates/all');
	if (ep.ok) {
		for (const c of (await ep.json()).ipsecCertificateAttr ?? []) {
			if (isE2eMarked(c.name)) {
				const del = await gw('DELETE', `/config/ipsec/certificates/${encodeURIComponent(c.name)}`);
				if (del.ok) removed++;
			}
		}
	}
	const ca = await gw('GET', '/config/ipsec/ca-certificates/all');
	if (ca.ok) {
		for (const c of (await ca.json()).ipsecCACertificateAttr ?? []) {
			if (isE2eMarked(c.name)) {
				const del = await gw('DELETE', `/config/ipsec/ca-certificates/${encodeURIComponent(c.name)}`);
				if (del.ok) removed++;
			}
		}
	}
	return removed;
}

/**
 * True when the gateway is built WITHOUT --userservice, so every /config/ai/*
 * endpoint answers 501. The AI CRUD specs probe this once and skip their
 * mutation cases; the render + client-validation cases always run.
 */
export async function gatewayLacksUserservice(): Promise<boolean> {
	const resp = await gw('GET', '/config/ai/apikey');
	return resp.status === 501;
}

/** Deletes every AI API key owned by an e2e- tenant (no-op while AI 501s). */
export async function sweepApiKeys(): Promise<number> {
	const resp = await gw('GET', '/config/ai/apikey');
	if (!resp.ok) return 0;
	const data = await resp.json();
	if (!Array.isArray(data)) return 0; // 402/501 error body, not a list
	let removed = 0;
	for (const k of data) {
		if ((isE2eMarked(k.tenant_id) || isE2eMarked(k.name)) && k.key_id) {
			const del = await gw('DELETE', `/config/ai/apikey/${encodeURIComponent(k.key_id)}`);
			if (del.ok) removed++;
		}
	}
	return removed;
}

/** Deletes every LB rule with an e2e- name or documentation-range VIP. */
export async function sweepLbRules(): Promise<number> {
	const resp = await gw('GET', '/config/loadbalancer/all');
	if (!resp.ok) return 0;
	const data = await resp.json();
	let removed = 0;
	for (const rule of data.lbAttr ?? []) {
		const sa = rule.serviceArguments ?? {};
		if (isE2eMarked(sa.name) || isE2eMarked(sa.externalIP)) {
			// Name-delete works for every mode; the tuple endpoints 404 on
			// fullproxy/L7 (mode 4) rules.
			const path = sa.name
				? `/config/loadbalancer/name/${encodeURIComponent(sa.name)}`
				: sa.portMax && sa.portMax > sa.port
				? `/config/loadbalancer/externalipaddress/${sa.externalIP}/port/${sa.port}/portmax/${sa.portMax}/protocol/${sa.protocol}`
				: `/config/loadbalancer/externalipaddress/${sa.externalIP}/port/${sa.port}/protocol/${sa.protocol}`;
			const del = await gw('DELETE', path);
			if (del.ok) removed++;
		}
	}
	return removed;
}
