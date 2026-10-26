import {validGatewayCidr} from './network_prefix';
import type {ISecurityRateConfigMod, ISecurityRateEntry} from './security';

export const AGGREGATE_RATE_FIELDS = ['aggregateSynThreshold', 'aggregateConnRatePerSec', 'aggregateUdpPktThreshold', 'aggregateUdpBandwidthMB'] as const;
export const SOURCE_RATE_FIELDS = ['synThreshold', 'cookieThreshold', 'ratePerSec', 'udpPktThreshold', 'udpBandwidthMB'] as const;
export const SECURITY_RATE_FLAGS = ['synEnabled', 'connRateEnabled', 'udpEnabled'] as const;
const COUNTERS = ['synBlocked', 'synPassed', 'synCookies', 'connBlocked', 'connPassed', 'concurrentBlocked', 'udpBlocked', 'udpPassed', 'udpBytesBlocked', 'udpBytesPassed', 'uniqueIps', 'aggregateSynBlocked', 'aggregateConnBlocked', 'aggregateUdpBlocked', 'trackingFailures', 'unsupportedPacketBlocked'];
const integer = (n: unknown, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max;
const maxFor = (field: string) => field.endsWith('BandwidthMB') ? 4095 : 16777216;

/** Shared form / wire backstop. Invalid input must never become a default. */
export function validateSecurityRateConfig(data: ISecurityRateConfigMod): string[] {
	const issues: string[] = [];
	for (const field of SECURITY_RATE_FLAGS) if (typeof data[field] !== 'boolean') issues.push(field);
	for (const field of SOURCE_RATE_FIELDS) if (!integer(data[field], maxFor(field))) issues.push(field);
	for (const field of AGGREGATE_RATE_FIELDS) if (data[field] !== undefined && !integer(data[field], maxFor(field))) issues.push(field);
	if (data.synEnabled && (!(data.synThreshold > 0) || !(data.cookieThreshold < data.synThreshold))) issues.push('synThreshold');
	if (data.connRateEnabled && !(data.ratePerSec > 0)) issues.push('ratePerSec');
	if (data.udpEnabled && (!(data.udpPktThreshold > 0) || !(data.udpBandwidthMB > 0))) issues.push('udpPktThreshold');
	if (!SECURITY_RATE_FLAGS.some(field => data[field]) && !AGGREGATE_RATE_FIELDS.some(field => (data[field] ?? 0) > 0)) issues.push('enabled');
	if (data.whitelistIps !== undefined && (!Array.isArray(data.whitelistIps) || data.whitelistIps.length > 1024 || !data.whitelistIps.every(validGatewayCidr))) issues.push('whitelistIps');
	return issues;
}

export function aggregateRateDeclared(params: Record<string, unknown> | undefined): boolean {
	return AGGREGATE_RATE_FIELDS.every(field => params?.[field] !== undefined);
}

/** A malformed successful response is an error, never proof of absence. */
export function parseSecurityRateRows(value: unknown): ISecurityRateEntry[] {
	if (!Array.isArray(value) || value.length > 1) throw new Error('Invalid security-rate readback.');
	for (const row of value) {
		if (!row || typeof row !== 'object' || Array.isArray(row) || !(SOURCE_RATE_FIELDS.some(field => field in row) || AGGREGATE_RATE_FIELDS.every(field => field in row))) throw new Error('Invalid security-rate readback.');
		for (const field of SECURITY_RATE_FLAGS) if (row[field] !== undefined && typeof row[field] !== 'boolean') throw new Error('Invalid security-rate readback.');
		for (const [field, n] of Object.entries(row)) {
			if (field === 'whitelistIps') {
				if (n !== null && (!Array.isArray(n) || !n.every(cidr => typeof cidr === 'string'))) throw new Error('Invalid security-rate readback.');
			} else if (!SECURITY_RATE_FLAGS.includes(field as typeof SECURITY_RATE_FLAGS[number]) && typeof n === 'number' && (!Number.isSafeInteger(n) || n < 0)) throw new Error('Invalid security-rate readback.');
		}
		for (const field of [...SOURCE_RATE_FIELDS, ...AGGREGATE_RATE_FIELDS, ...COUNTERS]) if (row[field] !== undefined && typeof row[field] !== 'number') throw new Error('Invalid security-rate readback.');
	}
	return value.map(row => ({...row, whitelistIps: row.whitelistIps ?? []})) as ISecurityRateEntry[];
}
