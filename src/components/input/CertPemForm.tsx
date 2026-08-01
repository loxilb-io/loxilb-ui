//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert, Stack} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import {t} from 'i18next';
import React from 'react';
import {ICert} from 'types/security';

const PEM_CERT_RE = /-----BEGIN CERTIFICATE-----/;
const PEM_KEY_RE = /-----BEGIN (RSA |EC |ENCRYPTED )?PRIVATE KEY-----/;

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
/**
 * Inline-PEM upload/rotate form for the certId-keyed /config/cert store.
 * mode=upload: certId optional (server mints one when blank).
 * mode=rotate: certId required (the stable rotation handle).
 */
export default function CertPemForm(props: {mode: 'upload' | 'rotate'; onChange: (data: ICert & {isValid: boolean}) => void}) {
	const {mode, onChange} = props;

	const [form, setForm] = React.useState<ICert>({certId: '', certPem: '', keyPem: '', chainPem: ''});

	const validate = (data: ICert): boolean => {
		if (mode === 'rotate' && (data.certId ?? '').trim().length === 0) return false;
		if (!PEM_CERT_RE.test(data.certPem)) return false;
		if (!PEM_KEY_RE.test(data.keyPem)) return false;
		return true;
	};

	const handleChange = (field: keyof ICert) => (val: any) => {
		const newForm = {...form, [field]: val};
		setForm(newForm);
		onChange({...newForm, isValid: validate(newForm)});
	};

	return (
		<NewBox item_name={mode === 'rotate' ? t('Rotate Certificate (certId)') : t('Upload PEM Certificate')}>
			<Stack spacing={2}>
				<Alert severity="info">
					{mode === 'rotate'
						? t('Zero-downtime rotation: the new material replaces the existing certId; in-flight connections keep the old certificate until they close.')
						: t('Hostname(s) are derived automatically from the certificate SAN/CN and registered for SNI. Leave Cert ID blank to auto-generate one.')}
				</Alert>
				<ParamBox
					label={t('Cert ID')}
					value={form.certId ?? ''}
					onChange={handleChange('certId')}
					param_desc={{
						type: 'string',
						description: mode === 'rotate' ? 'Opaque handle of the certificate to rotate' : 'Optional stable handle (auto-generated when blank)',
						required: mode === 'rotate',
					}}
				/>
				<ParamBox
					label={t('Certificate (PEM)')}
					value={form.certPem}
					onChange={handleChange('certPem')}
					multiline
					param_desc={{type: 'string', description: 'Leaf certificate PEM (-----BEGIN CERTIFICATE-----)', required: true}}
				/>
				<ParamBox
					label={t('Private Key (PEM)')}
					value={form.keyPem}
					onChange={handleChange('keyPem')}
					multiline
					param_desc={{type: 'string', description: 'Private key PEM — stored 0600, never returned by the API', required: true}}
				/>
				<ParamBox
					label={t('Chain (PEM, optional)')}
					value={form.chainPem ?? ''}
					onChange={handleChange('chainPem')}
					multiline
					param_desc={{type: 'string', description: 'Intermediate CA chain PEM'}}
				/>
			</Stack>
		</NewBox>
	);
}
