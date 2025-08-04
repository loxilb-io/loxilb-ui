import {useInstanceFromURL} from 'hooks/instanceHook';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {IPostParamFieldDesc} from 'types/global';
import {INPUT_PARAM_LIST} from 'types/input_base';
import {useMetadata} from './query/queryHooks';

//---------------------------------------------------------
// Helper Functions
//---------------------------------------------------------
function isSchemaObject(param: any): boolean {
	return typeof param === 'object' && !Array.isArray(param) && param !== null;
}

function getArrayDefault(items: any, depth: number = 0): any[] {
	if (depth > 10) return []; // 무한 루프 방지
	if (items?.properties) return [getDefaultValueFromParams(items.properties, depth + 1)];
	return [];
}

function getEnumDefault(param: any): any {
	if (typeof param.description === 'string') {
		const match = param.description.match(/([0-9A-Za-z]+)-default/);
		if (match) {
			const value = typeof param.enum[0] === 'number' ? Number(match[1]) : match[1];
			if (!param.enum.includes(value)) param.enum.push(value);
			return value;
		}
	}

	// 우선순위: 'none' > '' > 0(integer인 경우) > 첫번째 enum값
	if (param.enum.includes('none')) return 'none';
	if (param.enum.includes('')) return '';
	if (param.type === 'integer' && param.enum.includes(0)) return 0;
	return param.enum[0];
}

function getDescriptionDefault(param: any): any {
	if (typeof param.description === 'string') {
		const match = param.description.match(/\(default\s+([0-9A-Za-z]+)\)/);
		if (match) {
			const value = param.type === 'integer' ? Number(match[1]) : match[1];
			return value;
		}
	}
	return null;
}

export function getDefaultValueFromParams<T>(params: any, depth: number = 0): T {
	const result: any = {};

	// 무한 루프 방지
	if (depth > 10) return result as T;

	for (const key in params) {
		if (!params.hasOwnProperty(key)) continue;

		const param = params[key];
		if (!param || typeof param !== 'object') {
			result[key] = undefined;
			continue;
		}

		// 중첩 구조 처리
		if (!param.type && (param.properties || param.items)) {
			result[key] = param.properties ? getDefaultValueFromParams(param.properties, depth + 1) : getArrayDefault(param.items, depth + 1);
			continue;
		}

		// enum 처리
		if (param.enum?.length) {
			result[key] = param.required ? getEnumDefault(param) : undefined;
			continue;
		}

		// description에서 기본값 추출
		const descDefault = getDescriptionDefault(param);
		if (descDefault !== null) {
			result[key] = descDefault;
			continue;
		}

		// 타입별 기본값
		switch (param.type) {
			case 'string':
				result[key] = param.required ? '' : undefined;
				break;
			case 'integer':
				result[key] = param.required ? 0 : undefined;
				break;
			case 'boolean':
				result[key] = param.required ? false : undefined;
				break;
			case 'array':
				result[key] = getArrayDefault(param.items, depth + 1);
				break;
			case 'object':
				result[key] = param.properties ? getDefaultValueFromParams(param.properties, depth + 1) : {};
				break;
			default:
				result[key] = param.properties
					? getDefaultValueFromParams(param.properties, depth + 1)
					: isSchemaObject(param)
					? getDefaultValueFromParams(param, depth + 1)
					: undefined;
		}
	}

	return result as T;
}

//---------------------------------------------------------
// Hook
//---------------------------------------------------------
export default function useFormWithParams<T>(paramType: string, onChange?: (data: T) => void) {
	const inst = useInstanceFromURL();
	const key = INPUT_PARAM_LIST.find(p => p.interface === paramType);
	if (!key) throw new Error(`No input parameter found for type: ${paramType}`);

	const {get_param, param_fields, is_fetched} = useMetadata(inst, key.url);

	const params: Record<string, IPostParamFieldDesc> = useMemo(() => {
		if (!is_fetched) return {};
		const pathArray = typeof key.path === 'string' ? key.path.split('.') : key.path;
		const field = pathArray?.length ? get_param(pathArray) : param_fields;

		if (field?.properties) return field.properties as Record<string, IPostParamFieldDesc>;
		else if (field && isSchemaObject(field) && !('type' in field && !field.properties)) return field as Record<string, IPostParamFieldDesc>;
		return {};
	}, [is_fetched, key.path, get_param, param_fields]);

	const initialValue = useMemo(() => getDefaultValueFromParams<T>(params), [params]);
	const [form, setForm] = useState<T>(initialValue);

	useEffect(() => {
		if (is_fetched) setForm(getDefaultValueFromParams<T>(params));
	}, [is_fetched, params]);

	const handleChange = useCallback(
		(field: keyof T) => (value: any) => {
			if (!Object.keys(params).length) return;

			const processedValue = params[field as string]?.type === 'integer' || typeof field === 'number' ? Number(value) : value;
			const newForm = {...(form || ({} as T)), [field]: processedValue} as T;
			setForm(newForm);
			if (onChange) onChange(newForm);
		},
		[form, onChange, params],
	);

	const handleObjectChange = useCallback(
		(partialData: Partial<T>) => {
			const newForm = {...(form || ({} as T)), ...partialData} as T;
			setForm(newForm);
			if (onChange) onChange(newForm);
		},
		[form, onChange],
	);

	return is_fetched ? {form, params, handleChange, handleObjectChange} : {form: undefined, params: undefined, handleChange: () => {}, handleObjectChange: () => {}};
}
