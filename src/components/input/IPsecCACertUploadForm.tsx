//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Grid2, Stack} from '@mui/material';
import NewBox from 'components/layout/NewBox';
import ParamBox from 'components/element/ParamBox';
import {t} from 'i18next';
import React from 'react';
import {IIPsecCACertificateMod} from 'types/ipsec';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface IPsecCACertUploadFormProps {
	onChange: (data: IIPsecCACertificateMod & {isValid?: boolean}) => void;
}

export default function IPsecCACertUploadForm(props: IPsecCACertUploadFormProps) {
	const {onChange} = props;

	const [form, setForm] = React.useState<IIPsecCACertificateMod>({
		name: '',
		certificate: '',
		description: '',
	});

	const validateForm = (data: IIPsecCACertificateMod): boolean => {
		if (data.name.trim().length === 0) return false;
		if (!data.certificate.includes('BEGIN CERTIFICATE')) return false;
		return true;
	};

	const handleChange = (field: keyof IIPsecCACertificateMod) => (val: any) => {
		const newForm = {...form, [field]: val};
		setForm(newForm);
		onChange({...newForm, isValid: validateForm(newForm)});
	};

	React.useEffect(() => {
		onChange({...form, isValid: validateForm(form)});
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	}, []);

	return (
		<NewBox item_name={t('Upload CA Certificate')}>
			<Stack spacing={2}>
				<Grid2 container spacing={2}>
					<ParamBox
						label={t('Name')}
						value={form.name}
						onChange={handleChange('name')}
						param_desc={{type: 'string', description: 'Unique CA name (referenced from tunnels for peer validation)', required: true}}
					/>
					<ParamBox
						label={t('Description')}
						value={form.description ?? ''}
						onChange={handleChange('description')}
						param_desc={{type: 'string', description: 'Optional description'}}
					/>
				</Grid2>
				<ParamBox
					label={t('CA Certificate (PEM)')}
					value={form.certificate}
					onChange={handleChange('certificate')}
					multiline
					minRows={5}
					param_desc={{type: 'string', description: 'PEM-encoded X.509 CA certificate', required: true}}
				/>
			</Stack>
		</NewBox>
	);
}
