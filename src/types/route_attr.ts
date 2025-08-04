//---------------------------------------------------------
// Interfaces for Network Route
//---------------------------------------------------------
export interface IStatistic {
	bytes: number;
	packets: number;
}

export interface IRouteAttrInput {
	destinationIPNet: string;
	gateway: string;
	protocol?: string;
}

export interface IRouteAttribute {
	destinationIPNet: string;
	gateway: string;
	hardwareMark: number;
	protocol: string;
	flags: string;
	sync: number;
	statistic: IStatistic;
}

export interface IRouteData {
	routeAttr: IRouteAttribute[];
}
