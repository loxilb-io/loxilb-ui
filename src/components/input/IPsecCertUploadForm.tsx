//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert, Button, Grid2, Stack} from '@mui/material';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import NewBox from 'components/layout/NewBox';
import ParamBox from 'components/element/ParamBox';
import {request_validate_ipsec_certificate} from 'connector/instance/ipsec';
import {t} from 'i18next';
import React from 'react';
import {IIPsecCertValidation, IIPsecCertificateMod} from 'types/ipsec';
import {IInstance} from 'types/oam';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface IPsecCertUploadFormProps {
	instance: IInstance | null;
	onChange: (data: IIPsecCertificateMod & {isValid?: boolean}) => void;
}

export default function IPsecCertUploadForm(props: IPsecCertUploadFormProps) {
	const {instance, onChange} = props;

	const [form, setForm] = React.useState<IIPsecCertificateMod>({
		name: '',
		certificate: '',
		privateKey: '',
		passphrase: '',
		description: '',
	});
	const [validation, setValidation] = React.useState<IIPsecCertValidation | null>(null);

	const validateForm = (data: IIPsecCertificateMod): boolean => {
		if (data.name.trim().length === 0) return false;
		if (!data.certificate.includes('BEGIN CERTIFICATE')) return false;
		if (!data.privateKey.includes('PRIVATE KEY')) return false;
		return true;
	};

	const handleChange = (field: keyof IIPsecCertificateMod) => (val: any) => {
		const newForm = {...form, [field]: val};
		setForm(newForm);
		setValidation(null); // stale after any edit
		onChange({...newForm, isValid: validateForm(newForm)});
	};

	// Server-side validation via /config/ipsec/certificates/validate —
	// parses the PEM without installing anything.
	const handleValidate = async () => {
		if (!instance) return;
		const result = await request_validate_ipsec_certificate(instance, {
			...form,
			name: form.name.trim() || 'validate-check',
		});
		setValidation(result ?? {valid: false, errors: [t('Validation request failed')]});
	};

	React.useEffect(() => {
		onChange({...form, isValid: validateForm(form)});
	}, []);

	return (
		<NewBox item_name={t('Upload IPsec Certificate')}>
			<Stack spacing={2}>
				<Grid2 container spacing={2}>
					<ParamBox
						label={t('Name')}
						value={form.name}
						onChange={handleChange('name')}
						param_desc={{type: 'string', description: 'Unique certificate name (referenced from tunnels)', required: true}}
					/>
					<ParamBox
						label={t('Description')}
						value={form.description ?? ''}
						onChange={handleChange('description')}
						param_desc={{type: 'string', description: 'Optional description'}}
					/>
				</Grid2>
				<ParamBox
					label={t('Certificate (PEM)')}
					value={form.certificate}
					onChange={handleChange('certificate')}
					multiline
					minRows={5}
					param_desc={{type: 'string', description: 'PEM-encoded X.509 certificate (-----BEGIN CERTIFICATE-----)', required: true}}
				/>
				<ParamBox
					label={t('Private Key (PEM)')}
					value={form.privateKey}
					onChange={handleChange('privateKey')}
					multiline
					minRows={5}
					param_desc={{type: 'string', description: 'PEM-encoded private key — stored on the gateway only', required: true}}
				/>
				<ParamBox
					label={t('Key Passphrase')}
					value={form.passphrase ?? ''}
					onChange={handleChange('passphrase')}
					param_desc={{type: 'string', description: 'Only if the private key is encrypted'}}
				/>

				<Stack direction="row" spacing={2} alignItems="center">
					<Button variant="outlined" size="small" startIcon={<FactCheckIcon />} onClick={handleValidate} disabled={!form.certificate || !form.privateKey}>
						{t('Validate on Gateway')}
					</Button>
				</Stack>

				{validation && validation.valid && (
					<Alert severity={validation.warnings && validation.warnings.length > 0 ? 'warning' : 'success'}>
						{t('Valid')}: {validation.subject} — {validation.keyAlgorithm} {validation.keySize}, {t('expires')} {validation.notAfter}
						{(validation.warnings ?? []).map((w, i) => (
							<div key={i}>{w}</div>
						))}
					</Alert>
				)}
				{validation && !validation.valid && (
					<Alert severity="error">
						{(validation.errors ?? [t('Invalid certificate')]).map((e, i) => (
							<div key={i}>{e}</div>
						))}
					</Alert>
				)}
			</Stack>
		</NewBox>
	);
}
