//---------------------------------------------------------
// Operator maintenance connector.
//
// The window belongs to the enter that starts an episode: 0 and "none" both
// declare no deadline, so neither is sent. A leave carries nothing but the
// direction. A refusal — the boot replay not settled, a restore in progress,
// a role without the authority — is a result the page can name, never a
// success and never a throw.
//---------------------------------------------------------
import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import {IInstance} from 'types/oam';
import {query_get_maintenance, request_enter_maintenance, request_leave_maintenance} from './maintenance';

const INST = {id: 1, name: 'gw-1'} as IInstance;

function mockFetch(body: unknown, status = 200) {
	(global.fetch as Mock).mockResolvedValue(
		new Response(JSON.stringify(body), {status, statusText: 'x', headers: {'Content-Type': 'application/json', 'X-Loxi-Error-Origin': 'gateway'}}),
	);
}
const sent = () => {
	const [url, init] = (global.fetch as Mock).mock.calls[0];
	return {url: String(url), method: init?.method, body: init?.body ? JSON.parse(init.body) : undefined};
};

beforeEach(() => {
	vi.stubGlobal('fetch', vi.fn());
	localStorage.clear();
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('maintenance writes', () => {
	it('enters with the declared window', async () => {
		mockFetch({state: 'maintenance', operation_id: 'op-1'});
		const res = await request_enter_maintenance(INST, 300);
		expect(res.status).toBe('confirmed');
		expect(sent()).toMatchObject({method: 'PUT', body: {enabled: true, drain_timeout_seconds: 300}});
		expect(sent().url).toMatch(/\/maintenance$/);
	});

	it.each([undefined, 0])('sends no window for %s', async window => {
		mockFetch({state: 'maintenance'});
		await request_enter_maintenance(INST, window);
		expect(sent().body).toEqual({enabled: true});
	});

	it('leaves with the direction alone', async () => {
		mockFetch({state: 'active', operation_id: 'op-1'});
		const res = await request_leave_maintenance(INST);
		expect(res.status).toBe('confirmed');
		expect(sent()).toMatchObject({method: 'PUT', body: {enabled: false}});
	});

	it.each([
		[503, 'unavailable'],
		[403, 'denied'],
		[401, 'denied'],
	])('reports a %i refusal as %s, not as a change', async (status, expected) => {
		mockFetch({code: status, message: 'refused'}, status);
		expect((await request_enter_maintenance(INST)).status).toBe(expected);
		(global.fetch as Mock).mockClear();
		mockFetch({code: status, message: 'refused'}, status);
		expect((await request_leave_maintenance(INST)).status).toBe(expected);
	});

	it('does not throw when the gateway cannot be reached', async () => {
		(global.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
		expect((await request_leave_maintenance(INST)).status).toBe('unknown');
	});
});

describe('maintenance read', () => {
	it('stamps the read with its own receive time', async () => {
		mockFetch({state: 'active', refusing_new_config: false});
		const before = Date.now();
		const read = await query_get_maintenance(INST);
		expect(read.data.state).toBe('active');
		expect(read.receivedAtMs).toBeGreaterThanOrEqual(before);
	});

	it('throws on a failed read, so no state is made up from it', async () => {
		mockFetch({code: 503, message: 'store unavailable'}, 503);
		await expect(query_get_maintenance(INST)).rejects.toMatchObject({status: 503});
	});
});
