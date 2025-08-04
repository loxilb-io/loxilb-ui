//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {TextField} from '@mui/material';
import {useEffect} from 'react';
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
}) {
	const {label, multiline, minRows, value, type = 'string', format, disabled, onChange} = props;

	const inputType = mapMetaTypeToInputType(type);
	const max = format ? MAX_VALUE_BY_FORMAT[format] : undefined;

	const handleChange = (event: any) => {
		const val = event.target.value;

		let parsed: string | number = val;
		if (inputType === 'number') {
			const num = Number(val);
			if (!isNaN(num)) {
				if (num < 0) parsed = 0;
				else if (max !== undefined && num > max) parsed = max;
				else parsed = num;
			}
		}

		onChange(parsed);
	};

	useEffect(() => {
		if (disabled) onChange('');
	}, [disabled]);

	return (
		<TextField
			label={label}
			size="small"
			fullWidth
			multiline={multiline}
			minRows={minRows}
			value={value === undefined || value === null ? '' : value}
			type={inputType}
			disabled={disabled}
			onChange={handleChange}
			slotProps={{
				inputLabel: {shrink: true},
				...(inputType === 'number' ? {htmlInput: {min: 0, ...(max !== undefined ? {max} : {})}} : max !== undefined ? {htmlInput: {max}} : {}),
			}}
		/>
	);
}
