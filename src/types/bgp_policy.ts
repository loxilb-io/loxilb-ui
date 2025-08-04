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

export const EMMPTY_STATEMENT: IStatement = {
	name: '',
	conditions: {
		bgpConditions: {
			afiSafiIn: [],
			asPathLength: {operator: '', value: 0},
			matchAsPathSet: {asPathSet: '', matchSetOptions: ''},
			matchCommunitySet: {communitySet: '', matchSetOptions: ''},
			matchExtCommunitySet: {communitySet: '', matchSetOptions: ''},
			matchLargeCommunitySet: {communitySet: '', matchSetOptions: ''},
			nextHopInList: [],
			rpki: '',
			routeType: '',
		},
		matchNeighborSet: {matchSetOption: '', neighborSet: ''},
		matchPrefixSet: {matchSetOption: '', prefixSet: ''},
	},
	actions: {
		bgpActions: {
			setMed: '',
			setLocalPerf: 0,
			setNextHop: '',
			setCommunity: {
				options: '',
				setCommunityMethod: [],
			},
			setExtCommunity: {
				options: '',
				setCommunityMethod: [],
			},
			setLargeCommunity: {
				options: '',
				setCommunityMethod: [],
			},
			setAsPathPrepend: {
				as: '',
				repeatN: 0,
			},
		},
		routeDisposition: '',
	},
};
