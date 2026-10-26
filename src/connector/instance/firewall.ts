//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IFirewallDeleteFilter, IFirewallRule} from 'types/firewall';
import {IInstance} from 'types/oam';
import {assertOk} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {runOp} from '../fetcher/opResultAdapter';
import type {GwGetResp} from 'api';
import {parseFirewallRows, validateFirewallConfig} from 'types/firewall_policy';
import {STATUS_LOCALE_KEYS} from '../fetcher/opResultCodes';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_firewall_rules(instance: IInstance): Promise<IFirewallRule[]> {
	const resp = await GET_INST<GwGetResp<'/config/firewall/all'>>(instance, `/config/firewall/all`);
	assertOk(resp, 'Get Firewall');
	return parseFirewallRows(resp.data?.fwAttr);
}

export async function request_create_firewall_rule(instance: IInstance, data: IFirewallRule): Promise<OpResult> {
	const issues = validateFirewallConfig(data);
	if (issues.length) return {status: 'invalid', retryable: false, code: 'firewall.create.client_invalid', localeKey: STATUS_LOCALE_KEYS.invalid, rawDetail: issues.join(', ')};
	const {counter, ...opts} = data.opts;
	return runOp('firewall.create_firewall_rule', () => POST_INST(instance, `/config/firewall`, {ruleArguments: data.ruleArguments, opts}));
}

export async function request_delete_all_firewall_rules(instance: IInstance, filter?: IFirewallDeleteFilter): Promise<OpResult> {
	const params = new URLSearchParams();

	if (filter?.sourceIP) params.append('sourceIP', filter.sourceIP);
	if (filter?.destinationIP) params.append('destinationIP', filter.destinationIP);
	if (filter?.minSourcePort !== undefined) params.append('minSourcePort', String(filter.minSourcePort));
	if (filter?.maxSourcePort !== undefined) params.append('maxSourcePort', String(filter.maxSourcePort));
	if (filter?.minDestinationPort !== undefined) params.append('minDestinationPort', String(filter.minDestinationPort));
	if (filter?.maxDestinationPort !== undefined) params.append('maxDestinationPort', String(filter.maxDestinationPort));
	if (filter?.protocol !== undefined) params.append('protocol', String(filter.protocol));
	if (filter?.portName) params.append('portName', filter.portName);
	if (filter?.preference !== undefined) params.append('preference', String(filter.preference));

	const url = `/config/firewall${params.toString() ? `?${params.toString()}` : ''}`;
	return runOp('firewall.delete_all_firewall_rules', () => DELETE_INST(instance, url));
}
