import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {query_get_firewall_rules, request_create_firewall_rule} from './firewall';
import type {IInstance} from 'types/oam';
const inst={id:1,name:'gw'} as IInstance;
const rule={ruleArguments:{sourceIP:'192.0.2.1/32',preference:0},opts:{drop:true}} as any;
beforeEach(()=>{vi.stubGlobal('fetch',vi.fn());localStorage.clear();});
afterEach(()=>vi.unstubAllGlobals());
it('blocks invalid connector calls before wire and excludes read-only state', async()=>{
 expect((await request_create_firewall_rule(inst,{...rule,ruleArguments:{...rule.ruleArguments,preference:NaN}})).status).toBe('invalid');
 expect(fetch).not.toHaveBeenCalled();
 vi.mocked(fetch).mockResolvedValue(new Response('{"result":"OK"}',{status:200}));
 await request_create_firewall_rule(inst,{...rule,opts:{...rule.opts,counter:'5:200'},isValid:true});
 expect(JSON.parse(vi.mocked(fetch).mock.lastCall![1]!.body as string)).toEqual(rule);
});
it('does not convert a malformed success response to confirmed absence',async()=>{
 vi.mocked(fetch).mockResolvedValue(new Response('{}',{status:200}));
 await expect(query_get_firewall_rules(inst)).rejects.toThrow('Invalid firewall readback.');
});
it('never sends a positive minimum with an omitted range maximum',async()=>{
 for (const min of ['minSourcePort','minDestinationPort']) {
  expect((await request_create_firewall_rule(inst,{...rule,ruleArguments:{...rule.ruleArguments,[min]:8080}})).status).toBe('invalid');
 }
 expect(fetch).not.toHaveBeenCalled();
});
