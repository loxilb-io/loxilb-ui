//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {TextField} from '@mui/material';
import {isValidPort} from 'common';
import {t} from 'i18next';
import {useEffect, useState} from 'react';

function getPortValidationError(port: string | number): string | null {
	if (port === undefined || port === null || port === '') return null;

	const portStr = typeof port === 'string' ? port.trim() : String(port);

	if (portStr === '') return null;
	const portNum = Number(portStr);
	if (portNum === 0) return t('Invalid port number.');
	else if (!isValidPort(portNum)) return t('Invalid port number.');
	else return null;
}

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function PortBox(props: {label: string; value: number | null | undefined; disabled?: boolean; onChange: (val: number | undefined) => void; error?: boolean; helperText?: string}) {
	const {label, value, disabled, onChange, error: externalError, helperText: externalHelperText} = props;

	const [error, setError] = useState<string | null>(null);

	const handleChange = (val: string) => {
		const trimmedVal = val.trim();
		
		// If empty, set to undefined (let parent handle it)
		if (trimmedVal === '') {
			setError(null);
			onChange(undefined);
			return;
		}
		
		const validationError = getPortValidationError(trimmedVal);
		setError(validationError);
		
		// Always call onChange with the numeric value, even if there's a validation error
		// This allows the user to continue editing the field
		onChange(Number(trimmedVal));
	};

	useEffect(() => {
		if (value) {
			const validationError = getPortValidationError(value);
			setError(validationError);
		} else setError(null);
	}, [value]);

	// Don't automatically change value when disabled - let parent component control the value
	// useEffect(() => {
	// 	if (disabled) onChange(-1);
	// }, [disabled]);

	// Combine internal and external error states
	const hasError = !!error || !!externalError;
	const displayHelperText = externalHelperText || error;

	return (
		<TextField
			label={label}
			size="small"
			type="number"
			fullWidth
			value={value ?? ''}
			disabled={disabled}
			onChange={e => handleChange(e.target.value)}
			placeholder={t('0-65535')}
			error={hasError}
			helperText={displayHelperText}
			slotProps={{inputLabel: {shrink: true}}}
		/>
	);
}
