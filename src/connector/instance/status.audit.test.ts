// GET /audit/status + /audit/sink connector.
//
// A 403 (the caller is not a gateway administrator) and a 404 (the gateway
// predates the audit API) are answers, returned as data, so react-query never
// retries a refusal and the System page never shows an error for a gateway that
// is working as designed. Anything else is a real failure and still throws.
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {IInstance} from 'types/oam';
import {ApiError} from '../fetcher/fetcher_base';
import {GET_INST} from '../fetcher/fetcher_inst';
import {query_get_audit_rest} from './status';

vi.mock('../fetcher/fetcher_inst', () => ({
	GET_INST: vi.fn(),
	POST_INST: vi.fn(),
}));

const instance = {id: 3, name: 'gateway'} as IInstance;
const get = vi.mocked(GET_INST);

// Braces are load-bearing: see status.capability.test.ts.
beforeEach(() => {
	get.mockReset();
});

function answer(byPath: Record<string, {code: number; data?: unknown; parse_failed?: boolean}>) {
	get.mockImplementation(async (_inst, path) => ({message: '', ...byPath[path as string]}) as never);
}

describe('audit REST read connector', () => {
	it('reads the status, then the sink', async () => {
		answer({'/audit/status': {code: 200, data: {available: true, running: true}}, '/audit/sink': {code: 200, data: {}}});
		expect(await query_get_audit_rest(instance, {readSink: true})).toEqual({kind: 'ok', status: {available: true, running: true}, sink: {}});
		expect(get.mock.calls.map(c => c[1])).toEqual(['/audit/status', '/audit/sink']);
	});

	it('returns 403 as forbidden and does not ask for the sink, which would be refused too', async () => {
		answer({'/audit/status': {code: 403}});
		expect(await query_get_audit_rest(instance, {readSink: true})).toEqual({kind: 'forbidden'});
		expect(get).toHaveBeenCalledTimes(1);
	});

	it('returns 404 as absent and does not ask for the sink', async () => {
		answer({'/audit/status': {code: 404}});
		expect(await query_get_audit_rest(instance, {readSink: true})).toEqual({kind: 'absent'});
		expect(get).toHaveBeenCalledTimes(1);
	});

	it('throws any other status failure, so an unreachable gateway is not read as quiet', async () => {
		answer({'/audit/status': {code: 503}});
		await expect(query_get_audit_rest(instance, {readSink: true})).rejects.toBeInstanceOf(ApiError);
	});

	it('keeps the status when only the sink read fails', async () => {
		answer({'/audit/status': {code: 200, data: {orphaned_intents: 1}}, '/audit/sink': {code: 500}});
		expect(await query_get_audit_rest(instance, {readSink: true})).toEqual({kind: 'ok', status: {orphaned_intents: 1}, sink: undefined});
	});

	it('treats an unreadable sink body as no sink read, not as "no sink configured"', async () => {
		answer({'/audit/status': {code: 200, data: {}}, '/audit/sink': {code: 200, data: null, parse_failed: true}});
		expect(await query_get_audit_rest(instance, {readSink: true})).toEqual({kind: 'ok', status: {}, sink: undefined});
	});

	// The management backend refuses a viewer /audit/sink with 403. The state
	// of every sink is in the status, so the refusal is never asked for.
	it('does not ask for the sink when told the caller may not read it', async () => {
		answer({'/audit/status': {code: 200, data: {available: true, sinks: [{name: 'compliance', compliance: true, state: 'disconnected'}]}}});
		expect(await query_get_audit_rest(instance, {readSink: false})).toEqual({
			kind: 'ok',
			status: {available: true, sinks: [{name: 'compliance', compliance: true, state: 'disconnected'}]},
			sink: undefined,
		});
		expect(get.mock.calls.map(c => c[1])).toEqual(['/audit/status']);
	});
});
