//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {TextField} from '@mui/material';
import {isValidIPAddressCidr} from 'common';
import {t} from 'i18next';
import {useEffect, useState} from 'react';

function getIPValidationError(ip: string): string | null {
	if (!ip) return null;
	else if (!isValidIPAddressCidr(ip)) return t('Invalid IP address format.');
	else return null;
}

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function IPAddressCidrBox(props: {label: string; value: string; disabled?: boolean; onChange: (val: string) => void; error?: boolean; helperText?: string}) {
	const {label, value, disabled, onChange, error: externalError, helperText: externalHelperText} = props;

	const [error, setError] = useState<string | null>(null);
	const [localValue, setLocalValue] = useState<string>(value || '');

	const handleChange = (val: string) => {
		const trimmedVal = val.trim();
		setLocalValue(trimmedVal);

		const validationError = getIPValidationError(trimmedVal);
		setError(validationError);

		if (!validationError) onChange(trimmedVal);
	};

	useEffect(() => {
		setLocalValue(value || '');
		if (value) {
			const validationError = getIPValidationError(value);
			setError(validationError);
		} else setError(null);
	}, [value]);

	useEffect(() => {
		if (disabled) onChange('');
	}, [disabled]);

	// Highlight required/empty field if parent validation says so
	const showRequired = externalHelperText === 'Required' || (externalError && !localValue);
	return (
		<TextField
			label={label}
			size="small"
			fullWidth
			value={localValue}
			disabled={disabled}
			onChange={e => handleChange(e.target.value)}
			placeholder={'192.168.0.1/24'}
			error={externalError !== undefined ? !!externalError : !!error || showRequired}
			helperText={externalHelperText !== undefined ? externalHelperText : error}
			slotProps={{inputLabel: {shrink: true}}}
		/>
	);
}
