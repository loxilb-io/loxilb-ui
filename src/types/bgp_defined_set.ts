//---------------------------------------------------------
// Interfaces for BGP Policy Sets
//---------------------------------------------------------
export interface IPrefixListItem {
	ipPrefix: string;
	masklengthRange: string;
}

export interface IDefinedSetAttribute {
	name: string; // defined set name
	definedType: 'prefix' | 'neighbor' | 'community' | 'extcommunity' | 'aspath' | 'largecommunity';
	prefixList: IPrefixListItem[]; // for definedType 'prefix'
	list: string[]; // queried list of each definedType
}

export interface IDefinedSetsInfo {
	definedsetsAttr: IDefinedSetAttribute[];
}

export interface IBGPDefinedSetInput {
	definedType: 'prefix' | 'neighbor' | 'community' | 'extcommunity' | 'aspath' | 'largecommunity';
	name: string;
	List?: string[]; // Capital 'L' is from the server side misspelling, should be 'list'
	prefixList?: {ipPrefix: string; masklengthRange: string}[];
}
