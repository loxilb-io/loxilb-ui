//---------------------------------------------------------
// UI-P6-5 — a failed read must never resolve as a successful empty result.
// (npm test src/connector/readErrors.test.ts)
//
// RED against the connectors as they stand. `assertOk` has existed in
// fetcher_base since the F-UX-3 sweep and 33 read functions call it — these
// 18 do not, and each one converts a server failure into a shape the page
// cannot distinguish from "there is nothing here". Three of them say so in
// their own source:
//
//     if (resp.code !== 200) return {archives: []};          // oam.ts
//     const log_strings = resp.data?.logs; if (!log_strings) return [];
//     return (resp.data ?? []) as IUser[];                   // User Management
//
// The operator consequence is the defect this task exists to close: a 500 on
// /oam/loxilbs renders the certified-core landing page as "no instances", and
// a 500 on /oam/users renders User Management as an organisation with no
// accounts in it. Both look like facts about the system.
//
// Two reads deliberately keep a non-throwing contract and are pinned that way
// below, because "absent" is a real answer for them, not a failure:
//   - per-tenant AI rate limits and IPsec config/stats/peerconfig answer 404
//     when the resource simply is not configured;
//   - the metrics scrape must keep polling rather than tear its card down, so
//     it carries the failure in its payload instead of throwing.
//---------------------------------------------------------
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ApiError, SimpleResponse} from './fetcher/fetcher_base';
import {GET_INST, GET_INST_TEXT} from './fetcher/fetcher_inst';
import {GET_OAM} from './fetcher/fetcher_oam';
import {query_get_tenant_ratelimit} from './instance/ai';
import {query_get_ipsec_config, query_get_ipsec_sa_all, query_get_ipsec_stats, query_get_ipsec_tunnel_peerconfig} from './instance/ipsec';
import {query_get_live_metrics} from './instance/metrics';
import {query_get_device_status, query_get_inst_log_archives, query_get_inst_logs, query_get_log_level, query_get_metadata, query_instance_health} from './instance/status';
import {query_get_all_users, query_get_instance_list, query_get_log_archives, query_get_me, query_get_oam_logs, query_setup_status} from './oam/oam';
import {IInstance} from 'types/oam';

vi.mock('./fetcher/fetcher_oam', () => ({GET_OAM: vi.fn()}));
vi.mock('./fetcher/fetcher_inst', () => ({GET_INST: vi.fn(), GET_INST_TEXT: vi.fn()}));

const oamGet = vi.mocked(GET_OAM);
const instGet = vi.mocked(GET_INST);
const instGetText = vi.mocked(GET_INST_TEXT);

const INSTANCE = {id: 1, name: 'gw-1'} as unknown as IInstance;

/** The shape the OAM proxy actually returns for a gateway/OAM failure. */
function errorResponse(code: number): SimpleResponse<any> {
	return {code, data: {result: 'internal error', message: 'internal error'}, message: 'Internal Server Error'};
}

function serveError(code: number) {
	oamGet.mockResolvedValue(errorResponse(code));
	instGet.mockResolvedValue(errorResponse(code));
	instGetText.mockResolvedValue({code, data: 'internal error', message: 'Internal Server Error'});
}

beforeEach(() => {
	vi.clearAllMocks();
});

//---------------------------------------------------------
// The reads that must surface the failure
//---------------------------------------------------------
const MUST_THROW: [name: string, call: () => Promise<unknown>][] = [
	['oam: instance list', () => query_get_instance_list()],
	['oam: my info', () => query_get_me()],
	['oam: all users', () => query_get_all_users()],
	['oam: logs', () => query_get_oam_logs()],
	['oam: log archives', () => query_get_log_archives()],
	['oam: setup status', () => query_setup_status()],
	['instance: device status', () => query_get_device_status(INSTANCE)],
	['instance: metadata', () => query_get_metadata(INSTANCE)],
	['instance: log level', () => query_get_log_level(INSTANCE)],
	['instance: logs', () => query_get_inst_logs(INSTANCE)],
	['instance: log archives', () => query_get_inst_log_archives(INSTANCE)],
	['ipsec: security associations', () => query_get_ipsec_sa_all(INSTANCE)],
];

// `query_instance_health` looked like an 18th offender in the file-level
// audit and is not one: its return value IS the verdict ({isHealthy, code,
// error}), so an unreachable gateway is the answer, not a swallowed failure.
// The instance card branches on that code — 402 means "reachable but
// unlicensed", which reads differently from an outage — and all of it would be
// lost if the probe threw. Pinned as a non-thrower so a later assertOk sweep
// cannot quietly break the card.
describe('the health probe reports rather than throws', () => {
	it.each([500, 502, 402])('a %i resolves to an unhealthy verdict carrying the code', async code => {
		serveError(code);
		await expect(query_instance_health(INSTANCE)).resolves.toMatchObject({isHealthy: false, code});
	});
});

describe.each([500, 502, 401, 403])('a %i on a list read', code => {
	beforeEach(() => serveError(code));

	it.each(MUST_THROW)('%s rejects instead of resolving to an empty result', async (_name, call) => {
		await expect(call()).rejects.toBeInstanceOf(ApiError);
	});

	it('the thrown error carries the HTTP status so the page can classify it', async () => {
		await expect(query_get_instance_list()).rejects.toMatchObject({status: code});
	});
});

describe('a 2xx read is untouched', () => {
	it('still resolves normally', async () => {
		oamGet.mockResolvedValue({code: 200, data: [{id: 1, name: 'gw-1'}], message: 'OK'});
		await expect(query_get_instance_list()).resolves.toEqual([{id: 1, name: 'gw-1'}]);
	});

	it('a 200 whose body is not a list still hands back a list (UI-P6-6 regression guard)', async () => {
		oamGet.mockResolvedValue({code: 200, data: {result: 'unexpected'} as any, message: 'OK'});
		await expect(query_get_instance_list()).resolves.toEqual([]);
	});

	it('the users read has the same whole-body-cast crash shape and must also be guarded', async () => {
		// oam.ts:149 `return (resp.data ?? []) as IUser[]` — the last remaining
		// instance of the shape that took every instance page to the error
		// boundary in UI-P6-6. UserManagementPage calls .map on it.
		oamGet.mockResolvedValue({code: 200, data: {result: 'unexpected'} as any, message: 'OK'});
		await expect(query_get_all_users()).resolves.toEqual([]);
	});
});

//---------------------------------------------------------
// The reads that deliberately keep answering "absent"
//---------------------------------------------------------
describe('reads where 404 means "not configured", not "failed"', () => {
	const ABSENT_ON_404: [name: string, call: () => Promise<unknown>][] = [
		['ai: tenant rate limit', () => query_get_tenant_ratelimit(INSTANCE, 'tenant-a')],
		['ipsec: config', () => query_get_ipsec_config(INSTANCE)],
		['ipsec: stats', () => query_get_ipsec_stats(INSTANCE)],
		['ipsec: tunnel peer config', () => query_get_ipsec_tunnel_peerconfig(INSTANCE, 'tun0')],
	];

	it.each(ABSENT_ON_404)('%s resolves to null on 404', async (_name, call) => {
		serveError(404);
		await expect(call()).resolves.toBeNull();
	});

	it.each(ABSENT_ON_404)('%s still rejects on 500', async (_name, call) => {
		serveError(500);
		await expect(call()).rejects.toBeInstanceOf(ApiError);
	});
});

describe('the metrics scrape carries its failure instead of throwing', () => {
	// A polling card must not tear itself down on one bad scrape, but the
	// existing return type cannot tell "Prometheus collection is disabled"
	// (a placeholder is right) from "the instance answered 500" (an error is
	// right) — the connector says so in its own doc comment. Give it the
	// channel rather than leaving the two identical.
	it('a 503 reports unavailable, not merely "no metrics"', async () => {
		serveError(503);
		const res = await query_get_live_metrics(INSTANCE, 'loxilb');
		expect(res.available).toBe(false);
		expect(res.failure?.status).toBe('unavailable');
	});

	it('a 500 reports failed', async () => {
		serveError(500);
		const res = await query_get_live_metrics(INSTANCE, 'loxilb');
		expect(res.failure?.status).toBe('failed');
	});

	it('a healthy scrape carries no failure', async () => {
		instGetText.mockResolvedValue({code: 200, data: 'loxilb_healthy_host_count 3\n', message: 'OK'});
		const res = await query_get_live_metrics(INSTANCE, 'loxilb');
		expect(res.failure).toBeUndefined();
		expect(res.available).toBe(true);
	});

	it('a 200 exposition that parses to nothing is unavailable data, not a failure', async () => {
		// Pre-parity loxilb answers 200 with a bare JSON string. That is a
		// working instance reporting nothing, so it must not be dressed up as
		// a server error.
		instGetText.mockResolvedValue({code: 200, data: '"Prometheus option is disabled."', message: 'OK'});
		const res = await query_get_live_metrics(INSTANCE, 'loxilb');
		expect(res.available).toBe(false);
		expect(res.failure).toBeUndefined();
	});
});
