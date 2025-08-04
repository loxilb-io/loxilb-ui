//---------------------------------------------------------
// Interfaces for Device Neighbor
//---------------------------------------------------------
export interface INeighborAttr {
	ipAddress: string;
	dev: string;
	macAddress: string;
}

export interface INeighborData {
	neighborAttr: INeighborAttr[];
}
