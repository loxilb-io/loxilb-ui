import {Stack, Typography} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import {t} from 'i18next';
import {useState} from 'react';

// Popup contents are stored as a React element. Keep the controlled value
// inside the mounted form; changing a ref in the page cannot update that element.
export default function SnapshotDeleteForm({name, onChange}: {name: string; onChange: (value: string) => void}) {
	const [value, setValue] = useState('');
	return (
		<Stack spacing={2}>
			<Typography variant="body1">
				{t('This permanently deletes snapshot "{{name}}" and its stored configuration document. This cannot be undone.', {name})}
			</Typography>
			<ParamBox
				label={t('Type the snapshot name to confirm')}
				value={value}
				onChange={(next: string) => {
					setValue(next);
					onChange(next);
				}}
				param_desc={{type: 'string', description: name, required: true}}
			/>
		</Stack>
	);
}
