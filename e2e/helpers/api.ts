//---------------------------------------------------------
// Direct OAM / gateway API access for the E2E suite: seeding,
// cleanup-verify and the per-spec leftover sweep. Reuses the
// token captured by auth.setup.ts (never logs in again — the
// OAM login endpoint is rate-limited).
//---------------------------------------------------------
import fs from 'fs';
import path from 'path';

// No default on purpose: the suite runs against a live OAM/gateway stack the
// operator owns, so the address must come from the environment
// (.env.e2e.local, loaded by playwright.config.ts) — never from the repo.
const envOamBase = process.env.E2E_OAM_URL;
if (!envOamBase) {
	throw new Error('E2E_OAM_URL is not set — point it at your OAM base (e.g. http://<oam-host>:8080/oam) in .env.e2e.local');
}
export const OAM_BASE = envOamBase;
const ADMIN_STATE = path.resolve(__dirname, '../../.auth/admin.json');

export interface Instance {
	id: number;
	name: string;
	host: string;
	port?: number;
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

// Methods that are safe to send again after a transport failure. A network
// exception means no response was ever received, so the request may or may not
// have been applied server-side — replaying a POST could create a second
// entity, which is exactly what the leak detector exists to catch. GET/PUT/
// DELETE are idempotent, so a replay converges either way.
const REPLAYABLE = new Set(['GET', 'HEAD', 'PUT', 'DELETE']);

// Node's fetch has NO default timeout, so a request that is accepted and then
// never answered hangs for as long as the OS keeps the socket. A sweep of ~10
// such calls in an afterEach hook blew straight past the 120s test timeout —
// the failure then looked like "cleanup is broken" rather than "one request
// was dropped". Bounding each attempt turns a hang into a fast retry.
const ATTEMPT_TIMEOUT_MS = 15_000;

/**
 * Every helper in this file goes through here, and every spec's beforeAll /
 * afterEach goes through those helpers. The link to the testbed drops
 * requests *after* the TCP connect (a connection is accepted and then never
 * answered), which surfaces in Node as a bare `TypeError: fetch failed` and
 * kills the spec — the same hazard auth.setup.ts already guards with
 * fetchWithRetry, and the reason a whole 257-test run died once.
 *
 * Only transport EXCEPTIONS are retried. An HTTP error status is a real
 * answer from the server and is returned untouched, so no assertion about
 * 4xx/5xx behaviour is ever masked.
 */
async function oamFetch(pathname: string, init: RequestInit = {}): Promise<Response> {
	const method = (init.method ?? 'GET').toUpperCase();
	const attempts = REPLAYABLE.has(method) ? 3 : 1;
	let lastErr: unknown;

	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await fetch(`${OAM_BASE}${pathname}`, {
				...init,
				signal: init.signal ?? AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
				headers: {
					Accept: 'application/json',
					Authorization: `Bearer ${adminToken()}`,
					'Content-Type': 'application/json',
					...(init.headers ?? {}),
				},
			});
		} catch (err) {
			lastErr = err;
			if (attempt < attempts) await new Promise(r => setTimeout(r, 500 * attempt));
		}
	}
	throw new Error(`${method} ${pathname} failed after ${attempts} attempt(s): ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

let cachedInstance: Instance | null = null;

/**
 * The single testbed instance every page operates on (?name=…).
 * Pinned by name via E2E_INSTANCE_NAME or E2E_INSTANCE — needed for two
 * reasons: the OAM's is_active instance can be a dead registration (its
 * gateway down) while another one is healthy, and the OAM may host more than
 * one flavor (a gateway and a plain loxilb) so a flavor-tagged run must not
 * land on the wrong backend. Without a pin, first active wins.
 */
export async function activeInstance(): Promise<Instance> {
	if (cachedInstance) return cachedInstance;
	const resp = await oamFetch('/loxilbs');
	if (!resp.ok) throw new Error(`GET /loxilbs failed: ${resp.status}`);
	const list = (await resp.json()) as Instance[];
	// E2E_INSTANCE_NAME is the flavor-matrix pin, E2E_INSTANCE the
	// single-instance override. Either one, once set, is authoritative: fall
	// back to is_active only when the run named nothing.
	const pinnedVar = process.env.E2E_INSTANCE_NAME ? 'E2E_INSTANCE_NAME' : 'E2E_INSTANCE';
	const pinned = process.env.E2E_INSTANCE_NAME ?? process.env.E2E_INSTANCE;
	const active = pinned ? list.find(i => i.name === pinned) : (list.find(i => i.is_active) ?? list[0]);
	if (!active) {
		throw new Error(
			pinned
				? `Instance "${pinned}" (${pinnedVar}) is not registered on the OAM — registered: ${list.map(i => i.name).join(', ') || '(none)'}`
				: 'No loxilb instance registered on the OAM',
		);
	}
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
		// isE2eMarked covers e2e- names + v4 documentation ranges; isDocAddr
		// additionally covers the v6 documentation range (2001:db8::/32) so the
		// ipmasquerade6 masquerade rule can never leak past the safety net.
		if (isE2eMarked(ra.sourceIP) || isE2eMarked(ra.destinationIP) || isDocAddr(ra.sourceIP) || isDocAddr(ra.destinationIP)) {
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

//---------------------------------------------------------
// OAM user accounts (Group 7). Throwaway test users use the
// `e2euser` username prefix so the sweep can find them without
// ever matching the persistent RBAC fixtures (e2e_operator /
// e2e_viewer) or the real admin.
//---------------------------------------------------------
export interface OamUser {
	id: number;
	username: string;
	email: string;
	role: string;
	created_at?: string;
}

export const TEST_USER_PREFIX = 'e2euser';

export async function listUsers(): Promise<OamUser[]> {
	const resp = await oamFetch('/users');
	if (!resp.ok) return [];
	return (await resp.json()) as OamUser[];
}

/** Seeds a user directly (for E/D targets that don't test the create flow). */
export async function createUserApi(u: {username: string; email: string; password: string; role: string}): Promise<number> {
	const resp = await oamFetch('/users', {method: 'POST', body: JSON.stringify(u)});
	if (!resp.ok) throw new Error(`createUserApi ${u.username}: ${resp.status} ${await resp.text()}`);
	const d = (await resp.json()) as {id: number};
	return d.id;
}

export async function deleteUserById(id: number): Promise<boolean> {
	const resp = await oamFetch(`/users/${id}`, {method: 'DELETE'});
	return resp.ok;
}

/** The logged-in admin account (id/username/email) via /users/me. */
export async function getMe(): Promise<OamUser> {
	const resp = await oamFetch('/users/me');
	if (!resp.ok) throw new Error(`getMe: ${resp.status}`);
	return (await resp.json()) as OamUser;
}

/** Direct user update (used by profile.spec to restore the admin email). */
export async function updateUserApi(id: number, body: Record<string, unknown>): Promise<void> {
	const resp = await oamFetch(`/users/${id}`, {method: 'PUT', body: JSON.stringify(body)});
	if (!resp.ok) throw new Error(`updateUserApi ${id}: ${resp.status} ${await resp.text()}`);
}

/** Deletes every throwaway test user (username starting with `e2euser`). */
export async function sweepTestUsers(): Promise<number> {
	let removed = 0;
	for (const u of await listUsers()) {
		if (u.username?.startsWith(TEST_USER_PREFIX)) {
			if (await deleteUserById(u.id)) removed++;
		}
	}
	return removed;
}

//---------------------------------------------------------
// Instance registrations (OAM /loxilbs)
//---------------------------------------------------------

/** Full instance rows, including the fields activeInstance() drops. */
export interface InstanceRecord extends Instance {
	protocol: string;
	version: string;
	cimage: string;
	ctag: string;
	description?: string;
	api_endpoint: string;
}

export async function listInstances(): Promise<InstanceRecord[]> {
	const resp = await oamFetch('/loxilbs');
	if (!resp.ok) throw new Error(`GET /loxilbs failed: ${resp.status}`);
	return (await resp.json()) as InstanceRecord[];
}

export async function findInstanceByName(name: string): Promise<InstanceRecord | undefined> {
	return (await listInstances()).find(i => i.name === name);
}

/** Raw create, for seeding a conflict the UI is then expected to refuse. */
export async function createInstanceApi(body: Record<string, unknown>): Promise<Response> {
	return oamFetch('/loxilbs', {method: 'POST', body: JSON.stringify(body)});
}

export async function deleteInstanceApi(id: number): Promise<boolean> {
	const resp = await oamFetch(`/loxilbs/${id}`, {method: 'DELETE'});
	return resp.ok;
}

/**
 * Deletes every throwaway instance registration. Marked entities only:
 * an e2e- name or a documentation-range host — the real testbed instance
 * (which every other spec depends on) is never touched.
 */
export async function sweepInstances(): Promise<number> {
	let removed = 0;
	for (const inst of await listInstances().catch(() => [])) {
		if (isE2eMarked(inst.name) || isDocAddr(inst.host)) {
			if (await deleteInstanceApi(inst.id)) removed++;
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

//---------------------------------------------------------
// OAM instance snapshots (docs/SNAPSHOT_UI_DESIGN.md §9.3).
//---------------------------------------------------------
export interface SnapshotMeta {
	id: string;
	name: string;
	description?: string;
	trigger_type?: string;
	pinned?: boolean;
	checksum?: string;
	checksum_ok?: boolean;
	gateway_version?: string;
	last_restore_result?: string;
}

export async function listSnapshots(): Promise<SnapshotMeta[]> {
	const inst = await activeInstance();
	const resp = await oamFetch(`/instances/${inst.id}/snapshots?limit=100`);
	if (!resp.ok) return [];
	const body = await resp.json();
	return (body.data ?? []) as SnapshotMeta[];
}

export async function deleteSnapshotById(sid: string, force = false): Promise<boolean> {
	const resp = await oamFetch(`/snapshots/${sid}${force ? '?force=true' : ''}`, {method: 'DELETE'});
	return resp.ok;
}

/** Raw download (with headers) — the spec checks X-Snapshot-Checksum. */
export async function downloadSnapshot(sid: string): Promise<Response> {
	return oamFetch(`/snapshots/${sid}/download`);
}

export async function disableSnapshotSchedule(): Promise<void> {
	const inst = await activeInstance();
	await oamFetch(`/instances/${inst.id}/snapshot-schedule`, {
		method: 'PUT',
		body: JSON.stringify({enabled: false, interval_hours: 24, retain_count: 10}),
	});
}

/** Deletes every e2e-marked snapshot (force covers pinned leftovers), plus
 * the side-products spec runs create with non-e2e names: `pre_restore`
 * safety rows referencing an e2e- snapshot, and the UI Pre-Upgrade button's
 * rows (identified by its fixed description — testbed-only heuristic). */
export async function sweepSnapshots(): Promise<number> {
	let removed = 0;
	for (const s of await listSnapshots()) {
		const specMade =
			isE2eMarked(s.name) ||
			(s.trigger_type === 'pre_restore' && isE2eMarked(s.description?.match(/restoring "([^"]+)"/)?.[1])) ||
			(s.trigger_type === 'pre_upgrade' && s.description === 'Automatic pre-upgrade safety snapshot');
		if (specMade) {
			if (await deleteSnapshotById(s.id, true)) removed++;
		}
	}
	return removed;
}
