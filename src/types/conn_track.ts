//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface ICtAttribute {
	destinationIP: string;
	sourceIP: string;
	destinationPort: number;
	sourcePort: number;
	protocol: string;
	conntrackState: string;
	ident: string;
	conntrackAct: string;
	packets: number;
	bytes: number;
	servName: string;
}

export interface ICtData {
	ctAttr: ICtAttribute[];
}
