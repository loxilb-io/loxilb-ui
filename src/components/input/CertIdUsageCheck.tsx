//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert, Button, Stack} from '@mui/material';
import {opErrorText} from 'connector/fetcher/opResultText';
import {CertLookup, lookup_cert} from 'connector/instance/cert';
import {certUsageName} from 'components/panel/CertLookupPanel';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {t} from 'i18next';
import {useEffect, useRef, useState} from 'react';
import {isCertId} from 'types/backend_tls';
import {CertUsage} from 'types/security';

//---------------------------------------------------------
// Check a typed certificate ID against the usage a field needs.
//---------------------------------------------------------
// A rule names its backend CA bundle and client certificate by ID, and no
// list of them exists, so the IDs are typed. This asks the gateway whether a
// typed ID is stored and what it is stored as.
//
// It is a check at one moment, on request. The entry can be deleted or
// replaced before the rule is submitted, and the gateway decides then; the
// answer is cleared as soon as the ID changes so it cannot outlive it.

export type CertIdVerdict = 'ok' | 'wrong-usage' | 'absent' | 'error';

export function certIdVerdict(result: CertLookup, expected: CertUsage): CertIdVerdict {
	if (result.kind !== 'found') return result.kind;
	return result.cert.usage === expected ? 'ok' : 'wrong-usage';
}

function verdictText(certId: string, result: CertLookup, expected: CertUsage): string {
	switch (result.kind) {
		case 'absent':
			return t('No certificate is stored under the ID "{{id}}". Upload it on the SNI Certificates page first.', {id: certId});
		case 'error':
			return t('The ID "{{id}}" could not be looked up, so whether it exists is not known. {{error}}', {id: certId, error: opErrorText(result.result)});
		default:
			return result.cert.usage === expected
				? t('"{{id}}" is stored as: {{usage}}. Checked just now; the gateway checks again when the rule is submitted.', {id: certId, usage: certUsageName(result.cert.usage)})
				: t('"{{id}}" is stored as: {{usage}}. This field needs: {{expected}}.', {id: certId, usage: certUsageName(result.cert.usage), expected: certUsageName(expected)});
	}
}

const SEVERITY: Record<CertIdVerdict, 'success' | 'warning' | 'error'> = {ok: 'success', 'wrong-usage': 'error', absent: 'warning', error: 'error'};

export default function CertIdUsageCheck(props: {certId: string | undefined; expected: CertUsage; label: string; disabled?: boolean}) {
	const {expected, label, disabled} = props;
	const instance = useInstanceFromURL();
	const certId = (props.certId ?? '').trim();
	const [busy, setBusy] = useState(false);
	const [answer, setAnswer] = useState<CertLookup | null>(null);
	const latest = useRef(0);

	const instanceId = instance?.id;
	useEffect(() => {
		latest.current += 1;
		setAnswer(null);
		setBusy(false);
	}, [certId, instanceId]);

	const handleCheck = async () => {
		if (!instance) return;
		const ticket = ++latest.current;
		setBusy(true);
		setAnswer(null);
		const result = await lookup_cert(instance, certId);
		if (ticket !== latest.current) return;
		setAnswer(result);
		setBusy(false);
	};

	return (
		<Stack spacing={1} alignItems="flex-start">
			<Button size="small" variant="outlined" onClick={handleCheck} disabled={disabled || !instance || !isCertId(certId) || busy}>
				{label}
			</Button>
			<div aria-live="polite">{answer && <Alert severity={SEVERITY[certIdVerdict(answer, expected)]}>{verdictText(certId, answer, expected)}</Alert>}</div>
		</Stack>
	);
}
