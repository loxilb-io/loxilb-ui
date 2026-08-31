// UI-P6-1 batch 2 (AI key/quota) — real defects pinned before migration:
//
//  D1  request_create_apikey accepts HTTP 200 + {result:"fail"} as success —
//      the page then renders the reveal dialog around a failure body, so the
//      operator believes a key exists that the gateway rejected.
//  D2  A 200 whose body fails to parse yields {status:'success',
//      created:undefined} — AIApiKeyPage falls into showAddError(...,
//      res.error) with res.error === undefined (an empty/"undefined" popup).
//  D3  request_delete_apikey has the same envelope gap — a dataplane-rejected
//      delete is counted as succeeded in the bulk flow ("N succeeded" lies).
//  D4  The gateway answers 501 for AI config when --userservice is off, and
//      402 on license-gated builds; both are indistinguishable from generic
//      failure today. They get distinct machine codes so pages and E2E can
//      branch honestly.
//  D5  Client-side rate-limit validation failures return raw English concat
//      ("Invalid tenant rate limit: ...") — must be a mapped `invalid` result.
import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import {IInstance} from 'types/oam';
import {request_create_apikey, request_delete_apikey, request_set_tenant_ratelimit} from './ai';

const INST = {id: 1, name: 'gw-1'} as IInstance;

function mockFetch(body: string, init: {status?: number} = {}) {
	const {status = 200} = init;
	// X-Loxi-Error-Origin marks gateway-hop failures so the transport layer
	// never treats them as an expired OAM browser session.
	const resp = new Response(body, {status, headers: {'Content-Type': 'application/json', 'X-Loxi-Error-Origin': 'gateway'}});
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

describe('request_create_apikey', () => {
	it('D1: 200 + {result:"fail"} → failed, and no created payload survives', async () => {
		mockFetch(JSON.stringify({result: 'fail'}));
		const res: any = await request_create_apikey(INST, {tenant_id: 't1'} as any);
		expect(res.status).toBe('failed');
		expect(res.data).toBeUndefined();
	});

	it('D2: 200 with an unparseable body → failed with a parse code (not success-without-created)', async () => {
		mockFetch('<html>proxy error page</html>');
		const res: any = await request_create_apikey(INST, {tenant_id: 't1'} as any);
		expect(res.status).toBe('failed');
		expect(String(res.code)).toContain('parse');
	});

	it('a healthy 201 confirms and carries the created key body', async () => {
		mockFetch(JSON.stringify({key_id: 'k-1', raw_key: 'lxb_secret', tenant_id: 't1'}), {status: 201});
		const res: any = await request_create_apikey(INST, {tenant_id: 't1'} as any);
		expect(res.status).toBe('confirmed');
		expect(res.data?.raw_key).toBe('lxb_secret');
	});

	it('D4: 501 (--userservice off) gets the distinct not_implemented code and honest locale key', async () => {
		mockFetch(JSON.stringify({error: 'not implemented'}), {status: 501});
		const res: any = await request_create_apikey(INST, {tenant_id: 't1'} as any);
		expect(res.status).toBe('failed');
		expect(String(res.code)).toContain('not_implemented');
		expect(res.localeKey).toBe('This feature is not enabled on this instance.');
	});

	it('D4: 402 license gate maps to denied with a distinct code', async () => {
		mockFetch(JSON.stringify({error: 'license required'}), {status: 402});
		const res: any = await request_create_apikey(INST, {tenant_id: 't1'} as any);
		expect(res.status).toBe('denied');
		expect(String(res.code)).toContain('payment_required');
	});
});

describe('request_delete_apikey', () => {
	it('D3: 200 + {result:"fail"} → failed — a rejected delete must not count as succeeded', async () => {
		mockFetch(JSON.stringify({result: 'fail'}));
		const res: any = await request_delete_apikey(INST, 'k-1');
		expect(res.status).toBe('failed');
	});

	it('204 confirms (bodyless delete)', async () => {
		mockFetch('', {status: 204});
		const res: any = await request_delete_apikey(INST, 'k-1');
		expect(res.status).toBe('confirmed');
	});
});

describe('request_set_tenant_ratelimit', () => {
	it('D5: client-side validation failure → invalid with a mapped code, raw detail diagnostics-only', async () => {
		const res: any = await request_set_tenant_ratelimit(INST, {tenant_id: '', rate_limit: -5} as any);
		expect(res.status).toBe('invalid');
		expect(String(res.code)).toContain('client_invalid');
		expect((global.fetch as Mock)).not.toHaveBeenCalled();
	});

	it('200 + {result:"fail"} → failed (envelope gap shared with the key mutations)', async () => {
		mockFetch(JSON.stringify({result: 'fail'}));
		const res: any = await request_set_tenant_ratelimit(INST, {tenant_id: 't1', rate_limit: 10} as any);
		expect(res.status).toBe('failed');
	});
});
