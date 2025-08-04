//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IFirewallDeleteFilter, IFirewallRule} from 'types/firewall';
import {IInstance} from 'types/oam';
import {ApiResult} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_firewall_rules(instance: IInstance): Promise<IFirewallRule[]> {
	const resp = await GET_INST(instance, `/config/firewall/all`);
	return (resp.data?.fwAttr as IFirewallRule[]) ?? [];
}

export async function request_create_firewall_rule(instance: IInstance, data: IFirewallRule): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/firewall`, data);
	if (resp.code !== 200) return {status: 'error', error: `Failed to create firewall rule: ${resp.message}`};
	else return {status: 'success'};
}

export async function request_delete_all_firewall_rules(instance: IInstance, filter?: IFirewallDeleteFilter): Promise<ApiResult> {
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
	const resp = await DELETE_INST(instance, url);

	if (resp.code !== 200) return {status: 'error', error: `Failed to delete all firewall rules: ${resp.message}`};
	else return {status: 'success'};
}
