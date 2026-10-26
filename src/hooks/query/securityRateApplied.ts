import {ISecurityRateConfigMod, ISecurityRateEntry} from 'types/security';

const FLAGS = ['synEnabled', 'connRateEnabled', 'udpEnabled'] as const;
const NUMBERS = ['synThreshold', 'cookieThreshold', 'ratePerSec', 'udpPktThreshold', 'udpBandwidthMB', 'aggregateSynThreshold', 'aggregateConnRatePerSec', 'aggregateUdpPktThreshold', 'aggregateUdpBandwidthMB'] as const;

/** Stored readback only; traffic and effective datapath need separate evidence. */
export const securityRateApplied = (want: ISecurityRateConfigMod) => (rows: ISecurityRateEntry[]): boolean =>
	rows.length === 1 && FLAGS.every(f => Boolean(rows[0][f]) === Boolean(want[f])) &&
	NUMBERS.every(f => want[f] === undefined || (rows[0][f] ?? 0) === want[f]) &&
	JSON.stringify([...(rows[0].whitelistIps ?? [])].sort()) === JSON.stringify([...(want.whitelistIps ?? [])].sort());

export const securityRateDisabled = (rows: ISecurityRateEntry[]): boolean =>
	rows.length === 0 || (rows.length === 1 && FLAGS.every(f => !rows[0][f]) &&
		(rows[0].whitelistIps ?? []).length === 0 &&
		(['aggregateSynThreshold', 'aggregateConnRatePerSec', 'aggregateUdpPktThreshold', 'aggregateUdpBandwidthMB'] as const).every(f => (rows[0][f] ?? 0) === 0));
