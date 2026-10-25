import {describe, expect, it} from 'vitest';
import {IServiceArguments} from './load_balancer';
import {requiresKvBlockConfirmation} from './kv_block_confirmation';

const original: IServiceArguments = {
	name: 'ucx-qwen', externalIP: '192.0.2.10', port: 8080, protocol: 'tcp', mode: 4,
	inactiveTimeOut: 60, connectionLimit: 4, timeoutTcpInspect: 10000,
	kvExactMode: 3, kvBlockSize: 16, model_name: 'Qwen/Qwen3-0.6B',
};

describe('KV confirmation on an existing rule', () => {
	it('does not require a new engine attestation for listener0, deadline, idle, credentials or admission edits', () => {
		for (const delta of [{connectionLimit: 0}, {timeoutTcpInspect: 22000}, {inactiveTimeOut: 22}, {api_key_auth: 'required' as const}, {fc_max_outstanding: 8}]) {
			expect(requiresKvBlockConfirmation({...original, ...delta}, original)).toBe(false);
		}
	});
	it('retains confirmation for a fresh exact rule even with a populated seed', () => {
		expect(requiresKvBlockConfirmation(original)).toBe(true);
	});
	it('retains confirmation when entering exact mode from plain routing', () => {
		expect(requiresKvBlockConfirmation(original, {...original, kvExactMode: 0})).toBe(true);
	});
	it.each([
		{kvBlockSize: 32}, {kvExactMode: 1, pd_disagg_mode: true},
		{kvEngineType: 'sglang' as const}, {kvHashAlgo: 'xxhash_cbor' as const},
		{kvModelProfile: 'new-profile'}, {kvExactApiMode: 'chat' as const}, {model_name: 'another-model'},
	])('requires confirmation for changed KV contract %j', delta => {
		expect(requiresKvBlockConfirmation({...original, ...delta}, original)).toBe(true);
	});
	it('recognizes engine and hash defaults as the same existing contract', () => {
		expect(requiresKvBlockConfirmation({...original, kvEngineType: 'vllm', kvHashAlgo: 'sha256_cbor'}, original)).toBe(false);
	});
	it('does not ask for a KV confirmation when leaving exact mode', () => {
		expect(requiresKvBlockConfirmation({...original, kvExactMode: 0}, original)).toBe(false);
	});
});
