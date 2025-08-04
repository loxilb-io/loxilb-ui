//---------------------------------------------------------
// Interfaces for BGP Policy Neighbors
//---------------------------------------------------------
export interface IBgpNeighborAttribute {
	ipAddress: string;
	remoteAs: number;
	state: string;
	updowntime: string;
}

export interface IBgpNeighborState {
	bgpNeiAttr: IBgpNeighborAttribute[];
}

export interface IBgpNeighborInput {
	ipAddress: string;
	remoteAs: number;
	remotePort?: number;
	setMultiHop?: boolean;
}
