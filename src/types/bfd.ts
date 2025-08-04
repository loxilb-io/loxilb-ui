//---------------------------------------------------------
// Interfaces for BFD
//---------------------------------------------------------
export interface IBFDAttribute {
	instance: string;
	remoteIp: string;
	sourceIP: string;
	port: number;
	interval: number;
	retryCount: number;
	state: string;
}

export interface IBFDAttribureInfo {
	Attr: IBFDAttribute[];
}

export interface IBfdInput {
	instance?: string;
	interval?: number; // microseconds, uint64 범위
	remoteIp?: string;
	retryCount?: number; // uint8 범위
	sourceIp?: string;
}
