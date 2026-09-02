// batch 3 (endpoint / LB) — real defects pinned before migration:
//
//  D6  None of the four LB mutations checks the gateway's legacy
//      200-{result:"fail"} envelope (isMutationFailure was written for
//      exactly these calls but nothing forces its use) — a dataplane-rejected
//      create/patch renders a success popup.
//  D7  request_delete_endpoint_by_ip sniffs resp.message for 'error'/
//      'referred' — but resp.message is the HTTP reason phrase when the
//      transport provides one ("OK" on HTTP/1.1), so the body sniff is DEAD
//      there: deleting an endpoint still referenced by an LB rule reports
//      success. (It only ever worked over HTTP/2, where the empty statusText
//      let the body's result string fall through into message.)
//  D8  Client-side AI-configuration validation failures return raw English
//      concat instead of a mapped `invalid` result (same class as D5).
import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import {IInstance} from 'types/oam';
import {IServiceConfiguration} from 'types/load_balancer';
import {request_create_endpoint, request_delete_endpoint_by_ip} from './endpoint';
import {request_create_load_balancer_config, request_delete_lb_by_name, request_patch_load_balancer_config} from './load_balancer';

const INST = {id: 1, name: 'gw-1'} as IInstance;

const LB_OK: IServiceConfiguration = {
	serviceArguments: {externalIP: '20.20.20.1', port: 8080, protocol: 'tcp', name: 'lb-1'},
	endpoints: [{endpointIP: '31.31.31.1', targetPort: 5001, weight: 1, state: 'active'}],
} as unknown as IServiceConfiguration;

function mockFetch(body: string, init: {status?: number; statusText?: string} = {}) {
	const {status = 200, statusText = ''} = init;
	const resp = new Response(status === 204 || status === 205 ? null : body, {status, statusText, headers: {'Content-Type': 'application/json', 'X-Loxi-Error-Origin': 'gateway'}});
	(global.fetch as Mock).mockResolvedValue(resp);
	return resp;
}

beforeEach(() => {
	vi.stubGlobal('fetch', vi.fn());
	localStorage.clear();
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('LB mutations (D6, D8)', () => {
	it('D6: create — 200 + {result:"fail"} → failed, never a success popup', async () => {
		mockFetch(JSON.stringify({result: 'fail'}));
		const res: any = await request_create_load_balancer_config(INST, LB_OK, 'loxilb');
		expect(res.status).toBe('failed');
	});

	it('D6: patch — 200 + {result:"fail"} → failed', async () => {
		mockFetch(JSON.stringify({result: 'fail'}));
		const res: any = await request_patch_load_balancer_config(INST, '20.20.20.1', 8080, 'tcp', {});
		expect(res.status).toBe('failed');
	});

	it('D6: delete-by-name — 200 + {result:"fail"} → failed', async () => {
		mockFetch(JSON.stringify({result: 'fail'}));
		const res: any = await request_delete_lb_by_name(INST, 'lb-1');
		expect(res.status).toBe('failed');
	});

	it('create — healthy 200 {result:"OK"} confirms', async () => {
		mockFetch(JSON.stringify({result: 'OK'}));
		const res: any = await request_create_load_balancer_config(INST, LB_OK, 'loxilb');
		expect(res.status).toBe('confirmed');
	});

	it('D8: client-side AI validation failure → mapped invalid, no request sent, raw text diagnostics-only', async () => {
		const bad = {
			...LB_OK,
			serviceArguments: {...LB_OK.serviceArguments, mode: 4, kvExactMode: 2},
		} as unknown as IServiceConfiguration;
		const res: any = await request_create_load_balancer_config(INST, bad, 'inference-gateway');
		expect(res.status).toBe('invalid');
		expect(String(res.code)).toContain('client_invalid');
		expect(global.fetch as Mock).not.toHaveBeenCalled();
	});

	it('gateway 400 (immutable-field patch) → invalid', async () => {
		mockFetch(JSON.stringify({error: 'immutable field'}), {status: 400});
		const res: any = await request_patch_load_balancer_config(INST, '20.20.20.1', 8080, 'tcp', {});
		expect(res.status).toBe('invalid');
	});
});

describe('endpoint mutations (D6, D7)', () => {
	it('D6: create — 200 + {result:"fail"} → failed', async () => {
		mockFetch(JSON.stringify({result: 'fail'}));
		const res: any = await request_create_endpoint(INST, {hostName: '31.31.31.1', name: 'ep-1'} as any);
		expect(res.status).toBe('failed');
	});

	it('D7: delete of a rule-referenced endpoint over HTTP/1.1 → failed (body sniff, not reason-phrase sniff)', async () => {
		// statusText 'OK' models HTTP/1.1, where handle_response keeps the
		// reason phrase and the legacy resp.message sniff never sees the body.
		mockFetch(JSON.stringify({result: 'endpoint referred by loadbalancer rule'}), {statusText: 'OK'});
		const res: any = await request_delete_endpoint_by_ip(INST, {hostName: '31.31.31.1', name: 'ep-1'} as any);
		expect(res.status).toBe('failed');
		expect(String(res.code)).toContain('reported_failure');
	});

	it('D7: same rejection over HTTP/2 (empty reason phrase) → failed too', async () => {
		mockFetch(JSON.stringify({result: 'endpoint referred by loadbalancer rule'}));
		const res: any = await request_delete_endpoint_by_ip(INST, {hostName: '31.31.31.1', name: 'ep-1'} as any);
		expect(res.status).toBe('failed');
	});

	it('delete — healthy 200 {result:"OK"} confirms', async () => {
		mockFetch(JSON.stringify({result: 'OK'}), {statusText: 'OK'});
		const res: any = await request_delete_endpoint_by_ip(INST, {hostName: '31.31.31.1', name: 'ep-1'} as any);
		expect(res.status).toBe('confirmed');
	});
});
