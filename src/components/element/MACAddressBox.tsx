//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {TextField} from '@mui/material';
import {t} from 'i18next';
import {useEffect, useState} from 'react';

function getMACValidationError(mac: string): string | null {
	if (!mac || mac.trim() === '') return null;
	const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
	if (!macRegex.test(mac.trim())) return t('Invalid MAC address format.');
	return null;
}

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function MACAddressBox(props: {
	label: string;
	value: any;
	disabled?: boolean;
	onChange: (val: string) => void;
	error?: boolean;
	helperText?: string;
}) {
	const {label, value, disabled, onChange, error, helperText} = props;
	const [internalError, setInternalError] = useState<string | null>(null);

	const handleChange = (val: string) => {
		const trimmedVal = val.trim();
		const validationError = getMACValidationError(trimmedVal);
		setInternalError(validationError);
		onChange(val);
	};

	useEffect(() => {
		if (value) {
			const validationError = getMACValidationError(value);
			setInternalError(validationError);
		} else setInternalError(null);
	}, [value]);

	useEffect(() => {
		onChange('');
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	}, [disabled]);

	// Combine internal and external error states
	const hasError = !!internalError || !!error;
	const displayHelperText = helperText || internalError;

	return (
		<TextField
			label={label}
			size="small"
			fullWidth
			value={value}
			disabled={disabled}
			onChange={e => handleChange(e.target.value)}
			placeholder={'00:1A:2B:3C:4D:5E'}
			error={hasError}
			helperText={displayHelperText}
			slotProps={{inputLabel: {shrink: true}}}
		/>
	);
}
