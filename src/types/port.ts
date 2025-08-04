//---------------------------------------------------------
// Interfaces for Port
//---------------------------------------------------------
export interface IPortSoftwareInfo {
	osId: number;
	portType: number;
	portProp: number;
	portActive: boolean;
	bpfLoaded: boolean;
}

export interface IPortHardwareInfo {
	rawMacAddress: number[];
	macAddress: string;
	mtu: number;
	link: boolean;
	state: boolean;
	master: string;
	real: string;
	tunnelId: number;
}

export interface IPortStatisticInfo {
	rxBytes: number;
	txBytes: number;
	rxPackets: number;
	txPackets: number;
	rxErrors: number;
	txErrors: number;
}

export interface IPortL3Info {
	routed: boolean;
	IPv4Address: string[];
	IPv6Address: string[];
}

export interface IPortL2Info {
	isPvid: boolean;
	vid: number;
}

export interface IPortAttribute {
	portName: string;
	portNo: number;
	zone: string;
	portSoftwareInformation: IPortSoftwareInfo;
	portHardwareInformation: IPortHardwareInfo;
	portStatisticInformation: IPortStatisticInfo;
	portL3Information: IPortL3Info;
	portL2Information: IPortL2Info;
	DataplaneSync: number;
}

export interface IPortInfo {
	portAttr: IPortAttribute[];
}
