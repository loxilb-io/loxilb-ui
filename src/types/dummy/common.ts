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
	type: 'string' | 'integer' | 'boolean' | 'array' | 'object';
	enum?: string[];
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
	no: string;
	handle_yes: () => void;
	handle_no: () => void;
}

export interface IPieChartData {
	id: number;
	value: number;
	label: string;
}

export interface IExtractedHAData {
	id: number;
	instance: string;
	vip: string;
	state: string;
	sync: number;
}

export interface ITimelineDataSet {
	label: string;
	values: number[];
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
	type?: 'value' | 'state' | 'multi-line' | 'on-off' | 'log-level' | 'state-and-name' | 'link' | 'status' | 'usage' | 'graph';
	tooltip?: string;
}

export interface ITimeSeriesPoint<T> {
	timestamp: number;
	data: T;
}
