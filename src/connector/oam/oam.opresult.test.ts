// UI-P6-1 batch 1 — OAM/instance connectors return a truthful OpResult.
//
// Task-doc red tests 1–3 exercised through a live batch-1 call site:
//  1. HTTP 200 carrying {result:"fail"} must map to `failed` (the legacy
//     false-success trap — today request_update_instance reports success).
//  2. A 200 whose body is not parseable JSON must map to `failed` with a
//     parse code (today the parse-swallow in handle_response makes it look
//     like a healthy success).
//  3. 403 → denied, 502/503 → unavailable, unknown 5xx → failed.
import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import {request_create_instance, request_delete_instance, request_update_instance} from './oam';

function mockFetch(body: string, init: {status?: number; contentType?: string} = {}) {
	const {status = 200, contentType = 'application/json'} = init;
	const resp = new Response(body, {status, headers: {'Content-Type': contentType}});
	(global.fetch as Mock).mockResolvedValue(resp);
	return resp;
}

const INSTANCE = {name: 'lb-1', cimage: '', ctag: '', host: '10.0.0.1', port: '11111', protocol: 'http', version: 'v1', description: '', is_active: true} as any;

beforeEach(() => {
	vi.stubGlobal('fetch', vi.fn());
	localStorage.clear();
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('instance mutations return a discriminated OpResult', () => {
	it('200 + {result:"fail"} maps to failed — never success (the false-success trap)', async () => {
		mockFetch(JSON.stringify({result: 'fail'}));
		const res: any = await request_update_instance(1, INSTANCE);
		expect(res.status).toBe('failed');
	});

	it('200 with an unparseable body maps to failed with a parse code, not a silent success', async () => {
		mockFetch('<html>gateway timeout page</html>');
		const res: any = await request_update_instance(1, INSTANCE);
		expect(res.status).toBe('failed');
		expect(String(res.code)).toContain('parse');
	});

	it('403 maps to denied', async () => {
		mockFetch(JSON.stringify({error: 'forbidden'}), {status: 403});
		const res: any = await request_create_instance(INSTANCE);
		expect(res.status).toBe('denied');
		expect(res.retryable).toBe(false);
	});

	it('502 maps to unavailable (retryable)', async () => {
		mockFetch(JSON.stringify({error: 'bad gateway'}), {status: 502});
		const res: any = await request_delete_instance(1);
		expect(res.status).toBe('unavailable');
		expect(res.retryable).toBe(true);
	});

	it('unknown 5xx maps to failed, never success (unknown ⇒ failed rule)', async () => {
		mockFetch(JSON.stringify({error: 'teapot melted'}), {status: 599});
		const res: any = await request_update_instance(1, INSTANCE);
		expect(res.status).toBe('failed');
	});

	it('a healthy 200 confirms', async () => {
		mockFetch(JSON.stringify({id: 1}));
		const res: any = await request_update_instance(1, INSTANCE);
		expect(res.status).toBe('confirmed');
	});

	it('409 duplicate maps to invalid/.conflict; raw server prose stays out of code/localeKey', async () => {
		// OAM answers 409 for a duplicate instance registration (2026-08-05
		// hardening). The status must be user-correctable (`invalid`), and the
		// pq/unique-constraint prose must stay in diagnostics only.
		mockFetch(JSON.stringify({error: 'pq: duplicate key value violates unique constraint api_endpoint_idx'}), {status: 409});
		const res: any = await request_create_instance(INSTANCE);
		expect(res.status).toBe('invalid');
		expect(String(res.code)).toContain('conflict');
		expect(String(res.localeKey)).not.toContain('pq:');
		expect(String(res.code)).not.toContain('pq:');
	});
});
