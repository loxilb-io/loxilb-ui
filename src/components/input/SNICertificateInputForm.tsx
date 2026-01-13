//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import NewBox from 'components/layout/NewBox';
import ParamBox from 'components/element/ParamBox';
import {t} from 'i18next';
import {ISNICertificateEntry} from 'types/security';
import React from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface SNICertificateInputFormProps {
	value?: ISNICertificateEntry;
	onChange: (data: ISNICertificateEntry & {isValid?: boolean}) => void;
}

export default function SNICertificateInputForm(props: SNICertificateInputFormProps) {
	const {onChange} = props;

	const [form, setForm] = React.useState<ISNICertificateEntry>({
		hostname: '',
		certPath: '',
	});

	const handleChange = (field: keyof ISNICertificateEntry) => (value: any) => {
		const newForm = {...form, [field]: value};
		setForm(newForm);
		onChange({...newForm, isValid: validateForm(newForm)});
	};

	const validateForm = (data: ISNICertificateEntry): boolean => {
		if (!data.hostname || data.hostname.trim().length === 0) return false;
		return true;
	};

	React.useEffect(() => {
		onChange({...form, isValid: validateForm(form)});
	}, []);

	return (
		<NewBox item_name={t('SNI Certificate Registration')}>
			<Stack spacing={3}>
				<ParamBox
					label={t('Hostname')}
					value={form.hostname}
					onChange={handleChange('hostname')}
					param_desc={{
						type: 'string',
						description: "Hostname for SNI certificate (e.g., api.example.com). This certificate will be automatically used by all loadbalancer rules that have matching 'host' field.",
						required: true,
					}}
				/>
				<ParamBox
					label={t('Certificate Path (Optional)')}
					value={form.certPath || ''}
					onChange={handleChange('certPath')}
					param_desc={{
						type: 'string',
						description: 'Optional certificate directory path (defaults to /opt/loxilb/cert/{hostname}). Directory must contain server.crt, server.key, and optionally rootCA.crt for mTLS.',
					}}
				/>
			</Stack>
		</NewBox>
	);
}
