import {beforeEach, describe, expect, it, vi} from 'vitest';
import {IInstance} from 'types/oam';
import {IPolicyAttribute} from 'types/qos';
import {POST_INST} from '../fetcher/fetcher_inst';
import {request_create_qos_policy} from './qos';

vi.mock('../fetcher/fetcher_inst', () => ({GET_INST: vi.fn(), POST_INST: vi.fn(), DELETE_INST: vi.fn()}));

const instance = {id: 1, name: 'gateway'} as IInstance;
const policy = (attachment: 0 | 1 | 2, target: string): IPolicyAttribute => ({
	policyIdent: 'qos-test',
	policyInfo: {
		type: 0,
		colorAware: false,
		committedInfoRate: 10,
		peakInfoRate: 10,
		committedBlkSize: 125000,
		excessBlkSize: 0,
	},
	targetObject: {attachment, polObjName: target},
});

describe('QoS connector target validation', () => {
	const post = vi.mocked(POST_INST);

	beforeEach(() => {
		post.mockReset();
		post.mockResolvedValue({code: 200, data: null, message: ''});
	});

	it('rejects an LB display name in place of the composite key', async () => {
		const result = await request_create_qos_policy(instance, policy(0, 'friendly-rule'));
		expect(result.status).toBe('invalid');
		// Field detail is diagnostics-only under OpResult (never rendered raw).
		expect(result.rawDetail).toContain('VIP:PORT:PROTO');
		expect(post).not.toHaveBeenCalled();
	});

	it('passes the composite rule key unchanged', async () => {
		const data = policy(0, '20.20.20.1:2020:tcp');
		expect((await request_create_qos_policy(instance, data)).status).toBe('confirmed');
		expect(post).toHaveBeenCalledWith(instance, '/config/policy', data);
	});

	it('passes a bracketed IPv6 composite rule key unchanged', async () => {
		const data = policy(0, '[2001:db8::20]:443:tcp');
		expect((await request_create_qos_policy(instance, data)).status).toBe('confirmed');
		expect(post).toHaveBeenCalledWith(instance, '/config/policy', data);
	});

	it.each([
		'2001:db8::20:443:tcp',
		'[2001:db8::20:443:tcp',
		'[2001:db8::20]:443:icmp',
		'[2001:db8::20]:65536:tcp',
	])('rejects ambiguous or malformed IPv6 target %s', async target => {
		const result = await request_create_qos_policy(instance, policy(0, target));
		expect(result.status).toBe('invalid');
		expect(result.rawDetail).toContain('[VIP]:PORT:PROTO');
		expect(post).not.toHaveBeenCalled();
	});

	it('round-trips attachment 2 and leaves missing egress-hook errors to the Gateway', async () => {
		const data = policy(2, 'eth0');
		expect((await request_create_qos_policy(instance, data)).status).toBe('confirmed');
		expect(post).toHaveBeenCalledWith(instance, '/config/policy', data);
	});
});
