//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Add} from '@mui/icons-material';
import {Button, Stack, TextField, Typography} from '@mui/material';
import {t} from 'i18next';
import {useEffect} from 'react';
import SimpleButton from './SimpleButton';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function TextBoxArray(props: {
	label: string;
	value: (string | number)[] | undefined;
	type: 'string' | 'number';
	onChange: (value: (string | number)[]) => void;
	disabled?: boolean;
}) {
	const {label, value, onChange, disabled} = props;

	const handleChange = (index: number, newVal: string | number) => {
		if (value === undefined) return;

		const updated = [...value];
		updated[index] = newVal;
		onChange(updated);
	};

	const handleAdd = () => {
		if (value === undefined) return;
		onChange([...value, '']);
	};

	const handleDelete = (index: number) => {
		if (value === undefined) return;
		const updated = value.filter((_, i) => i !== index);
		onChange(updated);
	};

	useEffect(() => {
		if (value === undefined) return;
		onChange([]);
	}, [disabled]);

	return (
		<Stack spacing={1}>
			<Typography variant="caption">{label}</Typography>

			{value &&
				value.map((val, index) => (
					<Stack key={index} direction="row" spacing={1} alignItems="center">
						<TextField fullWidth value={val} onChange={e => handleChange(index, e.target.value)} size="small" slotProps={{inputLabel: {shrink: true}}} />
						<SimpleButton type="delete" onClick={() => handleDelete(index)} />
					</Stack>
				))}

			<Button variant="outlined" startIcon={<Add />} size="small" sx={{width: 'fit-content'}} onClick={handleAdd}>
				{t('Add')}
			</Button>
		</Stack>
	);
}
