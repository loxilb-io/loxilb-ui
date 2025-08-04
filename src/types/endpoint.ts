//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface IEndpointInput {
	hostName: string;
	name?: string;
	inactiveReTries?: number;
	probeType?: string;
	probeReq?: string;
	probeResp?: string;
	probeDuration?: number;
	probePort?: number;
}

export interface IEndpointItem {
	currState: string;
	hostName: string;
	name: string;

	probePort: number;
	probeType: string;

	probeReq?: string;
	probeResp?: string;
	probeDuration?: number;

	minDelay?: string;
	avgDelay?: string;
	maxDelay?: string;
	inactiveReTries?: number;
}

export interface IEndpointAttr {
	Attr: IEndpointItem[];
}
