//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface IRuleArguments {
	sourceIP: string;
	destinationIP: string;
	minSourcePort: number;
	maxSourcePort: number;
	minDestinationPort: number;
	maxDestinationPort: number;
	protocol: number;
	portName: string;
	preference: number;
	hwOffload?: boolean;
}

export interface IOptions {
	drop: boolean;
	trap: boolean;
	redirect: boolean;
	allow: boolean;
	record: boolean;
	redirectPortName: string;
	fwMark: number;
	doSnat: boolean;
	toIP: string;
	toPort: number;
	counter: string; // The type remains string but format will be "number:number"
	onDefault: boolean;
}

export interface IFirewallRule {
	ruleArguments: IRuleArguments;
	opts: IOptions;
}

export interface IFirewallRules {
	fwAttr: IFirewallRule[];
}

export interface IFirewallDeleteFilter {
	sourceIP?: string;
	destinationIP?: string;
	minSourcePort?: number;
	maxSourcePort?: number;
	minDestinationPort?: number;
	maxDestinationPort?: number;
	protocol?: number;
	portName?: string;
	preference?: number;
}
