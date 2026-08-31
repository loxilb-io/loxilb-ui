// UI-P6-1 — transport-layer navigation side effects on MUTATIONS.
//
// Defect (task doc §1, proven live by e2e/tests/oam/no-false-success.spec.ts
// batch-1 case): a 5xx on an OAM mutation fires move_500 and ejects the
// whole app to /500 mid-form — the operator's dialog and input are
// discarded, and the OpResult adapter never gets to render the localized
// failure. Reads keep the legacy redirect behavior (page-state handling is
// UI-P6-5's scope); the 401 session path is untouched (UI-P6-4 owns it).
import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import {GET, POST, PUT} from './fetcher_base';

const moved500 = vi.hoisted(() => vi.fn());
const moved402 = vi.hoisted(() => vi.fn());
const moved503 = vi.hoisted(() => vi.fn());
vi.mock('common', async importOriginal => ({
	...(await importOriginal<typeof import('common')>()),
	move_500: moved500,
	move_402: moved402,
	move_503: moved503,
}));

function mockFetch(body: string, status = 200) {
	const resp = new Response(body, {status, headers: {'Content-Type': 'application/json'}});
	(global.fetch as Mock).mockResolvedValue(resp);
}

beforeEach(() => {
	vi.stubGlobal('fetch', vi.fn());
	localStorage.clear();
	moved500.mockReset();
	moved402.mockReset();
	moved503.mockReset();
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('mutations fail inline — no full-app error-page redirect', () => {
	it('PUT answered 500 returns the response inline; move_500 is NOT called', async () => {
		mockFetch(JSON.stringify({error: 'boom'}), 500);
		const resp = await PUT('http://oam/oam/loxilbs/1', {});
		expect(resp.code).toBe(500);
		expect(moved500).not.toHaveBeenCalled();
	});

	it('POST answered 503 returns inline; move_503 is NOT called', async () => {
		mockFetch(JSON.stringify({error: 'maintenance'}), 503);
		const resp = await POST('http://oam/oam/loxilbs', {});
		expect(resp.code).toBe(503);
		expect(moved503).not.toHaveBeenCalled();
	});

	it('POST answered 402 returns inline; move_402 is NOT called', async () => {
		mockFetch(JSON.stringify({error: 'license required'}), 402);
		const resp = await POST('http://oam/loxilbs/1/netlox/v1/config/ai/apikey', {});
		expect(resp.code).toBe(402);
		expect(moved402).not.toHaveBeenCalled();
	});
});

describe('reads keep the legacy redirect behavior (UI-P6-5 owns page states)', () => {
	it('GET answered 500 on an OAM control-plane URL still calls move_500', async () => {
		mockFetch(JSON.stringify({message: 'boom'}), 500);
		await GET('http://oam/oam/logs');
		expect(moved500).toHaveBeenCalled();
	});

	it('GET answered 500 on a gateway pass-through URL stays inline (existing carve-out)', async () => {
		mockFetch(JSON.stringify({message: 'boom'}), 500);
		const resp = await GET('http://oam/loxilbs/1/netlox/v1/config/vlan/all');
		expect(resp.code).toBe(500);
		expect(moved500).not.toHaveBeenCalled();
	});
});
