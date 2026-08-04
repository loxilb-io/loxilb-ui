import {useInstanceFromURL} from 'hooks/instanceHook';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {IPostParamFieldDesc} from 'types/global';
import {INPUT_PARAM_LIST} from 'types/input_base';
import {useMetadata} from './query/queryHooks';

//---------------------------------------------------------
// Validation function
function validateForm<T>(form: T, params: Record<string, IPostParamFieldDesc>): { errors: Record<string, string>, isValid: boolean } {
	const errors: Record<string, any> = {};
	let valid = true;
	Object.keys(params).forEach(key => {
		const param = params[key];
		const value = (form as any)[key];

		// Required check
		if (param.required && (value === undefined || value === '' || value === null || (Array.isArray(value) && value.length === 0))) {
			errors[key] = 'Required';
			valid = false;
		}

		// Integer type check
		if (param.type === 'integer' && value !== undefined && value !== null && typeof value !== 'number') {
			errors[key] = 'Must be a number';
			valid = false;
		}

		// Enum check
		if (param.enum && value !== undefined && value !== null && !param.enum.includes(value)) {
			errors[key] = 'Invalid value';
			valid = false;
		}

		// Object type: recursively validate (always, even if value is missing)
		if (param.type === 'object' && param.properties) {
			const childValidation = validateForm(value || {}, param.properties);
			errors[key] = childValidation.errors;
			if (!childValidation.isValid) valid = false;
		} else if (!param.type && typeof param === 'object' && !Array.isArray(param) && param !== null) {
			// Only recurse if param is a map of field descriptors
			const isFieldMap = Object.values(param).every(v => typeof v === 'object' && v !== null && ('type' in v || 'properties' in v));
			if (isFieldMap) {
				const childValidation = validateForm(value || {}, param as unknown as Record<string, IPostParamFieldDesc>);
				errors[key] = childValidation.errors;
				if (!childValidation.isValid) valid = false;
			}
		}

		// Array type: validate each item
		if (param.type === 'array' && param.items && Array.isArray(value)) {
			errors[key] = [];
			value.forEach((item: any, idx: number) => {
				let itemErrors, itemValid;
				if (param.items && (param.items as any).properties) {
					// Array of objects
					const itemValidation = validateForm(item, (param.items as any).properties);
					itemErrors = itemValidation.errors;
					itemValid = itemValidation.isValid;
				} else {
					// Array of primitives
					const itemValidation = validateForm({ value: item }, { value: param.items as IPostParamFieldDesc });
					itemErrors = itemValidation.errors.value;
					itemValid = itemValidation.isValid;
				}
				errors[key][idx] = itemErrors;
				if (!itemValid) valid = false;
			});
		}
	});
	return { errors, isValid: valid };
}
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

function getDefaultValueFromParams<T>(params: any, depth: number = 0): T {
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
		// if (!param.type && (param.properties || param.items)) {
		// 	result[key] = param.properties ? getDefaultValueFromParams(param.properties, depth + 1) : getArrayDefault(param.items, depth + 1);
		// 	continue;
		// }

		// enum 처리
		if (param.enum?.length) {
			result[key] = param.required ? getEnumDefault(param) : undefined;
			continue;
		}

		// description에서 기본값 추출
		// const descDefault = getDescriptionDefault(param);
		// if (descDefault !== null) {
		// 	result[key] = descDefault;
		// 	continue;
		// }

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

// Recursively lays `defaults` under `current`: existing (non-undefined)
// form values always win; defaults only fill the gaps.
function mergeDefaultsUnder(defaults: any, current: any): any {
	if (current === undefined || current === null) return defaults;
	if (typeof current !== 'object' || Array.isArray(current)) return current;
	if (typeof defaults !== 'object' || defaults === null || Array.isArray(defaults)) return current;

	const merged: any = {...defaults};
	for (const key of Object.keys(current)) merged[key] = mergeDefaultsUnder(defaults[key], current[key]);
	return merged;
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
   const [errors, setErrors] = useState<Record<string, string>>({});
   const [isValid, setIsValid] = useState<boolean>(true);

   useEffect(() => {
	   // Merge schema defaults UNDER whatever is already in the form instead
	   // of replacing it. Dropdown auto-defaults (and fast user edits) can land
	   // in the same effects flush as this reset — child effects run before
	   // parent effects — and a plain setForm(defaults) silently wiped them
	   // (e.g. the firewall protocol showed ICMP(1) but POSTed no protocol).
	   if (is_fetched) setForm(prev => mergeDefaultsUnder(getDefaultValueFromParams<T>(params), prev) as T);
   }, [is_fetched, params]);

   useEffect(() => {
	   if (form && params) {
		   const validation = validateForm(form, params);
		   setErrors(validation.errors);
		   setIsValid(validation.isValid);
	   }
   }, [form, params]);

   // Latest-write mirror of the form state. Two writes landing in the same
   // React batch each see the RENDER-TIME `form` closure, so the second write
   // silently clobbered the first (the F14 stale-snapshot class — seen live on
   // the neighbor dialog: MAC fill → device select ~60ms later wiped the MAC
   // from state while the input still displayed it, so validation never passed
   // and Add stayed disabled). Merging over this ref makes rapid writes
   // cumulative regardless of render timing.
   const mergedRef = useRef<T | undefined>(undefined);
   useEffect(() => {
	   mergedRef.current = form; // re-sync after state-driven resets (defaults merge)
   }, [form]);

   const handleChange = useCallback(
	   (field: keyof T) => (value: any) => {
		   // No empty-params guard here: dropdown auto-defaults (ParamBox/
		   // DropDownSelectBox) fire on mount, often BEFORE the metadata query
		   // resolves. Dropping those writes left fields (e.g. firewall
		   // protocol) displayed in the UI but absent from the POST payload.
		   const processedValue = params[field as string]?.type === 'integer' || typeof field === 'number' ? Number(value) : value;
		   const newForm = {...((mergedRef.current ?? form) || ({} as T)), [field]: processedValue} as T;
		   mergedRef.current = newForm;
		   setForm(newForm);
		   if (onChange) onChange(newForm);
	   },
	   [form, onChange, params],
   );

   const handleObjectChange = useCallback(
	   (partialData: Partial<T>) => {
		   const newForm = {...((mergedRef.current ?? form) || ({} as T)), ...partialData} as T;
		   mergedRef.current = newForm;
		   setForm(newForm);
		   if (onChange) onChange(newForm);
	   },
	   [form, onChange],
   );

   return is_fetched
	   ? {form, params, handleChange, handleObjectChange, errors, isValid}
	   : {form: undefined, params: undefined, handleChange: () => {}, handleObjectChange: () => {}, errors: {}, isValid: false};
}
