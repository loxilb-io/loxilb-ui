//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IActionSet} from './bgp_policy_action';
import {IConditionSet} from './bgp_policy_condition';

//---------------------------------------------------------
// Interfaces for BGP Policy Definitions
//---------------------------------------------------------
export interface IStatement {
	name: string;
	conditions: IConditionSet;
	actions: IActionSet;
}

export interface IBgpPolicy {
	name: string;
	statements: IStatement[];
}

export interface IBgpPolicyInfo {
	bgpPolicyAttr: IBgpPolicy[];
}

export interface IBgpPolicyApply {
	ipAddress: string;
	policyType: 'import' | 'export';
	routeAction: 'accept' | 'reject';
	policies?: string[];
}

export interface IBgpGlobalConfig {
	localAs: number;
	routerId: string;
	listenPort?: number;
	SetNextHopSelf?: boolean;
}

//---------------------------------------------------------
// Dummy Data for BGP Policy
//---------------------------------------------------------
export const dummyData: IBgpPolicyInfo = {
	bgpPolicyAttr: [
		{
			name: 'BGP_POLICY_1',
			statements: [
				{
					name: 'STMT_1_1',
					conditions: {
						bgpConditions: {
							afiSafiIn: ['ipv4-unicast', 'ipv6-unicast', 'l2vpn-evpn'],
							asPathLength: {operator: 'eq', value: 3},
							matchAsPathSet: {asPathSet: 'AS_1', matchSetOptions: 'any'},
							matchCommunitySet: {communitySet: 'COMM_1', matchSetOptions: 'all'},
							matchExtCommunitySet: {communitySet: 'EXT_1', matchSetOptions: 'any'},
							matchLargeCommunitySet: {communitySet: 'LARGE_1', matchSetOptions: 'all'},
							nextHopInList: ['192.168.1.1'],
							rpki: 'valid',
							routeType: 'internal',
						},
						matchNeighborSet: {matchSetOption: 'any', neighborSet: 'NEIGHBOR_1'},
						matchPrefixSet: {matchSetOption: 'any', prefixSet: 'PREFIX_1'},
					},
					actions: {
						routeDisposition: 'accept-route',
						bgpActions: {
							setMed: '100',
							setNextHop: '192.168.1.254',
							setLocalPerf: 100,
							setCommunity: {options: 'add', setCommunityMethod: ['100:100']},
							setExtCommunity: {options: 'replace', setCommunityMethod: ['rt:100:100']},
							setLargeCommunity: {options: 'add', setCommunityMethod: ['100:200:300']},
							setAsPathPrepend: {as: '65001', repeatN: 3},
						},
					},
				},
				{
					name: 'STMT_1_2',
					conditions: {
						bgpConditions: {
							afiSafiIn: ['ipv6-unicast'],
							asPathLength: {operator: 'ge', value: 4},
							matchAsPathSet: {asPathSet: 'AS_2', matchSetOptions: 'all'},
							matchCommunitySet: {communitySet: 'COMM_2', matchSetOptions: 'any'},
							matchExtCommunitySet: {communitySet: 'EXT_2', matchSetOptions: 'all'},
							matchLargeCommunitySet: {communitySet: 'LARGE_2', matchSetOptions: 'any'},
							nextHopInList: ['2001:db8::1'],
							rpki: 'invalid',
							routeType: 'external',
						},
						matchNeighborSet: {matchSetOption: 'all', neighborSet: 'NEIGHBOR_2'},
						matchPrefixSet: {matchSetOption: 'all', prefixSet: 'PREFIX_2'},
					},
					actions: {
						routeDisposition: 'reject-route',
						bgpActions: {
							setMed: '200',
							setNextHop: '2001:db8::254',
							setLocalPerf: 200,
							setCommunity: {options: 'replace', setCommunityMethod: ['200:200']},
							setExtCommunity: {options: 'add', setCommunityMethod: ['rt:200:200']},
							setLargeCommunity: {options: 'replace', setCommunityMethod: ['200:300:400']},
							setAsPathPrepend: {as: '65002', repeatN: 2},
						},
					},
				},
				{
					name: 'STMT_1_3',
					conditions: {
						bgpConditions: {
							afiSafiIn: ['ipv4-unicast', 'ipv6-unicast'],
							asPathLength: {operator: 'le', value: 5},
							matchAsPathSet: {asPathSet: 'AS_3', matchSetOptions: 'any'},
							matchCommunitySet: {communitySet: 'COMM_3', matchSetOptions: 'all'},
							matchExtCommunitySet: {communitySet: 'EXT_3', matchSetOptions: 'any'},
							matchLargeCommunitySet: {communitySet: 'LARGE_3', matchSetOptions: 'all'},
							nextHopInList: ['192.168.3.1', '2001:db8::3'],
							rpki: 'not-found',
							routeType: 'internal',
						},
						matchNeighborSet: {matchSetOption: 'any', neighborSet: 'NEIGHBOR_3'},
						matchPrefixSet: {matchSetOption: 'any', prefixSet: 'PREFIX_3'},
					},
					actions: {
						routeDisposition: 'accept-route',
						bgpActions: {
							setMed: '300',
							setNextHop: 'self',
							setLocalPerf: 300,
							setCommunity: {options: 'add', setCommunityMethod: ['300:300']},
							setExtCommunity: {options: 'replace', setCommunityMethod: ['rt:300:300']},
							setLargeCommunity: {options: 'add', setCommunityMethod: ['300:400:500']},
							setAsPathPrepend: {as: '65003', repeatN: 4},
						},
					},
				},
				{
					name: 'STMT_1_4',
					conditions: {
						bgpConditions: {
							afiSafiIn: ['ipv4-unicast'],
							asPathLength: {operator: 'eq', value: 2},
							matchAsPathSet: {asPathSet: 'AS_4', matchSetOptions: 'all'},
							matchCommunitySet: {communitySet: 'COMM_4', matchSetOptions: 'any'},
							matchExtCommunitySet: {communitySet: 'EXT_4', matchSetOptions: 'all'},
							matchLargeCommunitySet: {communitySet: 'LARGE_4', matchSetOptions: 'any'},
							nextHopInList: ['192.168.4.1'],
							rpki: 'valid',
							routeType: 'external',
						},
						matchNeighborSet: {matchSetOption: 'all', neighborSet: 'NEIGHBOR_4'},
						matchPrefixSet: {matchSetOption: 'all', prefixSet: 'PREFIX_4'},
					},
					actions: {
						routeDisposition: 'reject-route',
						bgpActions: {
							setMed: '400',
							setNextHop: '192.168.4.254',
							setLocalPerf: 400,
							setCommunity: {options: 'replace', setCommunityMethod: ['400:400']},
							setExtCommunity: {options: 'add', setCommunityMethod: ['rt:400:400']},
							setLargeCommunity: {options: 'replace', setCommunityMethod: ['400:500:600']},
							setAsPathPrepend: {as: '65004', repeatN: 2},
						},
					},
				},
				{
					name: 'STMT_1_5',
					conditions: {
						bgpConditions: {
							afiSafiIn: ['ipv6-unicast'],
							asPathLength: {operator: 'ge', value: 3},
							matchAsPathSet: {asPathSet: 'AS_5', matchSetOptions: 'any'},
							matchCommunitySet: {communitySet: 'COMM_5', matchSetOptions: 'all'},
							matchExtCommunitySet: {communitySet: 'EXT_5', matchSetOptions: 'any'},
							matchLargeCommunitySet: {communitySet: 'LARGE_5', matchSetOptions: 'all'},
							nextHopInList: ['2001:db8::5'],
							rpki: 'valid',
							routeType: 'internal',
						},
						matchNeighborSet: {matchSetOption: 'any', neighborSet: 'NEIGHBOR_5'},
						matchPrefixSet: {matchSetOption: 'any', prefixSet: 'PREFIX_5'},
					},
					actions: {
						routeDisposition: 'accept-route',
						bgpActions: {
							setMed: '500',
							setNextHop: '2001:db8::254',
							setLocalPerf: 500,
							setCommunity: {options: 'add', setCommunityMethod: ['500:500']},
							setExtCommunity: {options: 'replace', setCommunityMethod: ['rt:500:500']},
							setLargeCommunity: {options: 'add', setCommunityMethod: ['500:600:700']},
							setAsPathPrepend: {as: '65005', repeatN: 3},
						},
					},
				},
			],
		},
		{
			name: 'BGP_POLICY_2',
			statements: [
				{
					name: 'STMT_2_1',
					conditions: {
						bgpConditions: {
							afiSafiIn: ['ipv4-unicast'],
							asPathLength: {operator: 'eq', value: 3},
							matchAsPathSet: {asPathSet: 'AS_6', matchSetOptions: 'any'},
							matchCommunitySet: {communitySet: 'COMM_6', matchSetOptions: 'all'},
							matchExtCommunitySet: {communitySet: 'EXT_6', matchSetOptions: 'any'},
							matchLargeCommunitySet: {communitySet: 'LARGE_6', matchSetOptions: 'all'},
							nextHopInList: ['192.168.6.1'],
							rpki: 'valid',
							routeType: 'internal',
						},
						matchNeighborSet: {matchSetOption: 'any', neighborSet: 'NEIGHBOR_6'},
						matchPrefixSet: {matchSetOption: 'any', prefixSet: 'PREFIX_6'},
					},
					actions: {
						routeDisposition: 'accept-route',
						bgpActions: {
							setMed: '600',
							setNextHop: '192.168.6.254',
							setLocalPerf: 600,
							setCommunity: {options: 'add', setCommunityMethod: ['600:600']},
							setExtCommunity: {options: 'replace', setCommunityMethod: ['rt:600:600']},
							setLargeCommunity: {options: 'add', setCommunityMethod: ['600:700:800']},
							setAsPathPrepend: {as: '65006', repeatN: 3},
						},
					},
				},
				{
					name: 'STMT_2_2',
					conditions: {
						bgpConditions: {
							afiSafiIn: ['ipv6-unicast'],
							asPathLength: {operator: 'ge', value: 4},
							matchAsPathSet: {asPathSet: 'AS_7', matchSetOptions: 'all'},
							matchCommunitySet: {communitySet: 'COMM_7', matchSetOptions: 'any'},
							matchExtCommunitySet: {communitySet: 'EXT_7', matchSetOptions: 'all'},
							matchLargeCommunitySet: {communitySet: 'LARGE_7', matchSetOptions: 'any'},
							nextHopInList: ['2001:db8::7'],
							rpki: 'invalid',
							routeType: 'external',
						},
						matchNeighborSet: {matchSetOption: 'all', neighborSet: 'NEIGHBOR_7'},
						matchPrefixSet: {matchSetOption: 'all', prefixSet: 'PREFIX_7'},
					},
					actions: {
						routeDisposition: 'reject-route',
						bgpActions: {
							setMed: '700',
							setNextHop: '2001:db8::254',
							setLocalPerf: 700,
							setCommunity: {options: 'replace', setCommunityMethod: ['700:700']},
							setExtCommunity: {options: 'add', setCommunityMethod: ['rt:700:700']},
							setLargeCommunity: {options: 'replace', setCommunityMethod: ['700:800:900']},
							setAsPathPrepend: {as: '65007', repeatN: 2},
						},
					},
				},
				{
					name: 'STMT_2_3',
					conditions: {
						bgpConditions: {
							afiSafiIn: ['ipv4-unicast', 'ipv6-unicast'],
							asPathLength: {operator: 'le', value: 5},
							matchAsPathSet: {asPathSet: 'AS_8', matchSetOptions: 'any'},
							matchCommunitySet: {communitySet: 'COMM_8', matchSetOptions: 'all'},
							matchExtCommunitySet: {communitySet: 'EXT_8', matchSetOptions: 'any'},
							matchLargeCommunitySet: {communitySet: 'LARGE_8', matchSetOptions: 'all'},
							nextHopInList: ['192.168.8.1', '2001:db8::8'],
							rpki: 'not-found',
							routeType: 'internal',
						},
						matchNeighborSet: {matchSetOption: 'any', neighborSet: 'NEIGHBOR_8'},
						matchPrefixSet: {matchSetOption: 'any', prefixSet: 'PREFIX_8'},
					},
					actions: {
						routeDisposition: 'accept-route',
						bgpActions: {
							setMed: '800',
							setNextHop: 'self',
							setLocalPerf: 800,
							setCommunity: {options: 'add', setCommunityMethod: ['800:800']},
							setExtCommunity: {options: 'replace', setCommunityMethod: ['rt:800:800']},
							setLargeCommunity: {options: 'add', setCommunityMethod: ['800:900:1000']},
							setAsPathPrepend: {as: '65008', repeatN: 4},
						},
					},
				},
				{
					name: 'STMT_2_4',
					conditions: {
						bgpConditions: {
							afiSafiIn: ['ipv4-unicast'],
							asPathLength: {operator: 'eq', value: 2},
							matchAsPathSet: {asPathSet: 'AS_9', matchSetOptions: 'all'},
							matchCommunitySet: {communitySet: 'COMM_9', matchSetOptions: 'any'},
							matchExtCommunitySet: {communitySet: 'EXT_9', matchSetOptions: 'all'},
							matchLargeCommunitySet: {communitySet: 'LARGE_9', matchSetOptions: 'any'},
							nextHopInList: ['192.168.9.1'],
							rpki: 'valid',
							routeType: 'external',
						},
						matchNeighborSet: {matchSetOption: 'all', neighborSet: 'NEIGHBOR_9'},
						matchPrefixSet: {matchSetOption: 'all', prefixSet: 'PREFIX_9'},
					},
					actions: {
						routeDisposition: 'reject-route',
						bgpActions: {
							setMed: '900',
							setNextHop: '192.168.9.254',
							setLocalPerf: 900,
							setCommunity: {options: 'replace', setCommunityMethod: ['900:900']},
							setExtCommunity: {options: 'add', setCommunityMethod: ['rt:900:900']},
							setLargeCommunity: {options: 'replace', setCommunityMethod: ['900:1000:1100']},
							setAsPathPrepend: {as: '65009', repeatN: 2},
						},
					},
				},
				{
					name: 'STMT_2_5',
					conditions: {
						bgpConditions: {
							afiSafiIn: ['ipv6-unicast'],
							asPathLength: {operator: 'ge', value: 3},
							matchAsPathSet: {asPathSet: 'AS_10', matchSetOptions: 'any'},
							matchCommunitySet: {communitySet: 'COMM_10', matchSetOptions: 'all'},
							matchExtCommunitySet: {communitySet: 'EXT_10', matchSetOptions: 'any'},
							matchLargeCommunitySet: {communitySet: 'LARGE_10', matchSetOptions: 'all'},
							nextHopInList: ['2001:db8::10'],
							rpki: 'valid',
							routeType: 'internal',
						},
						matchNeighborSet: {matchSetOption: 'any', neighborSet: 'NEIGHBOR_10'},
						matchPrefixSet: {matchSetOption: 'any', prefixSet: 'PREFIX_10'},
					},
					actions: {
						routeDisposition: 'accept-route',
						bgpActions: {
							setMed: '1000',
							setNextHop: '2001:db8::254',
							setLocalPerf: 1000,
							setCommunity: {options: 'add', setCommunityMethod: ['1000:1000']},
							setExtCommunity: {options: 'replace', setCommunityMethod: ['rt:1000:1000']},
							setLargeCommunity: {options: 'add', setCommunityMethod: ['1000:1100:1200']},
							setAsPathPrepend: {as: '65010', repeatN: 3},
						},
					},
				},
			],
		},
		{
			name: 'BGP_POLICY_3',
			statements: [
				{
					name: 'STMT_3_1',
					conditions: {
						bgpConditions: {
							afiSafiIn: ['ipv4-unicast'],
							asPathLength: {operator: 'eq', value: 3},
							matchAsPathSet: {asPathSet: 'AS_11', matchSetOptions: 'any'},
							matchCommunitySet: {communitySet: 'COMM_11', matchSetOptions: 'all'},
							matchExtCommunitySet: {communitySet: 'EXT_11', matchSetOptions: 'any'},
							matchLargeCommunitySet: {communitySet: 'LARGE_11', matchSetOptions: 'all'},
							nextHopInList: ['192.168.11.1'],
							rpki: 'valid',
							routeType: 'internal',
						},
						matchNeighborSet: {matchSetOption: 'any', neighborSet: 'NEIGHBOR_11'},
						matchPrefixSet: {matchSetOption: 'any', prefixSet: 'PREFIX_11'},
					},
					actions: {
						routeDisposition: 'accept-route',
						bgpActions: {
							setMed: '1100',
							setNextHop: '192.168.11.254',
							setLocalPerf: 1100,
							setCommunity: {options: 'add', setCommunityMethod: ['1100:1100']},
							setExtCommunity: {options: 'replace', setCommunityMethod: ['rt:1100:1100']},
							setLargeCommunity: {options: 'add', setCommunityMethod: ['1100:1200:1300']},
							setAsPathPrepend: {as: '65011', repeatN: 3},
						},
					},
				},
				{
					name: 'STMT_3_2',
					conditions: {
						bgpConditions: {
							afiSafiIn: ['ipv6-unicast'],
							asPathLength: {operator: 'ge', value: 4},
							matchAsPathSet: {asPathSet: 'AS_12', matchSetOptions: 'all'},
							matchCommunitySet: {communitySet: 'COMM_12', matchSetOptions: 'any'},
							matchExtCommunitySet: {communitySet: 'EXT_12', matchSetOptions: 'all'},
							matchLargeCommunitySet: {communitySet: 'LARGE_12', matchSetOptions: 'any'},
							nextHopInList: ['2001:db8::12'],
							rpki: 'invalid',
							routeType: 'external',
						},
						matchNeighborSet: {matchSetOption: 'all', neighborSet: 'NEIGHBOR_12'},
						matchPrefixSet: {matchSetOption: 'all', prefixSet: 'PREFIX_12'},
					},
					actions: {
						routeDisposition: 'reject-route',
						bgpActions: {
							setMed: '1200',
							setNextHop: '2001:db8::254',
							setLocalPerf: 1200,
							setCommunity: {options: 'replace', setCommunityMethod: ['1200:1200']},
							setExtCommunity: {options: 'add', setCommunityMethod: ['rt:1200:1200']},
							setLargeCommunity: {options: 'replace', setCommunityMethod: ['1200:1300:1400']},
							setAsPathPrepend: {as: '65012', repeatN: 2},
						},
					},
				},
				{
					name: 'STMT_3_3',
					conditions: {
						bgpConditions: {
							afiSafiIn: ['ipv4-unicast', 'ipv6-unicast'],
							asPathLength: {operator: 'le', value: 5},
							matchAsPathSet: {asPathSet: 'AS_13', matchSetOptions: 'any'},
							matchCommunitySet: {communitySet: 'COMM_13', matchSetOptions: 'all'},
							matchExtCommunitySet: {communitySet: 'EXT_13', matchSetOptions: 'any'},
							matchLargeCommunitySet: {communitySet: 'LARGE_13', matchSetOptions: 'all'},
							nextHopInList: ['192.168.13.1', '2001:db8::13'],
							rpki: 'not-found',
							routeType: 'internal',
						},
						matchNeighborSet: {matchSetOption: 'any', neighborSet: 'NEIGHBOR_13'},
						matchPrefixSet: {matchSetOption: 'any', prefixSet: 'PREFIX_13'},
					},
					actions: {
						routeDisposition: 'accept-route',
						bgpActions: {
							setMed: '1300',
							setNextHop: 'self',
							setLocalPerf: 1300,
							setCommunity: {options: 'add', setCommunityMethod: ['1300:1300']},
							setExtCommunity: {options: 'replace', setCommunityMethod: ['rt:1300:1300']},
							setLargeCommunity: {options: 'add', setCommunityMethod: ['1300:1400:1500']},
							setAsPathPrepend: {as: '65013', repeatN: 4},
						},
					},
				},
				{
					name: 'STMT_3_4',
					conditions: {
						bgpConditions: {
							afiSafiIn: ['ipv4-unicast'],
							asPathLength: {operator: 'eq', value: 2},
							matchAsPathSet: {asPathSet: 'AS_14', matchSetOptions: 'all'},
							matchCommunitySet: {communitySet: 'COMM_14', matchSetOptions: 'any'},
							matchExtCommunitySet: {communitySet: 'EXT_14', matchSetOptions: 'all'},
							matchLargeCommunitySet: {communitySet: 'LARGE_14', matchSetOptions: 'any'},
							nextHopInList: ['192.168.14.1'],
							rpki: 'valid',
							routeType: 'external',
						},
						matchNeighborSet: {matchSetOption: 'all', neighborSet: 'NEIGHBOR_14'},
						matchPrefixSet: {matchSetOption: 'all', prefixSet: 'PREFIX_14'},
					},
					actions: {
						routeDisposition: 'reject-route',
						bgpActions: {
							setMed: '1400',
							setNextHop: '192.168.14.254',
							setLocalPerf: 1400,
							setCommunity: {options: 'replace', setCommunityMethod: ['1400:1400']},
							setExtCommunity: {options: 'add', setCommunityMethod: ['rt:1400:1400']},
							setLargeCommunity: {options: 'replace', setCommunityMethod: ['1400:1500:1600']},
							setAsPathPrepend: {as: '65014', repeatN: 2},
						},
					},
				},
				{
					name: 'STMT_3_5',
					conditions: {
						bgpConditions: {
							afiSafiIn: ['ipv6-unicast'],
							asPathLength: {operator: 'ge', value: 3},
							matchAsPathSet: {asPathSet: 'AS_15', matchSetOptions: 'any'},
							matchCommunitySet: {communitySet: 'COMM_15', matchSetOptions: 'all'},
							matchExtCommunitySet: {communitySet: 'EXT_15', matchSetOptions: 'any'},
							matchLargeCommunitySet: {communitySet: 'LARGE_15', matchSetOptions: 'all'},
							nextHopInList: ['2001:db8::15'],
							rpki: 'valid',
							routeType: 'internal',
						},
						matchNeighborSet: {matchSetOption: 'any', neighborSet: 'NEIGHBOR_15'},
						matchPrefixSet: {matchSetOption: 'any', prefixSet: 'PREFIX_15'},
					},
					actions: {
						routeDisposition: 'accept-route',
						bgpActions: {
							setMed: '1500',
							setNextHop: '2001:db8::254',
							setLocalPerf: 1500,
							setCommunity: {options: 'add', setCommunityMethod: ['1500:1500']},
							setExtCommunity: {options: 'replace', setCommunityMethod: ['rt:1500:1500']},
							setLargeCommunity: {options: 'add', setCommunityMethod: ['1500:1600:1700']},
							setAsPathPrepend: {as: '65015', repeatN: 3},
						},
					},
				},
			],
		},
	],
};
