//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import {t} from 'i18next';
import React from 'react';
import {SNAPSHOT_NAME_MAX_LEN} from 'types/snapshot';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export interface ITakeSnapshotEntry {
	name: string;
	description: string;
}

interface TakeSnapshotFormProps {
	initial?: Partial<ITakeSnapshotEntry>;
	onChange: (data: ITakeSnapshotEntry & {isValid: boolean}) => void;
}

export default function TakeSnapshotForm(props: TakeSnapshotFormProps) {
	const {onChange} = props;

	const [form, setForm] = React.useState<ITakeSnapshotEntry>({
		name: props.initial?.name ?? '',
		description: props.initial?.description ?? '',
	});

	const validateForm = (data: ITakeSnapshotEntry): boolean => {
		const name = data.name.trim();
		return name.length > 0 && name.length <= SNAPSHOT_NAME_MAX_LEN;
	};

	const handleChange = (field: keyof ITakeSnapshotEntry) => (value: any) => {
		const newForm = {...form, [field]: value};
		setForm(newForm);
		onChange({...newForm, isValid: validateForm(newForm)});
	};

	React.useEffect(() => {
		onChange({...form, isValid: validateForm(form)});
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	}, []);

	return (
		<NewBox item_name={t('Take Snapshot')}>
			<Stack spacing={3}>
				<ParamBox
					label={t('Name')}
					value={form.name}
					onChange={handleChange('name')}
					error={form.name.length > SNAPSHOT_NAME_MAX_LEN}
					helperText={form.name.length > SNAPSHOT_NAME_MAX_LEN ? t('Name must be at most {{max}} characters.', {max: SNAPSHOT_NAME_MAX_LEN}) : undefined}
					param_desc={{
						type: 'string',
						description: 'A short identifier for this snapshot (e.g. before-lb-cleanup).',
						required: true,
					}}
				/>
				<ParamBox
					label={t('Description')}
					value={form.description}
					onChange={handleChange('description')}
					multiline
					param_desc={{
						type: 'string',
						description: 'Optional: why this snapshot was taken.',
					}}
				/>
			</Stack>
		</NewBox>
	);
}
