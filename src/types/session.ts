//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface IAccessNetworkTunnel {
	TeID: number; // !!! check the server side api errata
	tunnelIP: string;
}

export interface ICoreNetworkTunnel {
	teID: number; // !!! check the server side api errata
	tunnelIP: string;
}

export interface ISessionAttribute {
	ident: string;
	sessionIP: string;
	accessNetworkTunnel: IAccessNetworkTunnel;
	coreNetworkTunnel: ICoreNetworkTunnel;
}

export interface ISessionConfiguration {
	sessionAttr: ISessionAttribute[];
}
