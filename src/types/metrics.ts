//---------------------------------------------------------
// Interfaces for /metrics/flowcount
//---------------------------------------------------------
export interface INetworkFlowStats {
	active_conntrack_count: number;
	active_flow_count_tcp: number;
	active_flow_count_udp: number;
	active_flow_count_sctp: number;
	inactive_flow_count: number;
}

//---------------------------------------------------------
// Interfaces for /metrics/hostcount
//---------------------------------------------------------
export interface IHostCount {
	healthy_host_count: number;
	unhealthy_host_count: number;
}

//---------------------------------------------------------
// Interfaces for /metrics/lbrulecount
//---------------------------------------------------------
export interface ILBRuleCount {
	lb_rule_count: number;
}

//---------------------------------------------------------
// Interfaces for /metrics/newflowcount
//---------------------------------------------------------
export interface INewFlowCount {
	new_flow_count: number;
}

//---------------------------------------------------------
// Interfaces for /metrics/requestcount
//---------------------------------------------------------
export interface IRequestCountPerService {
	name: string;
	value: number;
}

export interface IRequestCount {
	total_requests?: number;
	total_requests_per_service?: IRequestCountPerService[];
}

//---------------------------------------------------------
// Interfaces for  /metrics/errorcount
//---------------------------------------------------------
export interface IErrorCountPerService {
	name: string;
	value: number;
}

export interface IErrorCount {
	total_errors?: number;
	total_errors_per_service: IErrorCountPerService[];
}

//---------------------------------------------------------
// Interfaces for /metrics/processedtraffic
//---------------------------------------------------------
export interface IProcessedTraffic {
	processed_bytes: number;
	processed_tcp_bytes: number;
	processed_sctp_bytes: number;
	processed_udp_bytes: number;
	processed_packets: number;
}

//---------------------------------------------------------
// Interfaces for /metrics/lbprocessedtraffic
//---------------------------------------------------------
export interface ILbRuleInteractionItem {
	service: string;
	sip: string;
	dip: string;
	value: number;
}

export interface ILBProcessedTraffic {
	lb_rule_interaction_bytes: ILbRuleInteractionItem[];
	lb_rule_interaction_packets: ILbRuleInteractionItem[];
}

//---------------------------------------------------------
// Interfaces for /metrics/epdisttraffic
//---------------------------------------------------------
export interface IEndpointDistributionEntry {
	dip: string;
	value: number;
	ratio: number;
}

export interface IEndpointDistributionTraffic {
	[key: string]: IEndpointDistributionEntry[];
}

//---------------------------------------------------------
// Interfaces for /metrics/servicedisttraffic
//---------------------------------------------------------
export interface IServiceDistTrafficEntry {
	value: number;
	ratio: number;
}

export interface IServiceDistTrafficData {
	[key: string]: IServiceDistTrafficEntry;
}

//---------------------------------------------------------
// Interfaces /metrics/fwdrops
//---------------------------------------------------------
export interface IFirewallRuleDrop {
	fw_rule: string;
	value: number;
}

export interface IFirewallDropReport {
	total_fw_drops?: number;
	total_fw_drops_per_rule: IFirewallRuleDrop[];
}

//---------------------------------------------------------
// Interfaces for /metrics/reqcountperclient
//---------------------------------------------------------
//{
//  "additionalProp1": 0,
//  "additionalProp2": 0,
//  "additionalProp3": 0
//}

export interface IRequestCountPerClient {
	[key: string]: number;
}
