// UI-P6-1 batch 4 (snapshot) — OpResult contract, preserving this family's
// two hard-won conventions: mutations NEVER reject (a thrown fetch stranded
// the restore wizard's non-dismissable committing screen, §9.3 case 3), and
// restore's 200-with-failure-outcome is DATA (the wizard renders the gateway
// outcome verbatim), not an error mapping.
//
// Real defects pinned:
//  D9  A 201 whose body fails to parse yields success-with-undefined-snapshot
//      — the pre-upgrade flow then silently skips the pin PATCH (the snapshot
//      exists unpinned, no warning), and the rename-to-real-version step is
//      lost.
//  D10 The network-failure result is raw English concat ("... failed: ...
//      (server unreachable)") shown verbatim in popups (ES-10/ES-18); it must
//      be a mapped, localized `unavailable`.
import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import {request_delete_snapshot, request_put_snapshot_schedule, request_restore_snapshot, request_take_snapshot} from './snapshotApi';

function mockFetch(body: string, status = 200) {
	const resp = new Response(status === 204 ? null : body, {status, headers: {'Content-Type': 'application/json'}});
	(global.fetch as Mock).mockResolvedValue(resp);
}

beforeEach(() => {
	vi.stubGlobal('fetch', vi.fn());
	localStorage.clear();
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('snapshot mutations return OpResult', () => {
	it('D9: 201 with an unparseable body → failed with a parse code, never success-without-snapshot', async () => {
		mockFetch('<html>proxy interstitial</html>', 201);
		const res: any = await request_take_snapshot(1, {name: 'x'});
		expect(res.status).toBe('failed');
		expect(String(res.code)).toContain('parse');
		expect(res.data).toBeUndefined();
	});

	it('D10: OAM unreachable → mapped retryable unavailable that still never rejects', async () => {
		(global.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
		const res: any = await request_take_snapshot(1, {name: 'x'});
		expect(res.status).toBe('unavailable');
		expect(res.retryable).toBe(true);
		// Raw transport detail is diagnostics-only.
		expect(res.rawDetail).toContain('Failed to fetch');
	});

	it('healthy 201 confirms with the created snapshot in data', async () => {
		mockFetch(JSON.stringify({id: 's2', name: 'x', trigger_type: 'manual'}), 201);
		const res: any = await request_take_snapshot(1, {name: 'x'});
		expect(res.status).toBe('confirmed');
		expect(res.data?.id).toBe('s2');
	});

	it('pinned-delete refusal (409) → invalid/.conflict with the server detail in diagnostics', async () => {
		mockFetch(JSON.stringify({error: 'snapshot is pinned; unpin it or pass force=true'}), 409);
		const res: any = await request_delete_snapshot('s1');
		expect(res.status).toBe('invalid');
		expect(String(res.code)).toContain('conflict');
		expect(res.rawDetail).toContain('pinned');
	});

	it('schedule PUT 200 confirms with the stored schedule in data', async () => {
		mockFetch(JSON.stringify({enabled: true, interval_hours: 24, retain_count: 7}));
		const res: any = await request_put_snapshot_schedule(1, {enabled: true, interval_hours: 24, retain_count: 7});
		expect(res.status).toBe('confirmed');
		expect(res.data?.interval_hours).toBe(24);
	});
});

describe('request_restore_snapshot keeps the 200-with-failure-outcome contract', () => {
	it('a rolled-back gateway leg is CONFIRMED data — the wizard owns rendering the outcome', async () => {
		mockFetch(JSON.stringify({snapshot_id: 's1', instance_id: 1, mode: 'commit', gateway_status: 500, gateway_response: {result: 'rolled-back', errors: ['apply lb: boom']}}));
		const res: any = await request_restore_snapshot('s1', 'commit');
		expect(res.status).toBe('confirmed');
		expect(res.data?.gateway_status).toBe(500);
		expect(res.data?.gateway_response?.result).toBe('rolled-back');
	});

	it('OAM integrity refusal (422) → invalid, detail in diagnostics', async () => {
		mockFetch(JSON.stringify({error: 'stored snapshot failed integrity verification'}), 422);
		const res: any = await request_restore_snapshot('s1', 'dry-run');
		expect(res.status).toBe('invalid');
		expect(res.rawDetail).toContain('integrity');
	});

	it('a 200 with an unparseable body must NOT confirm (the wizard needs a real outcome object)', async () => {
		mockFetch('<html>half a body');
		const res: any = await request_restore_snapshot('s1', 'commit');
		expect(res.status).toBe('failed');
	});

	it('never rejects on network failure (wizard §9.3 case 3 stays fixed)', async () => {
		(global.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
		const res: any = await request_restore_snapshot('s1', 'commit');
		expect(res.status).toBe('unavailable');
	});
});
