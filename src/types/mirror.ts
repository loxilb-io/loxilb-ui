//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface IMirrorInfo {
	type?: number; // 0: SPAN, 1: RSPAN, 2: ERSPAN
	port?: string;
	vlan?: number;
	sourceIP?: string;
	remoteIP?: string;
	tunnelID?: number;
}

export interface ITargetObject {
	attachment: number;
	mirrObjName?: string;
	polObjName?: string;
}

export interface IMirrorAttribute {
	mirrorIdent: string;
	mirrorInfo: IMirrorInfo;
	targetObject: ITargetObject;
	sync: number;
}

export interface IMirrorConfiguration {
	mirrAttr: IMirrorAttribute[];
}
