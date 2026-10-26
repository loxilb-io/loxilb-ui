import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {request_create_ipfilter_rule} from './ipfilter';
import type {IInstance} from 'types/oam';
const inst = {id: 1, name: 'gw'} as IInstance;
const config = {filterType: 'blacklist' as const, action: 'drop' as const, cidr: '192.0.2.1', priority: 0, zone: 0};
beforeEach(() => {vi.stubGlobal('fetch', vi.fn()); localStorage.clear();});
afterEach(() => vi.unstubAllGlobals());
it('refuses invalid direct calls without changing or sending the rule', async () => {
 for (const delta of [{cidr: '999.1.1.1/32'}, {zone: 1}, {priority: 1.5}, {priority: NaN}, {priority: -1}, {priority: 65536}, {action: 'allow'}]) expect((await request_create_ipfilter_rule(inst, {...config, ...delta} as any)).status).toBe('invalid');
 expect(fetch).not.toHaveBeenCalled();
});
it('normalizes IPv4/IPv6 host CIDRs while preserving zero and omitting counters', async () => {
 for (const [input, output] of [['192.0.2.1', '192.0.2.1/32'], ['2001:db8::1', '2001:db8::1/128']]) {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({result: 'OK'}), {status: 200}));
  await request_create_ipfilter_rule(inst, {...config, cidr: input, packets: 4, isValid: true} as any);
  const wire = JSON.parse(vi.mocked(fetch).mock.lastCall![1]!.body as string);
  expect(wire).toEqual({...config, cidr: output});
 }
});
