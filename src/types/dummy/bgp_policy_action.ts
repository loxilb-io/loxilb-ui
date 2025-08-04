//---------------------------------------------------------
// Interfaces for BGP Policy Definitions Actions
//---------------------------------------------------------
export interface IBgpSetCommunity {
	options: string;
	setCommunityMethod: string[];
}

export interface IAsPathPrepend {
	as: string;
	repeatN: number;
}

export interface IBgpActions {
	setMed: string;
	setNextHop: string;
	setLocalPerf: number; // setLocalPref, setLocalPerf is missspelled in the server API, but we keep it for compatibility
	setCommunity: IBgpSetCommunity;
	setExtCommunity: IBgpSetCommunity;
	setLargeCommunity: IBgpSetCommunity;
	setAsPathPrepend: IAsPathPrepend;
}

export interface IActionSet {
	routeDisposition: string;
	bgpActions: IBgpActions;
}
