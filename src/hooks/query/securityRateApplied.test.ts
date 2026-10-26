import {describe, expect, it} from 'vitest';
import {ISecurityRateConfigMod, ISecurityRateEntry} from 'types/security';
import {securityRateApplied, securityRateDisabled} from './securityRateApplied';

const want = {synEnabled: false, connRateEnabled: false, udpEnabled: false, synThreshold: 0, cookieThreshold: 0, ratePerSec: 0, udpPktThreshold: 0, udpBandwidthMB: 0, aggregateSynThreshold: 10, whitelistIps: []} satisfies ISecurityRateConfigMod;
describe('security-rate stored confirmation', () => {
	it('accepts omitted zero flags/thresholds but requires the new aggregate value', () => {
		expect(securityRateApplied(want)([{aggregateSynThreshold: 10} as ISecurityRateEntry])).toBe(true);
		expect(securityRateApplied(want)([{aggregateSynThreshold: 9} as ISecurityRateEntry])).toBe(false);
		expect(securityRateApplied(want)([])).toBe(false);
	});
	it('requires whitelist replacement and compares order independently', () => {
		expect(securityRateApplied(want)([{...want, whitelistIps: ['192.0.2.1/32']} as ISecurityRateEntry])).toBe(false);
		expect(securityRateApplied({...want, whitelistIps: ['a', 'b']})([{...want, whitelistIps: ['b', 'a']} as ISecurityRateEntry])).toBe(true);
	});
	it('cannot confirm disable while an aggregate-only budget remains', () => {
		expect(securityRateDisabled([{aggregateSynThreshold: 10} as ISecurityRateEntry])).toBe(false);
		expect(securityRateDisabled([{whitelistIps: ['192.0.2.1/32']} as ISecurityRateEntry])).toBe(false);
		expect(securityRateDisabled([{} as ISecurityRateEntry])).toBe(true);
		expect(securityRateDisabled([])).toBe(true);
	});
});
