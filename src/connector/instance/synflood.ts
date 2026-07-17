//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {ISYNFloodConfigMod, ISYNFloodEntry} from 'types/security';
import {IInstance} from 'types/oam';
import {ApiResult, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------

/**
 * Get SYN flood protection configuration and statistics
 */
export async function query_get_synflood_all(instance: IInstance): Promise<ISYNFloodEntry[]> {
	const resp = await GET_INST<GwGetResp<'/config/synflood/all'>>(instance, `/config/synflood/all`);
	return (resp.data?.synfloodAttr ?? []) as ISYNFloodEntry[];
}

/**
 * Enable or configure SYN flood protection
 */
export async function request_configure_synflood(instance: IInstance, data: ISYNFloodConfigMod): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/synflood`, data);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'SYN Flood Protection');
		return {status: 'error', error: errorMessage};
	}
	return {status: 'success'};
}

/**
 * Disable SYN flood protection and clear all tracking state
 */
export async function request_disable_synflood(instance: IInstance): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/synflood`);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'SYN Flood Protection');
		return {status: 'error', error: errorMessage};
	}
	return {status: 'success'};
}
