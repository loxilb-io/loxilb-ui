// transport-layer navigation side effects on MUTATIONS.
//
// Defect (task doc §1, proven live by e2e/tests/oam/no-false-success.spec.ts
// batch-1 case): a 5xx on an OAM mutation fires move_500 and ejects the
// whole app to /500 mid-form — the operator's dialog and input are
// discarded, and the OpResult adapter never gets to render the localized
// failure. The 401 session path is untouched ( owns it).
//
// extends the same reasoning to READS, but only as far as it has
// somewhere better to put the failure. A read answered 503 or 5xx now stays
// inline so the page it belongs to can render `unavailable` / `failed` beside
// the rows the operator was already looking at, instead of throwing the whole
// application at a full-screen error page. A read answered 404 deliberately
// keeps redirecting: "this resource does not exist" is an answer about the
// route, not about one panel on it (user decision, session 12).
import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import {GET, POST, PUT} from './fetcher_base';

const moved500 = vi.hoisted(() => vi.fn());
const moved402 = vi.hoisted(() => vi.fn());
const moved503 = vi.hoisted(() => vi.fn());
const moved404 = vi.hoisted(() => vi.fn());
vi.mock('common', async importOriginal => ({
	...(await importOriginal<typeof import('common')>()),
	move_500: moved500,
	move_402: moved402,
	move_503: moved503,
	move_404: moved404,
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
	moved404.mockReset();
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

describe('reads fail inline where a page state can carry the failure', () => {
	it('GET answered 500 on an OAM control-plane URL no longer ejects the app to /500', async () => {
		mockFetch(JSON.stringify({message: 'boom'}), 500);
		const resp = await GET('http://oam/oam/logs');
		expect(resp.code).toBe(500);
		expect(moved500).not.toHaveBeenCalled();
	});

	it('GET answered 503 on an OAM control-plane URL no longer ejects the app to /503', async () => {
		mockFetch(JSON.stringify({message: 'maintenance'}), 503);
		const resp = await GET('http://oam/oam/loxilbs');
		expect(resp.code).toBe(503);
		expect(moved503).not.toHaveBeenCalled();
	});

	it('a "not running" 5xx no longer routes to /503 either — the page says it, not the app', async () => {
		// This body is what the OAM answers when the instance is down; the old
		// code sniffed it to pick /503 over /500. Both destinations are gone
		// for reads, so the sniff has nothing left to choose between.
		mockFetch(JSON.stringify({message: 'loxilb is not running'}), 500);
		const resp = await GET('http://oam/oam/loxilbs/1/status');
		expect(resp.code).toBe(500);
		expect(moved503).not.toHaveBeenCalled();
		expect(moved500).not.toHaveBeenCalled();
	});

	it('the failing read still hands the status back, so assertOk can throw it', async () => {
		mockFetch(JSON.stringify({message: 'boom'}), 502);
		const resp = await GET('http://oam/oam/users');
		expect(resp.code).toBe(502);
	});
});

describe('what this work deliberately did NOT change', () => {
	it('GET answered 404 on an OAM control-plane URL STILL redirects to /404', async () => {
		// A missing resource is an answer about the route the operator asked
		// for, not about one panel on the page. Kept by explicit decision.
		mockFetch(JSON.stringify({message: 'no such instance'}), 404);
		await GET('http://oam/oam/loxilbs/999');
		expect(moved404).toHaveBeenCalled();
	});

	it('GET answered 500 on a gateway pass-through URL stays inline (pre-existing carve-out)', async () => {
		mockFetch(JSON.stringify({message: 'boom'}), 500);
		const resp = await GET('http://oam/loxilbs/1/netlox/v1/config/vlan/all');
		expect(resp.code).toBe(500);
		expect(moved500).not.toHaveBeenCalled();
	});

	it('GET answered 404 on a gateway pass-through URL stays inline (pre-existing carve-out)', async () => {
		mockFetch(JSON.stringify({message: 'not implemented here'}), 404);
		const resp = await GET('http://oam/loxilbs/1/netlox/v1/config/ipsec/config');
		expect(resp.code).toBe(404);
		expect(moved404).not.toHaveBeenCalled();
	});
});
