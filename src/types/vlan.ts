//---------------------------------------------------------
// Interfaces for Network VLAN
//---------------------------------------------------------
export interface IMember {
	dev: string;
	tagged: boolean;
}

export interface IVlanStatistic {
	inBytes: number;
	inPackets: number;
	outBytes: number;
	outPackets: number;
}

export interface IVlanInput {
	vid: number;
}

export interface IVlanMemberInput {
	dev: string;
	tagged: boolean;
}

export interface IVlanAttribute {
	vid: number;
	dev: string;
	member: IMember[];
	vlanStatistic: IVlanStatistic;
}

export interface IVlanData {
	vlanAttr: IVlanAttribute[];
}
