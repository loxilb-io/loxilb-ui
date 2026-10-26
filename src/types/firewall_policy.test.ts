import {expect, it} from 'vitest';
import {firewallApplied, firewallRowId, firewallsAbsent, parseFirewallRows, validateFirewallConfig} from './firewall_policy';
import type {IFirewallRule} from './firewall';
const rule = {ruleArguments: {sourceIP: '192.0.2.17/24', destinationIP: '198.51.100.1/32', protocol: 6, preference: 0}, opts: {drop: true}} as IFirewallRule;
it('keeps preference in row identity, deletion, and readback confirmation', () => {
 const peer = {...rule, ruleArguments: {...rule.ruleArguments, preference: 100}};
 expect(firewallRowId(rule)).not.toBe(firewallRowId(peer));
 expect(firewallApplied(rule)([peer])).toBe(false);
 expect(firewallsAbsent([rule])([peer])).toBe(true);
 expect(firewallApplied(rule)([{...rule, ruleArguments: {...rule.ruleArguments, sourceIP: '192.0.2.0/24'}}])).toBe(true);
 expect(firewallsAbsent([rule])([rule, peer])).toBe(false);
 expect(firewallApplied(rule)([{...rule, opts: {allow: true} as any}])).toBe(false);
});
it('rejects unsafe bounds, conflicting verdicts and invalid direct input', () => {
 for (const [field,n] of [['protocol',256], ['preference',65536], ['minSourcePort',1.5], ['minDestinationPort',NaN], ['minDestinationPort',-1]]) expect(validateFirewallConfig({...rule, ruleArguments: {...rule.ruleArguments,[field]:n}}).length).toBeGreaterThan(0);
 expect(validateFirewallConfig({...rule, opts: {...rule.opts, allow: true}})).toContain('verdict');
 expect(validateFirewallConfig({...rule, opts: {...rule.opts, fwMark:4294967296}})).toContain('options');
 expect(validateFirewallConfig({...rule, ruleArguments:{...rule.ruleArguments,sourceIP:'010.0.0.1/32'}})).toContain('sourceIP');
 expect(validateFirewallConfig(rule)).toEqual([]);
});
it('accepts explicit null empty lists and derived SNAT marks, not malformed reads', () => {
 expect(parseFirewallRows(null)).toEqual([]);
 expect(() => parseFirewallRows(undefined)).toThrow();
 expect(() => parseFirewallRows([{}])).toThrow();
 expect(parseFirewallRows([{...rule,opts:{doSnat:true,toIP:'192.0.2.9',fwMark:2147483649}}])).toHaveLength(1);
});
it('treats an omitted port-range maximum as the wire default zero', () => {
 for (const [min,max] of [['minSourcePort','maxSourcePort'],['minDestinationPort','maxDestinationPort']] as const) {
  expect(validateFirewallConfig({...rule,ruleArguments:{...rule.ruleArguments,[min]:8080}})).toContain(max);
  expect(validateFirewallConfig({...rule,ruleArguments:{...rule.ruleArguments,[min]:8080,[max]:0}})).toContain(max);
  expect(validateFirewallConfig({...rule,ruleArguments:{...rule.ruleArguments,[min]:8080,[max]:8080}})).toEqual([]);
 }
});
