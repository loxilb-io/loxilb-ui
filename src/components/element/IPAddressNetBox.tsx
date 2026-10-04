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

		// Always call onChange with the value, even if there's a validation error
		// This allows the user to continue editing the field
		onChange(trimmedVal);
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
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	}, [disabled]);

	// Combine internal and external error states
	const hasError = !!error || !!externalError;
	const displayHelperText = externalHelperText || error;

	return (
		<TextField
			label={label}
			size="small"
			fullWidth
			value={localValue}
			disabled={disabled}
			onChange={e => handleChange(e.target.value)}
			placeholder={'192.168.0.1/24'}
			error={hasError}
			helperText={displayHelperText}
			slotProps={{inputLabel: {shrink: true}}}
		/>
	);
}
