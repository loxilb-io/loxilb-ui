import {describe, expect, it} from 'vitest';
import {AGGREGATE_RATE_FIELDS, aggregateRateDeclared, parseSecurityRateRows, validateSecurityRateConfig} from './security_rate_policy';
const config = {synEnabled: false, connRateEnabled: false, udpEnabled: true, synThreshold: 0, cookieThreshold: 0, ratePerSec: 0, udpPktThreshold: 100, udpBandwidthMB: 1, whitelistIps: []};
describe('security-rate contract at the wire boundary', () => {
 it('rejects every numeric wrap/coercion and invalid enabled combination', () => {
  for (const field of ['synThreshold', 'cookieThreshold', 'ratePerSec', 'udpPktThreshold', 'udpBandwidthMB', ...AGGREGATE_RATE_FIELDS]) {
   for (const n of [-1, 1.5, NaN, Infinity, '100', 16777217]) expect(validateSecurityRateConfig({...config, [field]: n} as any).length).toBeGreaterThan(0);
  }
  expect(validateSecurityRateConfig({...config, udpEnabled: false})).toContain('enabled');
  expect(validateSecurityRateConfig({...config, synEnabled: true, synThreshold: 10, cookieThreshold: 10})).toContain('synThreshold');
  expect(validateSecurityRateConfig({...config, whitelistIps: ['999.1.1.1/32']})).toContain('whitelistIps');
  expect(validateSecurityRateConfig({...config, udpEnabled: false, aggregateSynThreshold: 120})).toEqual([]);
 });
 it('requires all four aggregate metadata fields, including on older gateways', () => {
  expect(aggregateRateDeclared(undefined)).toBe(false);
  expect(aggregateRateDeclared({aggregateSynThreshold: {}})).toBe(false);
  expect(aggregateRateDeclared(Object.fromEntries(AGGREGATE_RATE_FIELDS.map(f => [f, {}])))).toBe(true);
 });
 it('never turns malformed reads into confirmed absence', () => {
  for (const body of [undefined, null, {}, [{}], [null], [{synThreshold: '100'}], [{synThreshold: NaN}], [{synThreshold: 100, synEnabled: 'false'}], [config, config]]) expect(() => parseSecurityRateRows(body)).toThrow();
  expect(parseSecurityRateRows([])).toEqual([]);
  expect(parseSecurityRateRows([{synThreshold: 100, whitelistIps: null}])[0].whitelistIps).toEqual([]);
  expect(parseSecurityRateRows([{synThreshold: 100, aggregateSynThreshold: 0}])).toHaveLength(1);
 });
});
it('accepts the complete aggregate signature of a fresh zero-valued Gateway',()=>{
 const fresh={aggregateSynThreshold:0,aggregateConnRatePerSec:0,aggregateUdpPktThreshold:0,aggregateUdpBandwidthMB:0,whitelistIps:null};
 expect(parseSecurityRateRows([fresh])).toEqual([{...fresh,whitelistIps:[]}]);
 for(const bad of [{aggregateSynThreshold:0},{whitelistIps:null},{...fresh,aggregateUdpBandwidthMB:'0'},{...fresh,aggregateConnRatePerSec:NaN}])expect(()=>parseSecurityRateRows([bad])).toThrow();
});
