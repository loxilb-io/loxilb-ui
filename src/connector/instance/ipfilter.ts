//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {isValidIPAddress} from 'common';
import {IIPFilterEntry, IIPFilterDeleteParams} from 'types/security';
import {IInstance} from 'types/oam';
import {assertOk} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {runOp} from '../fetcher/opResultAdapter';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_ipfilter_all(instance: IInstance): Promise<IIPFilterEntry[]> {
	const resp = await GET_INST<GwGetResp<'/config/ipfilter/all'>>(instance, `/config/ipfilter/all`);
	assertOk(resp, 'Get IP Filter');
	return (resp.data?.ipFilterAttr ?? []) as IIPFilterEntry[];
}

// The gateway only parses CIDR notation, but a bare host IP is a valid filter
// intent — normalize it to a single-host prefix instead of letting the
// request fail.
function toHostCidr(cidr: string): string {
	const trimmed = cidr.trim();
	if (!isValidIPAddress(trimmed)) return trimmed;
	return trimmed.includes(':') ? `${trimmed}/128` : `${trimmed}/32`;
}

export async function request_create_ipfilter_rule(instance: IInstance, data: IIPFilterEntry): Promise<OpResult> {
	// Explicit payload: the page forwards the form ref verbatim, which also
	// carries the client-side isValid flag — send only IIPFilterEntry schema
	// fields (drop isValid + the read-only packets/bytes counters).
	const payload: IIPFilterEntry = {
		filterType: data.filterType,
		cidr: toHostCidr(data.cidr),
		zone: data.zone,
		priority: data.priority,
		action: data.action,
	};
	return runOp('ipfilter.create_ipfilter_rule', () => POST_INST(instance, `/config/ipfilter`, payload));
}

export async function request_delete_ipfilter_rule(instance: IInstance, params: IIPFilterDeleteParams): Promise<OpResult> {
	const urlParams = new URLSearchParams();
	urlParams.append('filterType', params.filterType);
	urlParams.append('cidr', params.cidr);
	if (params.zone !== undefined) {
		urlParams.append('zone', String(params.zone));
	}

	const url = `/config/ipfilter?${urlParams.toString()}`;
	return runOp('ipfilter.delete_ipfilter_rule', () => DELETE_INST(instance, url));
}
