//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {Alert, Button, Stack, Typography} from '@mui/material';
import {formatBytes} from 'common';
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import {t} from 'i18next';
import React from 'react';
import {SNAPSHOT_UPLOAD_MAX_BYTES} from 'types/snapshot';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export interface IUploadSnapshotEntry {
	file: File | null;
	name: string;
	description: string;
}

interface UploadSnapshotFormProps {
	onChange: (data: IUploadSnapshotEntry & {isValid: boolean}) => void;
}

// The document itself is NOT parsed client-side — the envelope check
// (schema_version/checksum) is OAM's job at upload, deep validation the
// gateway's at restore. Only the size cap is mirrored locally (server 413).
export default function UploadSnapshotForm(props: UploadSnapshotFormProps) {
	const {onChange} = props;

	const [form, setForm] = React.useState<IUploadSnapshotEntry>({file: null, name: '', description: ''});
	const inputRef = React.useRef<HTMLInputElement>(null);

	const tooLarge = form.file !== null && form.file.size > SNAPSHOT_UPLOAD_MAX_BYTES;
	const validateForm = (data: IUploadSnapshotEntry): boolean => data.file !== null && data.file.size <= SNAPSHOT_UPLOAD_MAX_BYTES;

	const update = (patch: Partial<IUploadSnapshotEntry>) => {
		const newForm = {...form, ...patch};
		setForm(newForm);
		onChange({...newForm, isValid: validateForm(newForm)});
	};

	React.useEffect(() => {
		onChange({...form, isValid: false});
	}, []);

	return (
		<NewBox item_name={t('Upload Snapshot')}>
			<Stack spacing={3}>
				<Stack direction="row" spacing={2} alignItems="center">
					<Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => inputRef.current?.click()}>
						{t('Choose File')}
					</Button>
					<Typography variant="body2" color={form.file ? 'text.primary' : 'text.secondary'}>
						{form.file ? `${form.file.name} (${formatBytes(form.file.size)})` : t('No file selected')}
					</Typography>
					<input
						ref={inputRef}
						type="file"
						accept=".json,application/json"
						hidden
						aria-label={t('Snapshot document file')}
						onChange={e => update({file: e.target.files?.[0] ?? null})}
					/>
				</Stack>
				{tooLarge && (
					<Alert severity="error">
						{t('File exceeds the {{max}} upload limit.', {max: formatBytes(SNAPSHOT_UPLOAD_MAX_BYTES)})}
					</Alert>
				)}
				<ParamBox
					label={t('Name')}
					value={form.name}
					onChange={(v: string) => update({name: v})}
					param_desc={{type: 'string', description: 'Optional: defaults to the uploaded document\'s name.'}}
				/>
				<ParamBox
					label={t('Description')}
					value={form.description}
					onChange={(v: string) => update({description: v})}
					multiline
					param_desc={{type: 'string', description: 'Optional: provenance of this off-box snapshot.'}}
				/>
			</Stack>
		</NewBox>
	);
}
