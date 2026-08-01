//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {ReactNode} from 'react';
import {FieldValues} from 'react-hook-form';

//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface IFormField {
	value: string | number;
	isFullWidth?: boolean;
}

export interface IValidationRules {
	required?: boolean;
	min?: number;
	max?: number;
	pattern?: RegExp;
	custom?: (value: any) => boolean | string;
}

export interface IFormConfig<T> {
	fields: Record<keyof T, IFormField>;
	validationRules?: Record<keyof T, IValidationRules>;
	labels?: Record<keyof T, string>;
}

export interface IBaseFormDialogProps<T extends Record<string, IFormField> & FieldValues> {
	open: boolean;
	onClose: () => void;
	onSubmit: (data: T) => void;
	initialConfig: IFormConfig<T>;
}

export interface IPostParamFieldDesc {
	description?: string;
	required?: boolean;
	type: 'string' | 'integer' | 'boolean' | 'array' | 'object' | 'ipaddress' | 'ipaddress_cidr' | 'macaddress' | 'port';
	enum?: string[] | IEnumItem[];
	format?: string;

	items?: IPostParamFieldDesc;

	properties?: {
		[key: string]: IPostParamFieldDesc;
	};
}

export interface IPostParamDesc {
	[url: string]: {
		fields: {
			[key: string]: IPostParamFieldDesc;
		};
	};
}

export interface IPopupState {
	is_open: boolean;
	title: string;
	contents: string | ReactNode;
	yes: string;
	no: string | undefined;
	handle_yes: () => void;
	handle_no: () => void;
	disable_yes?: boolean;
}

export interface IPieChartData {
	id: string | number;
	value: number;
	label: string;
}

export interface IExtractedHAData {
	id: number;
	instance: string;
	vip: string;
	state: string;
}

export interface MenuSet {
	element: string;
	sub_elements: string[];
}

export interface IDataTableColumnDef {
	data_key: string;
	header: string;
	width?: 'narrow' | 'medium' | 'wide' | 'super_wide' | 'full';
	align?: 'left' | 'right' | 'center';
	type?: 'value' | 'state' | 'multi-line' | 'on-off' | 'log-level' | 'state-and-name' | 'link' | 'status' | 'usage' | 'graph' | 'boolean' | 'sync' | 'chip';
	tooltip?: string;
	sortComparator?: (v1: any, v2: any) => number;
}

export interface ITimeSeriesPoint<T> {
	timestamp: number;
	data: T;
}

export interface ITimelineDataSet<T = number> {
	label?: string;
	values: ITimeSeriesPoint<T>[];
}

export interface IEnumItem {
	id: number;
	name: string;
	send_value: string | number;
}

//---------------------------------------------------------
// Constants
//---------------------------------------------------------
export const MAX_VALUE_BY_FORMAT: Record<string, number> = {
	uint8: 255,
	uint16: 65535,
	uint32: 4294967295,
	uint64: Number.MAX_SAFE_INTEGER, // Limited to safe range in JS
	int8: 127,
	int16: 32767,
	int32: 2147483647,
	int64: Number.MAX_SAFE_INTEGER,
};

export const UNIT_LIST = [
	{label: '10s', seconds: 10, unit: 's', unit_value: 10},
	{label: '30s', seconds: 30, unit: 's', unit_value: 30},
	{label: '1min', seconds: 60, unit: 'm', unit_value: 1},
	{label: '10min', seconds: 600, unit: 'm', unit_value: 10},
	{label: '30min', seconds: 1800, unit: 'm', unit_value: 30},
	{label: '1hr', seconds: 3600, unit: 'hr', unit_value: 1},
	{label: '3hr', seconds: 10800, unit: 'hr', unit_value: 3},
	{label: '5hr', seconds: 18000, unit: 'hr', unit_value: 5},
	{label: '12hr', seconds: 43200, unit: 'hr', unit_value: 12},
	{label: '1d', seconds: 86400, unit: 'd', unit_value: 1},
];
