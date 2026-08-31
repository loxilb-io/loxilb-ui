// UI-P6-1 batch 5 (remainder families) — the same false-success class
// pinned once per family before the sweep migration:
//
//  D11 Every family below except vxlan accepts HTTP 200 + {result:"fail"}
//      as success (vxlan alone adopted isMutationFailure; sni_certificates'
//      sniSoftError only matches results starting with 'Error', so the
//      plain 'fail' envelope slips through there too).
//  D12 qos create's client-side validation returns raw English strings.
//
// The vxlan row is a keep-green guard for the rename (its legacy check was
// already correct; the OpResult status name is the only change).
import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import {IInstance} from 'types/oam';
import {request_delete_bfd} from './bfd';
import {request_delete_bgp_neighbor} from './bgp';
import {request_delete_cert_pem} from './cert';
import {request_delete_device_neighbor} from './device_neghbors';
import {request_delete_fdb} from './fdb';
import {request_create_firewall_rule} from './firewall';
import {request_delete_ipv4} from './ip';
import {request_delete_ipfilter_rule} from './ipfilter';
import {request_delete_ipsec_tunnel} from './ipsec';
import {request_delete_mirror_by_ident} from './mirror';
import {request_create_qos_policy, request_delete_qos_policy} from './qos';
import {request_delete_route} from './route_attr';
import {request_reset_securityrate_stats} from './securityrate';
import {request_unregister_sni_certificate} from './sni_certificates';
import {request_post_log_level} from './status';
import {request_delete_vlan} from './vlan';
import {request_delete_vxlan} from './vxlan';

const INST = {id: 1, name: 'gw-1'} as IInstance;

function mockFetch(body: string, init: {status?: number} = {}) {
	const {status = 200} = init;
	const resp = new Response(status === 204 ? null : body, {status, statusText: 'OK', headers: {'Content-Type': 'application/json', 'X-Loxi-Error-Origin': 'gateway'}});
	(global.fetch as Mock).mockResolvedValue(resp);
}

beforeEach(() => {
	vi.stubGlobal('fetch', vi.fn());
	localStorage.clear();
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('D11: 200 + {result:"fail"} maps to failed in every remaining family', () => {
	const CASES: Array<[string, () => Promise<any>]> = [
		['bfd', () => request_delete_bfd(INST, '10.0.0.2')],
		['bgp', () => request_delete_bgp_neighbor(INST, '10.0.0.2')],
		['cert', () => request_delete_cert_pem(INST, 'c1')],
		['device_neghbors', () => request_delete_device_neighbor(INST, '10.0.0.2', 'eth0')],
		['fdb', () => request_delete_fdb(INST, '00:11:22:33:44:55', 'eth0')],
		['firewall', () => request_create_firewall_rule(INST, {} as any)],
		['ip', () => request_delete_ipv4(INST, '10.0.0.2', 24, 'eth0')],
		['ipfilter', () => request_delete_ipfilter_rule(INST, {} as any)],
		['ipsec', () => request_delete_ipsec_tunnel(INST, 't1')],
		['mirror', () => request_delete_mirror_by_ident(INST, 'm1')],
		['qos', () => request_delete_qos_policy(INST, 'q1')],
		['route_attr', () => request_delete_route(INST, '10.0.0.0', 24)],
		['securityrate', () => request_reset_securityrate_stats(INST)],
		['sni_certificates', () => request_unregister_sni_certificate(INST, {hostname: 'x'} as any)],
		['status', () => request_post_log_level(INST, 'info')],
		['vlan', () => request_delete_vlan(INST, 100)],
		['vxlan', () => request_delete_vxlan(INST, 100)],
	];

	it.each(CASES)('%s', async (_family, call) => {
		mockFetch(JSON.stringify({result: 'fail'}));
		const res: any = await call();
		expect(res.status).toBe('failed');
	});

	it('sni_certificates: the Error-prefixed soft error stays failed too (sniSoftError preserved)', async () => {
		mockFetch(JSON.stringify({result: 'Error: no such hostname'}));
		const res: any = await request_unregister_sni_certificate(INST, {hostname: 'x'} as any);
		expect(res.status).toBe('failed');
	});

	it('a healthy 200 {result:"OK"} confirms (representative: vlan)', async () => {
		mockFetch(JSON.stringify({result: 'OK'}));
		const res: any = await request_delete_vlan(INST, 100);
		expect(res.status).toBe('confirmed');
	});
});

describe('D12: qos client-side validation is a mapped invalid', () => {
	it('missing target → invalid/.client_invalid, nothing sent, raw text diagnostics-only', async () => {
		const res: any = await request_create_qos_policy(INST, {targetObject: {polObjName: '  ', attachment: 0}} as any);
		expect(res.status).toBe('invalid');
		expect(String(res.code)).toContain('client_invalid');
		expect(global.fetch as Mock).not.toHaveBeenCalled();
	});
});
