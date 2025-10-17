//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface IVipAttribute {
	instance: string;
	state: string;
	vip: string;
}

export interface IVipConfiguration {
	Attr: IVipAttribute[];
}
