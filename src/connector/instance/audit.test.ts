// Audit configuration connectors: what goes on the wire, and which answers
// are data. The gateway's audit handlers answer 204 with no body on success
// and 400/503 with no body on refusal.
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AUDIT_POLICY_START} from 'types/audit_config';
import {IInstance} from 'types/oam';
import {ApiError} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST, PUT_INST} from '../fetcher/fetcher_inst';
import {
	query_get_audit_named_sink,
	query_get_audit_policy,
	query_get_audit_sink,
	request_delete_audit_named_sink,
	request_disable_audit_sink,
	request_put_audit_named_sink,
	request_rotate_audit_segment,
	request_set_audit_policy,
	request_set_audit_sink,
} from './audit';

vi.mock('../fetcher/fetcher_inst', () => ({GET_INST: vi.fn(), POST_INST: vi.fn(), PUT_INST: vi.fn(), DELETE_INST: vi.fn()}));

const instance = {id: 3, name: 'gateway'} as IInstance;
const get = vi.mocked(GET_INST);
const post = vi.mocked(POST_INST);
const put = vi.mocked(PUT_INST);
const del = vi.mocked(DELETE_INST);
const resp = (code: number, data?: unknown) => ({code, message: '', data}) as never;

beforeEach(() => {
	for (const m of [get, post, put, del]) m.mockReset();
});

describe('audit policy connectors', () => {
	it('reads `{}` as an answer, and throws anything that is not 2xx', async () => {
		get.mockResolvedValue(resp(200, {}));
		expect(await query_get_audit_policy(instance)).toEqual({});
		get.mockResolvedValue(resp(403));
		await expect(query_get_audit_policy(instance)).rejects.toBeInstanceOf(ApiError);
	});

	it('posts all six fields with their zeros on the wire', async () => {
		post.mockResolvedValue(resp(204));
		expect((await request_set_audit_policy(instance, AUDIT_POLICY_START)).status).toBe('confirmed');
		expect(post.mock.calls[0][1]).toBe('/audit/policy');
		expect(JSON.parse(JSON.stringify(post.mock.calls[0][2]))).toEqual({
			max_segment_bytes: 67108864,
			max_segment_age_seconds: 86400,
			retention_max_age_seconds: 0,
			retention_max_bytes: 0,
			retention_reserve_bytes: 0,
			retention_max_prune_per_pass: 1,
		});
	});

	it('reports a bodyless 400 as invalid input, not as an outage', async () => {
		post.mockResolvedValue(resp(400));
		const res = await request_set_audit_policy(instance, AUDIT_POLICY_START);
		expect(res.status).toBe('invalid');
		expect(res.retryable).toBe(false);
	});

	// PR 2's rule: a change that got no usable answer is not known to have failed.
	it('reports a 504 on a change as outcome unknown', async () => {
		post.mockResolvedValue(resp(504));
		expect((await request_set_audit_policy(instance, AUDIT_POLICY_START)).status).toBe('unknown');
	});

	it('returns the two segment ids of a rotation', async () => {
		post.mockResolvedValue(resp(200, {sealed_segment_uuid: 'a', new_segment_uuid: 'b'}));
		const res = await request_rotate_audit_segment(instance);
		expect(post.mock.calls[0][1]).toBe('/audit/rotate');
		expect(res).toMatchObject({status: 'confirmed', data: {sealed_segment_uuid: 'a', new_segment_uuid: 'b'}});
	});
});

describe('compliance sink connectors', () => {
	it('reads `{}` as no sink configured', async () => {
		get.mockResolvedValue(resp(200, {}));
		expect(await query_get_audit_sink(instance)).toEqual({});
	});

	it('posts the body it is given, and only the flag to disable', async () => {
		post.mockResolvedValue(resp(204));
		const body = {enabled: true as const, address: 'siem:6514', ca_bundle_path: '/ca.pem', server_name: '', client_cert_path: '', client_key_path: '', facility: 0, max_frame_bytes: 0};
		await request_set_audit_sink(instance, body);
		await request_disable_audit_sink(instance);
		expect(post.mock.calls.map(c => [c[1], c[2]])).toEqual([
			['/audit/sink', body],
			['/audit/sink', {enabled: false}],
		]);
	});
});

describe('named sink connectors', () => {
	const body = {address: 'siem:6514', ca_bundle_path: '/ca.pem', server_name: '', client_cert_path: '', client_key_path: '', facility: 0, max_frame_bytes: 0, enterprise_number: 32473};

	it('returns null for 404: that is how a delete is confirmed', async () => {
		get.mockResolvedValue(resp(404, {code: 404, message: 'no audit sink of that name'}));
		expect(await query_get_audit_named_sink(instance, 'edr')).toBeNull();
		expect(get.mock.calls[0][1]).toBe('/audit/sinks/edr');
	});

	it('throws a read that failed for any other reason, so it is not taken for "gone"', async () => {
		get.mockResolvedValue(resp(503));
		await expect(query_get_audit_named_sink(instance, 'edr')).rejects.toBeInstanceOf(ApiError);
	});

	it('puts and deletes by name', async () => {
		put.mockResolvedValue(resp(204));
		del.mockResolvedValue(resp(204));
		expect((await request_put_audit_named_sink(instance, 'edr_1', body)).status).toBe('confirmed');
		expect((await request_delete_audit_named_sink(instance, 'edr_1')).status).toBe('confirmed');
		expect(put.mock.calls[0].slice(1)).toEqual(['/audit/sinks/edr_1', body]);
		expect(del.mock.calls[0][1]).toBe('/audit/sinks/edr_1');
	});

	// The management backend refuses an encoded / \ ? # in a path segment.
	it.each(['a/b', 'a?b', 'a#b', 'a\\b'])('refuses the name %j before sending anything', async name => {
		expect(await request_put_audit_named_sink(instance, name, body)).toMatchObject({status: 'invalid', code: 'audit.put_named_sink.client_invalid_path'});
		expect(await request_delete_audit_named_sink(instance, name)).toMatchObject({status: 'invalid', code: 'audit.delete_named_sink.client_invalid_path'});
		expect(put).not.toHaveBeenCalled();
		expect(del).not.toHaveBeenCalled();
	});
});
