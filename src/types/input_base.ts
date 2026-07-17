//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface IInputBase {
	interface: string;
	url: string;
	path?: string[] | string;
}

export const INPUT_PARAM_LIST: IInputBase[] = [
	{interface: 'IAccessNetworkTunnel', url: '/config/session', path: ['accessNetworkTunnel']},
	{interface: 'IBfdInput', url: '/config/bfd'},
	{interface: 'IConditionSet', url: '/config/bgp/policy/definitions', path: ['statements', 'items', 'conditions']},
	{interface: 'IActionSet', url: '/config/bgp/policy/definitions', path: ['statements', 'items', 'actions']},
	{interface: 'IAsPathPrepend', url: '/config/bgp/policy/definitions', path: ['statements', 'actions', 'bgpActions', 'setAsPathPrepend']},
	{interface: 'IBgpActions', url: '/config/bgp/policy/definitions', path: ['statements', 'actions', 'bgpActions']},
	{interface: 'IBgpSetCommunity', url: '/config/bgp/policy/definitions', path: ['statements', 'actions', 'bgpActions', 'setCommunity']},
	{interface: 'IAsPathLength', url: '/config/bgp/policy/definitions', path: ['statements', 'conditions', 'bgpConditions', 'asPathLength']},
	{interface: 'IAsPathSet', url: '/config/bgp/policy/definitions', path: ['statements', 'conditions', 'bgpConditions', 'matchAsPathSet']},
	{interface: 'IBgpConditions', url: '/config/bgp/policy/definitions', path: ['statements', 'conditions', 'bgpConditions']},
	{interface: 'IMatchSet', url: '/config/bgp/policy/definitions', path: ['statements', 'conditions', 'matchPrefixSet']},
	{interface: 'IBGPDefinedSetInput', url: '/config/bgp/policy/definedsets/{defineset_type}'},
	{interface: 'IBgpNeighborInput', url: '/config/bgp/neigh'},
	{interface: 'IBgpPolicy', url: '/config/bgp/policy/definitions'},
	{interface: 'IStatement', url: '/config/bgp/policy/definitions', path: ['statements']},
	{interface: 'ICoreNetworkTunnel', url: '/config/session', path: ['coreNetworkTunnel']},
	{interface: 'INeighborAttr', url: '/config/neighbor'},
	{interface: 'IEndpointInput', url: '/config/endpoint'},
	{interface: 'IEndpoint', url: '/config/endpoint'},
	{interface: 'IFdbAttribute', url: '/config/fdb'},
	{interface: 'IFirewallRule', url: '/config/firewall'},
	{interface: 'IOptions', url: '/config/firewall', path: ['opts']},
	{interface: 'IRuleArguments', url: '/config/firewall', path: ['ruleArguments']},
	{interface: 'IInstanceInput', url: '/config/instance'},
	{interface: 'IIpAttributeInput', url: '/config/ipv4address'},
	{interface: 'IServiceConfiguration', url: '/config/loadbalancer'},
	{interface: 'IMirrorInfo', url: '/config/mirror', path: ['mirrorInfo']},
	{interface: 'IMirrorAttribute', url: '/config/mirror'},
	{interface: 'IPolicyInfo', url: '/config/policy', path: ['policyInfo']},
	{interface: 'IPolicyAttribute', url: '/config/policy'},
	{interface: 'ITargetObject', url: '/config/policy', path: ['targetObject']},
	{interface: 'IRouteAttrInput', url: '/config/route'},
	{interface: 'IServiceArguments', url: '/config/loadbalancer', path: ['serviceArguments']},
	{interface: 'ISessionAttribute', url: '/config/session'},
	{interface: 'IUlclArgument', url: '/config/sessionulcl', path: ['ulclArgument']},
	{interface: 'IUlclAttribute', url: '/config/sessionulcl'},
	{interface: 'IVipAttribute', url: '/config/cistate'},
	{interface: 'IVlanInput', url: '/config/vlan'},
	{interface: 'IVlanMemberInput', url: '/config/vlan/{vlan_id}/member'},
	{interface: 'IVxlanInput', url: '/config/tunnel/vxlan'},
	{interface: 'IBgpPolicyApply', url: '/config/bgp/policy/apply'},
	{interface: 'IBgpGlobalConfig', url: '/config/bgp/global'},
];
