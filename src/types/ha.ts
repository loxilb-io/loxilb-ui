//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface IVipAttribute {
	instance: string;
	state: string;
	vip: string;
	sync: number;
}

export interface IVipConfiguration {
	Attr: IVipAttribute[];
}
