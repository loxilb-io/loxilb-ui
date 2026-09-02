//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {TextField} from '@mui/material';
import {useEffect, useState} from 'react';
import {MAX_VALUE_BY_FORMAT} from 'types/global';

const mapMetaTypeToInputType = (metaType?: string): string => {
	if (metaType === 'integer' || metaType === 'number') return 'number';
	else return 'text'; // string, boolean, array, object to text
};

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function TextBox(props: {
   label: string;
   multiline?: boolean;
   minRows?: number;
   value: string | number | undefined;
   type?: string;
   format?: string;
   disabled?: boolean;
   onChange: (val: string | number) => void;
   error?: boolean;
   helperText?: string;
   raw?: boolean;
}) {
   const {label, multiline, minRows, value, type = 'string', format, disabled, onChange, error, helperText, raw} = props;

	const inputType = mapMetaTypeToInputType(type);
	const max = format ? MAX_VALUE_BY_FORMAT[format] : undefined;

	// Use local state for number inputs to allow free typing
	const [localValue, setLocalValue] = useState<string>('');
	const [isFocused, setIsFocused] = useState(false);

	// Sync local value with prop value when not focused
	useEffect(() => {
		if (!isFocused && inputType === 'number') {
			setLocalValue(value === undefined || value === null || value === '' ? '' : String(value));
		}
	}, [value, isFocused, inputType]);

	const handleChange = (event: any) => {
		const val = event.target.value;

		if (inputType === 'number') {
			// Allow empty string for deletion
			if (val === '') {
				setLocalValue('');
				onChange(0);
				return;
			}

			// Allow typing decimal point and negative sign temporarily
			setLocalValue(val);

			// Validate and parse number
			const num = Number(val);
			if (!isNaN(num)) {
				let parsed = num;
				if (parsed < 0) parsed = 0;
				else if (max !== undefined && parsed > max) parsed = max;
				onChange(parsed);
			}
		} else {
			onChange(val);
		}
	};

	const handleFocus = () => {
		setIsFocused(true);
		if (inputType === 'number') {
			setLocalValue(value === undefined || value === null || value === '' ? '' : String(value));
		}
	};

	const handleBlur = () => {
		setIsFocused(false);
		if (inputType === 'number') {
			// Ensure we have a valid number on blur
			if (localValue === '' || localValue === null || localValue === undefined) {
				setLocalValue('0');
				onChange(0);
			} else {
				const num = Number(localValue);
				if (isNaN(num) || num < 0) {
					setLocalValue('0');
					onChange(0);
				} else if (max !== undefined && num > max) {
					setLocalValue(String(max));
					onChange(max);
				} else {
					setLocalValue(String(num));
					onChange(num);
				}
			}
		}
	};

	// useEffect(() => {
	// 	if (disabled) onChange('');
	// }, [disabled]);

	// Raw-string numeric mode: the parent owns the verbatim
	// text and derives parse/validation itself — no local state, no coercion,
	// and type="text" because type="number" hides invalid input from JS
	// entirely (badInput reads back as ''). Opt-in; the legacy number mode
	// below is unchanged for unconverted forms. Placed after the hooks so the
	// hook order is identical whichever mode renders.
	if (raw) {
		return (
			<TextField
				label={label}
				size="small"
				fullWidth
				value={value ?? ''}
				type="text"
				disabled={disabled}
				onChange={event => onChange(event.target.value)}
				error={!!error}
				helperText={helperText}
				slotProps={{inputLabel: {shrink: true}, htmlInput: {inputMode: 'numeric'}}}
			/>
		);
	}

	// For number inputs, use local state when focused to allow free typing
	const displayValue = (inputType === 'number' && isFocused)
		? localValue
		: (value === undefined || value === null ? '' : value);

	return (
   <TextField
	   label={label}
	   size="small"
	   fullWidth
	   multiline={multiline}
	   minRows={minRows}
	   value={displayValue}
	   type={inputType}
	   disabled={disabled}
	   onChange={handleChange}
	   onFocus={handleFocus}
	   onBlur={handleBlur}
	   error={!!error}
	   helperText={helperText}
	   slotProps={{
		   inputLabel: {shrink: true},
		   ...(inputType === 'number' ? {htmlInput: {min: 0, ...(max !== undefined ? {max} : {})}} : max !== undefined ? {htmlInput: {max}} : {}),
	   }}
   />
	);
}
