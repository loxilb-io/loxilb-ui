import {ITargetObject} from './mirror';

//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface IPolicyInfo {
	type: number;
	colorAware: boolean;
	committedInfoRate: number;
	peakInfoRate: number;
	committedBlkSize: number;
	excessBlkSize: number;
}

export interface IPolicyAttribute {
	policyIdent: string;
	policyInfo: IPolicyInfo;
	targetObject: ITargetObject;
}

export interface IPolicyConfiguration {
	polAttr: IPolicyAttribute[];
}
