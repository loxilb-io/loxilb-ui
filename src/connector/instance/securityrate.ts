//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {ISecurityRateConfigMod, ISecurityRateEntry} from 'types/security';
import {IInstance} from 'types/oam';
import {ApiResult, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST, PUT_INST} from '../fetcher/fetcher_inst';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------

/**
 * Get unified security rate limiting configuration and statistics
 * Includes SYN flood (P0-5), connection rate limiting (P0-6), and UDP flood (P0-7)
 */
export async function query_get_securityrate_all(instance: IInstance): Promise<ISecurityRateEntry[]> {
	const resp = await GET_INST<GwGetResp<'/config/securityrate/all'>>(instance, `/config/securityrate/all`);
	return (resp.data?.securityrateAttr ?? []) as ISecurityRateEntry[];
}

/**
 * Configure unified security rate limiting
 * Configures SYN flood protection, connection rate limiting, and UDP flood protection
 */
export async function request_configure_securityrate(
	instance: IInstance,
	data: ISecurityRateConfigMod,
): Promise<ApiResult> {
	// Explicit payload: the page forwards the form ref verbatim, which also
	// carries the client-side isValid flag — send only ISecurityRateConfigMod fields.
	const payload: ISecurityRateConfigMod = {
		synEnabled: data.synEnabled,
		synThreshold: data.synThreshold,
		cookieThreshold: data.cookieThreshold,
		connRateEnabled: data.connRateEnabled,
		ratePerSec: data.ratePerSec,
		concurrentLimit: data.concurrentLimit,
		udpEnabled: data.udpEnabled,
		udpPktThreshold: data.udpPktThreshold,
		udpBandwidthMB: data.udpBandwidthMB,
		whitelistIps: data.whitelistIps,
	};
	const resp = await POST_INST(instance, `/config/securityrate`, payload);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'Security Rate Limiting');
		return {status: 'error', error: errorMessage};
	}
	return {status: 'success'};
}

/**
 * Disable all security rate limiting and clear tracking state
 * Disables SYN flood, connection rate, and UDP flood protection
 */
export async function request_disable_securityrate(instance: IInstance): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/securityrate`);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'Security Rate Limiting');
		return {status: 'error', error: errorMessage};
	}
	return {status: 'success'};
}

/**
 * Reset security rate limiting statistics
 * Resets all accumulated statistics counters for SYN/Conn/UDP to zero
 */
export async function request_reset_securityrate_stats(instance: IInstance): Promise<ApiResult> {
	const resp = await PUT_INST(instance, `/config/securityrate/reset`, {});
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'Security Rate Limiting Statistics Reset');
		return {status: 'error', error: errorMessage};
	}
	return {status: 'success'};
}
