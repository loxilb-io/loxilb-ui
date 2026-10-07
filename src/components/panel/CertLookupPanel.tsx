//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import SearchIcon from '@mui/icons-material/Search';
import {Alert, Button, Grid2, Stack, TextField, Typography} from '@mui/material';
import SingleTextBox from 'components/element/SingleTextBox';
import {opErrorText} from 'connector/fetcher/opResultText';
import {CertLookup, lookup_cert} from 'connector/instance/cert';
import {t} from 'i18next';
import {useEffect, useRef, useState} from 'react';
import {isCertId} from 'types/backend_tls';
import {IInstance} from 'types/oam';
import {CertUsage} from 'types/security';

//---------------------------------------------------------
// Certificate store lookup, one ID at a time.
//---------------------------------------------------------
// The table on this page lists SNI hostnames — listener certificates. A CA
// bundle or a client certificate registers no hostname and so has no row
// there, and the gateway has no list of the store. An entry is found by the
// ID it was uploaded under, and only that way.
//
// The answer is one moment's read. It is cleared when the ID or the instance
// changes, so a result never sits beside an ID it was not read for.

const USAGE_NAMES: Record<CertUsage, string> = {
	server: 'Listener certificate (SNI)',
	ca: 'Backend CA bundle',
	client: 'Backend client certificate',
};

/** The usage by the name the upload form gives it; one this UI does not know is shown as sent. */
export function certUsageName(usage: string): string {
	return Object.prototype.hasOwnProperty.call(USAGE_NAMES, usage) ? t(USAGE_NAMES[usage as CertUsage]) : usage;
}

export function CertLookupResult({certId, result}: {certId: string; result: CertLookup}) {
	if (result.kind === 'absent') {
		return <Alert severity="warning">{t('No certificate is stored under the ID "{{id}}".', {id: certId})}</Alert>;
	}
	if (result.kind === 'error') {
		return <Alert severity="error">{t('The ID "{{id}}" could not be looked up, so whether it exists is not known. {{error}}', {id: certId, error: opErrorText(result.result)})}</Alert>;
	}
	const {cert} = result;
	return (
		<Grid2 container spacing={2}>
			<SingleTextBox label={t('Cert ID')} value={cert.certId} />
			<SingleTextBox label={t('Certificate Usage')} value={certUsageName(cert.usage)} />
			<SingleTextBox label={t('Certificates')} value={cert.certificates} tooltip={t('Certificates in the entry: one for a leaf certificate, one or more for a CA bundle.')} />
			<SingleTextBox label={t('Chain Certificates')} value={cert.chainCertificates} />
			<SingleTextBox
				label={t('SNI Hostnames')}
				value={cert.hostnames.length > 0 ? cert.hostnames.join(', ') : t('None registered')}
				width="wide"
				tooltip={t('Hostnames registered for SNI from the certificate. A CA bundle or a client certificate registers none.')}
			/>
		</Grid2>
	);
}

export default function CertLookupPanel({instance}: {instance: IInstance | null}) {
	const [certId, setCertId] = useState('');
	const [busy, setBusy] = useState(false);
	const [answer, setAnswer] = useState<{certId: string; result: CertLookup} | null>(null);
	// Only the newest lookup may answer: a slow read for an earlier ID must
	// not land on the one typed since.
	const latest = useRef(0);

	const instanceId = instance?.id;
	useEffect(() => {
		latest.current += 1;
		setAnswer(null);
		setBusy(false);
	}, [instanceId]);

	const id = certId.trim();
	const invalid = id !== '' && !isCertId(id);

	const handleLookup = async () => {
		if (!instance || id === '' || invalid) return;
		const ticket = ++latest.current;
		setBusy(true);
		setAnswer(null);
		const result = await lookup_cert(instance, id);
		if (ticket !== latest.current) return;
		setAnswer({certId: id, result});
		setBusy(false);
	};

	return (
		<Stack spacing={1.5} sx={{mb: 2}} data-testid="cert-lookup">
			<Typography variant="subtitle2" component="h2">
				{t('Look Up a Certificate by ID')}
			</Typography>
			<Typography variant="body2" color="text.secondary">
				{t('The table below lists SNI hostnames only. A backend CA bundle or client certificate has no row there, and the gateway keeps no list of stored certificates: an entry is found by its ID.')}
			</Typography>
			<Stack direction="row" spacing={1} alignItems="flex-start">
				<TextField
					size="small"
					label={t('Cert ID')}
					value={certId}
					onChange={e => {
						latest.current += 1;
						setCertId(e.target.value);
						setAnswer(null);
						setBusy(false);
					}}
					onKeyDown={e => {
						if (e.key === 'Enter') handleLookup();
					}}
					error={invalid}
					helperText={invalid ? t('Not a certificate ID: at most 63 bytes, without a path separator or "..".') : undefined}
					sx={{minWidth: 280}}
				/>
				<Button variant="outlined" startIcon={<SearchIcon />} onClick={handleLookup} disabled={!instance || id === '' || invalid || busy} sx={{height: 40}}>
					{t('Look Up')}
				</Button>
			</Stack>
			{/* A live region, so the answer is announced and not just painted. */}
			<div aria-live="polite">{answer && <CertLookupResult certId={answer.certId} result={answer.result} />}</div>
		</Stack>
	);
}
