//---------------------------------------------------------
// Interfaces for FDB
//---------------------------------------------------------
export interface IFdbAttribute {
	dev: string;
	macAddress: string;
}

export interface IFdbData {
	fdbAttr: IFdbAttribute[];
}
