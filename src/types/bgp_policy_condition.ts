//---------------------------------------------------------
// Interfaces for BGP Policy Definitions Conditions
//---------------------------------------------------------
export interface IAsPathLength {
	operator: string;
	value: number;
}

export interface IMatchSet {
	communitySet: string;
	matchSetOptions: string;
}

export interface IAsPathSet {
	asPathSet: string;
	matchSetOptions: string;
}

export interface IBgpConditions {
	afiSafiIn: string[];
	asPathLength: IAsPathLength;
	matchAsPathSet: IAsPathSet;
	matchCommunitySet: IMatchSet;
	matchExtCommunitySet: IMatchSet;
	matchLargeCommunitySet: IMatchSet;
	nextHopInList: string[];
	rpki: string;
	routeType: string;
}

export interface IMatchNeighborSet {
	matchSetOption: string;
	neighborSet: string;
}

export interface IMatchPrefixSet {
	matchSetOption: string;
	prefixSet: string;
}

export interface IConditionSet {
	bgpConditions: IBgpConditions;
	matchNeighborSet: IMatchNeighborSet;
	matchPrefixSet: IMatchPrefixSet;
}
