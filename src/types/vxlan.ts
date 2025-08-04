//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface IVxlanInput {
	epIntf: string;
	vxlanID: number;
}

export interface IVxlanAttribute {
	vxlanName: string;
	epIntf: string;
	vxlanID: number;
	peerIP: string[];
}

export interface IVxlanData {
	vxlanAttr: IVxlanAttribute[];
}
