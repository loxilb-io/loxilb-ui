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
	return (resp.data?.securityrateAttr ?? []) as ISecurityRateEntry[];
}

/**
 * Configure unified security rate limiting
 * Configures SYN flood protection, connection rate limiting, and UDP flood protection
 */
export async function request_configure_securityrate(
	instance: IInstance,
	data: ISecurityRateConfigMod,
): Promise<OpResult> {
	// Explicit payload: the page forwards the form ref verbatim, which also
	// carries the client-side isValid flag — send only ISecurityRateConfigMod fields.
	const payload: ISecurityRateConfigMod = {
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
 * Disable all security rate limiting and clear tracking state
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
