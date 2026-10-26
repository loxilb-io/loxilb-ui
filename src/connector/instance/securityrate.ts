//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {ISecurityRateConfigMod, ISecurityRateEntry} from 'types/security';
import {IInstance} from 'types/oam';
import {assertOk} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST, PUT_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {runOp} from '../fetcher/opResultAdapter';
import type {GwGetResp} from 'api';
import {parseSecurityRateRows, validateSecurityRateConfig} from 'types/security_rate_policy';
import {STATUS_LOCALE_KEYS} from '../fetcher/opResultCodes';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------

/**
 * Get unified security rate limiting configuration and statistics
 * Includes SYN flood, connection rate limiting, and UDP flood protection
 */
export async function query_get_securityrate_all(instance: IInstance): Promise<ISecurityRateEntry[]> {
	const resp = await GET_INST<GwGetResp<'/config/securityrate/all'>>(instance, `/config/securityrate/all`);
	assertOk(resp, 'Get Security Rate');
	return parseSecurityRateRows(resp.data?.securityrateAttr);
}

/**
 * Configure unified security rate limiting
 * Configures SYN flood protection, connection rate limiting, and UDP flood protection
 */
export async function request_configure_securityrate(
	instance: IInstance,
	data: ISecurityRateConfigMod,
): Promise<OpResult> {
	const issues = validateSecurityRateConfig(data);
	if (issues.length > 0) return {status: 'invalid', retryable: false, code: 'securityrate.configure.client_invalid', localeKey: STATUS_LOCALE_KEYS.invalid, rawDetail: issues.join(', ')};
	// Explicit payload: the page forwards the form ref verbatim, which also
	// carries the client-side isValid flag — send only ISecurityRateConfigMod fields.
	const payload: ISecurityRateConfigMod = {
		...(data.aggregateSynThreshold !== undefined ? {aggregateSynThreshold: data.aggregateSynThreshold} : {}),
		...(data.aggregateConnRatePerSec !== undefined ? {aggregateConnRatePerSec: data.aggregateConnRatePerSec} : {}),
		...(data.aggregateUdpPktThreshold !== undefined ? {aggregateUdpPktThreshold: data.aggregateUdpPktThreshold} : {}),
		...(data.aggregateUdpBandwidthMB !== undefined ? {aggregateUdpBandwidthMB: data.aggregateUdpBandwidthMB} : {}),
		synEnabled: data.synEnabled,
		synThreshold: data.synThreshold,
		cookieThreshold: data.cookieThreshold,
		connRateEnabled: data.connRateEnabled,
		ratePerSec: data.ratePerSec,
		udpEnabled: data.udpEnabled,
		udpPktThreshold: data.udpPktThreshold,
		udpBandwidthMB: data.udpBandwidthMB,
		whitelistIps: data.whitelistIps,
	};
	return runOp('securityrate.configure', () => POST_INST(instance, `/config/securityrate`, payload));
}

/**
 * Disable source and aggregate rate limiting and clear the whitelist.
 * Existing counters remain; resetting statistics is a separate operation.
 * Disables SYN flood, connection rate, and UDP flood protection
 */
export async function request_disable_securityrate(instance: IInstance): Promise<OpResult> {
	return runOp('securityrate.disable', () => DELETE_INST(instance, `/config/securityrate`));
}

/**
 * Reset security rate limiting statistics
 * Resets all accumulated statistics counters for SYN/Conn/UDP to zero
 */
export async function request_reset_securityrate_stats(instance: IInstance): Promise<OpResult> {
	return runOp('securityrate.reset_stats', () => PUT_INST(instance, `/config/securityrate/reset`, {}));
}
