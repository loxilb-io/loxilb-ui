//---------------------------------------------------------
// Interfaces for Network IP
//---------------------------------------------------------
export interface IIpAttributeInput {
	dev: string;
	ipAddress: string;
}

export interface IIpAttribute {
	dev: string;
	ipAddress: string[];
	sync: number;
}

export interface IIpData {
	ipAttr: IIpAttribute[];
}
