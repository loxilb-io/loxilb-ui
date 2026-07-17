//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {query_get_apikey_all} from 'connector/instance/ai';
import {query_get_bfd_all} from 'connector/instance/bfd';
import {query_get_conntrack_all} from 'connector/instance/conn_track';
import {query_get_endpoint_all} from 'connector/instance/endpoint';
import {query_get_fdb_all} from 'connector/instance/fdb';
import {query_get_firewall_rules} from 'connector/instance/firewall';
import {query_get_ipfilter_all} from 'connector/instance/ipfilter';
import {query_get_ipsec_ca_certificate_all, query_get_ipsec_certificate_all, query_get_ipsec_config, query_get_ipsec_sa_all, query_get_ipsec_stats, query_get_ipsec_tunnel_all} from 'connector/instance/ipsec';
import {query_get_ipv4_all, query_get_ipv6_all} from 'connector/instance/ip';
import {query_get_load_balancer_config_all} from 'connector/instance/load_balancer';
import {query_get_mirror_all} from 'connector/instance/mirror';
import {query_get_port_all} from 'connector/instance/port';
import {query_get_qos_policy_all} from 'connector/instance/qos';
import {query_get_route_all} from 'connector/instance/route_attr';
import {query_get_securityrate_all} from 'connector/instance/securityrate';
import {query_get_sni_certificates} from 'connector/instance/sni_certificates';
import {query_get_ha_state_all, query_get_metadata} from 'connector/instance/status';
import {query_get_synflood_all} from 'connector/instance/synflood';
import {query_get_vlan_all} from 'connector/instance/vlan';
import {query_get_vxlan_all} from 'connector/instance/vxlan';
import {IPostParamFieldDesc} from 'types/global';
import {IInstance} from 'types/oam';
import {useQueryInstanceData} from './common';

//---------------------------------------------------------
// Functions
//---------------------------------------------------------
export function useMetadata(instance: IInstance | null, api_endpoint: string) {
	const {data, isFetched} = useQueryInstanceData(['metadata'], query_get_metadata, instance, true, true);

	const get_param_fields = (url: string): Record<string, IPostParamFieldDesc> | undefined => data?.[url]?.fields;

	const get_param_desc_by_path = (url: string, path?: string[]): IPostParamFieldDesc | undefined => {
		let current: any = get_param_fields(url);
		if (!path || path.length === 0) return current;

		for (const segment of path) {
			if (!current || typeof current !== 'object') return undefined;
			else {
				current = current.properties?.[segment] ?? current[segment];
				if (!current) return undefined;
			}
		}

		return current as IPostParamFieldDesc;
	};

	return {
		full_metadata: data,
		is_fetched: isFetched,
		param_fields: get_param_fields(api_endpoint),
		get_param: (path?: string[]) => get_param_desc_by_path(api_endpoint, path),
	};
}

export function useBFD(instance: IInstance | null) {
	return useQueryInstanceData(['bfd'], query_get_bfd_all, instance);
}

export function useConntrack(instance: IInstance | null) {
	return useQueryInstanceData(['conntrack'], query_get_conntrack_all, instance, true);
}

export function useEndpoints(instance: IInstance | null) {
	return useQueryInstanceData(['endpoints'], query_get_endpoint_all, instance);
}

export function useFDB(instance: IInstance | null) {
	return useQueryInstanceData(['fdb'], query_get_fdb_all, instance);
}

export function useFirewallRules(instance: IInstance | null) {
	return useQueryInstanceData(['firewall'], query_get_firewall_rules, instance);
}

export function useIPFilterRules(instance: IInstance | null) {
	return useQueryInstanceData(['ipfilter'], query_get_ipfilter_all, instance);
}

export function useHAState(instance: IInstance | null) {
	return useQueryInstanceData(['ha_state'], query_get_ha_state_all, instance);
}

export function useIPAttr(instance: IInstance | null, family: 'ipv4' | 'ipv6' = 'ipv4') {
	return useQueryInstanceData(['ip_attr', family], family === 'ipv6' ? query_get_ipv6_all : query_get_ipv4_all, instance);
}

export function useLoadBalancerConfig(instance: IInstance | null) {
	return useQueryInstanceData(['lb_data'], query_get_load_balancer_config_all, instance);
}

export function useMirrors(instance: IInstance | null) {
	return useQueryInstanceData(['mirrors'], query_get_mirror_all, instance);
}

export function usePortAttr(instance: IInstance | null) {
	return useQueryInstanceData(['port_attr'], query_get_port_all, instance);
}

export function useQOSPolicies(instance: IInstance | null) {
	return useQueryInstanceData(['qos'], query_get_qos_policy_all, instance);
}

export function useRouteAttr(instance: IInstance | null) {
	return useQueryInstanceData(['route_attr'], query_get_route_all, instance);
}

export function useVLANAttr(instance: IInstance | null) {
	return useQueryInstanceData(['vlan_attr'], query_get_vlan_all, instance);
}

export function useVxlanAttr(instance: IInstance | null) {
	return useQueryInstanceData(['vxlan_attr'], query_get_vxlan_all, instance);
}

export function useSYNFlood(instance: IInstance | null) {
	return useQueryInstanceData(['synflood'], query_get_synflood_all, instance);
}

export function useSecurityRate(instance: IInstance | null) {
	return useQueryInstanceData(['securityrate'], query_get_securityrate_all, instance);
}

export function useSNICertificates(instance: IInstance | null) {
	return useQueryInstanceData(['sni_certificates'], query_get_sni_certificates, instance);
}

export function useApiKeys(instance: IInstance | null) {
	return useQueryInstanceData(['ai_apikeys'], query_get_apikey_all, instance);
}

export function useIPsecConfig(instance: IInstance | null) {
	return useQueryInstanceData(['ipsec_config'], query_get_ipsec_config, instance);
}

export function useIPsecTunnels(instance: IInstance | null) {
	return useQueryInstanceData(['ipsec_tunnels'], query_get_ipsec_tunnel_all, instance);
}

export function useIPsecSAs(instance: IInstance | null) {
	return useQueryInstanceData(['ipsec_sas'], query_get_ipsec_sa_all, instance);
}

export function useIPsecStats(instance: IInstance | null) {
	return useQueryInstanceData(['ipsec_stats'], query_get_ipsec_stats, instance);
}

export function useIPsecCertificates(instance: IInstance | null) {
	return useQueryInstanceData(['ipsec_certs'], query_get_ipsec_certificate_all, instance);
}

export function useIPsecCACertificates(instance: IInstance | null) {
	return useQueryInstanceData(['ipsec_ca_certs'], query_get_ipsec_ca_certificate_all, instance);
}
