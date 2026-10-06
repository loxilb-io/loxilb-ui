//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert, Stack} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import {t} from 'i18next';
import React from 'react';
import {IEnumItem} from 'types/global';
import {CertUsage, ICert, isBackendCertUsage} from 'types/security';

const PEM_CERT_RE = /-----BEGIN CERTIFICATE-----/;
const PEM_KEY_RE = /-----BEGIN (RSA |EC |ENCRYPTED )?PRIVATE KEY-----/;

type Mode = 'upload' | 'rotate';

/**
 * Whether the material can be sent. Mirrors what the gateway refuses, so the
 * button does not offer a request that is known to fail:
 *  - a rotation names the certificate it replaces;
 *  - a CA bundle is certificates only, a key sent with one is refused;
 *  - a CA or client entry is referred to by its ID from a rule and appears in
 *    no list, so an ID the operator did not choose could not be used.
 */
export function isCertFormValid(mode: Mode, data: ICert): boolean {
	const backend = isBackendCertUsage(data.usage);
	if ((mode === 'rotate' || backend) && (data.certId ?? '').trim().length === 0) return false;
	if (!PEM_CERT_RE.test(data.certPem)) return false;
	if (data.usage === 'ca') return data.keyPem.trim() === '';
	return PEM_KEY_RE.test(data.keyPem);
}

/**
 * The request body for the form's state. `usage` travels only for a CA or a
 * client entry: `server` is the default, and a gateway that predates the field
 * is sent exactly what it was sent before. A CA bundle carries `keyPem` as the
 * empty string, which the gateway requires to be present.
 */
export function certFormToRequest(data: ICert): ICert {
	const {usage, certId, ...rest} = data;
	const body: ICert = {...rest, keyPem: usage === 'ca' ? '' : rest.keyPem};
	if ((certId ?? '').trim() !== '') body.certId = certId;
	if (isBackendCertUsage(usage)) body.usage = usage;
	return body;
}

const USAGE_OPTIONS: IEnumItem[] = [
	{id: 0, name: 'Listener certificate (SNI)', send_value: 'server'},
	{id: 1, name: 'Backend CA bundle', send_value: 'ca'},
	{id: 2, name: 'Backend client certificate', send_value: 'client'},
];

function usageNote(mode: Mode, usage: CertUsage): string {
	if (usage === 'ca') {
		return mode === 'rotate'
			? t('Replaces the CA bundle under this ID. Every rule that verifies its backends against it is updated before the request returns.')
			: t('A bundle of CA certificates that a rule verifies its backends against. It holds no private key and is offered to no client. A rule refers to it by this ID.');
	}
	if (usage === 'client') {
		return mode === 'rotate'
			? t('Replaces the client certificate under this ID. Every rule that presents it to its backends is updated before the request returns.')
			: t('The certificate and key a rule presents to backends that ask for one. It is offered to no client. A rule refers to it by this ID.');
	}
	return mode === 'rotate'
		? t('Zero-downtime rotation: the new material replaces the existing certId; in-flight connections keep the old certificate until they close.')
		: t('Hostname(s) are derived automatically from the certificate SAN/CN and registered for SNI. Leave Cert ID blank to auto-generate one.');
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
/**
 * Inline-PEM upload/rotate form for the certId-keyed /config/cert store.
 * mode=upload: certId optional for a listener certificate (server mints one
 * when blank), required for a CA bundle or a client certificate.
 * mode=rotate: certId required (the stable rotation handle).
 *
 * `usageDeclared` says whether THIS gateway declares `usage` in its schema.
 * One that does not stores every entry as a listener certificate, so the
 * choice is not offered there.
 */
export default function CertPemForm(props: {mode: Mode; usageDeclared?: boolean; onChange: (data: ICert & {isValid: boolean}) => void}) {
	const {mode, usageDeclared = false, onChange} = props;

	const [form, setForm] = React.useState<ICert>({usage: 'server', certId: '', certPem: '', keyPem: '', chainPem: ''});
	const usage: CertUsage = usageDeclared ? form.usage ?? 'server' : 'server';
	const backend = isBackendCertUsage(usage);

	const handleChange = (field: keyof ICert) => (val: any) => {
		// A CA bundle has no key field. A key typed before the choice would stay
		// in the state unseen, so it is dropped with the field that held it.
		const newForm = {...form, [field]: val, ...(field === 'usage' && val === 'ca' ? {keyPem: ''} : {})};
		setForm(newForm);
		const effective = {...newForm, usage: usageDeclared ? newForm.usage : 'server'} as ICert;
		onChange({...certFormToRequest(effective), isValid: isCertFormValid(mode, effective)});
	};

	return (
		<NewBox item_name={mode === 'rotate' ? t('Rotate Certificate (certId)') : t('Upload PEM Certificate')}>
			<Stack spacing={2}>
				{usageDeclared && (
					<ParamBox
						label={t('Certificate Usage')}
						value={usage}
						onChange={handleChange('usage')}
						param_desc={{
							type: 'string',
							description:
								mode === 'rotate'
									? 'What the certificate under this ID is for. It was fixed when the ID was created; a rotation cannot change it.'
									: 'What the entry is for. It is fixed when the ID is created.',
							enum: USAGE_OPTIONS.map(option => ({...option, name: t(option.name)})),
							required: true,
						}}
					/>
				)}
				<Alert severity="info">{usageNote(mode, usage)}</Alert>
				<ParamBox
					label={t('Cert ID')}
					value={form.certId ?? ''}
					onChange={handleChange('certId')}
					param_desc={{
						type: 'string',
						description:
							mode === 'rotate'
								? 'Opaque handle of the certificate to rotate'
								: backend
									? 'The handle a load-balancer rule refers to this entry by'
									: 'Optional stable handle (auto-generated when blank)',
						required: mode === 'rotate' || backend,
					}}
				/>
				<ParamBox
					label={usage === 'ca' ? t('CA Certificate(s) (PEM)') : t('Certificate (PEM)')}
					value={form.certPem}
					onChange={handleChange('certPem')}
					multiline
					param_desc={{
						type: 'string',
						description: usage === 'ca' ? 'One or more CA certificates in PEM (-----BEGIN CERTIFICATE-----)' : 'Leaf certificate PEM (-----BEGIN CERTIFICATE-----)',
						required: true,
					}}
				/>
				{usage !== 'ca' && (
					<ParamBox
						label={t('Private Key (PEM)')}
						value={form.keyPem}
						onChange={handleChange('keyPem')}
						multiline
						param_desc={{type: 'string', description: 'Private key PEM — stored 0600, never returned by the API', required: true}}
					/>
				)}
				<ParamBox
					label={usage === 'ca' ? t('More CA Certificates (PEM, optional)') : t('Chain (PEM, optional)')}
					value={form.chainPem ?? ''}
					onChange={handleChange('chainPem')}
					multiline
					param_desc={{type: 'string', description: usage === 'ca' ? 'Further CA certificates of the same bundle' : 'Intermediate CA chain PEM'}}
				/>
			</Stack>
		</NewBox>
	);
}
