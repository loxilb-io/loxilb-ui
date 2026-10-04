//---------------------------------------------------------
// Bearer (JWT) admission verdicts — J3, on the AI Traffic page
//---------------------------------------------------------
// `loxilb_ai_jwt_validation_total{tenant,reason}` counts one verdict per call
// into the bearer gate. Before it existed, a bearer denial was visible only as
// a change in the shape of `loxilb_ai_requests_total`, which cannot tell a
// clock skew from an expired signing key from someone probing with forged
// tokens — and those need opposite responses.
//
// ⚠️ Two things this panel must not do:
//   - print 0/s when the family is absent. It is
//     conditional-with-proven-writer: nothing exports until a rule selects the
//     bearer arm AND a request carrying an Authorization header reaches it, so
//     absence is a precondition and "0/s" would assert bearer auth is
//     configured and merely idle.
//   - read a tenant of "-" as a missing label. Most refusals happen BEFORE a
//     signature is verified, so there is no tenant that can be trusted;
//     attributing them to an unverified claim would let an unauthenticated
//     caller choose a label value.

import {Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography} from '@mui/material';
import type {TFunction} from 'i18next';
import {BearerAdmission, BearerReasonClass, JWT_LABEL_ABSENT} from 'observability/jwtAuth';
import {useTranslation} from 'react-i18next';
import {formatRate} from './rateText';
import {StatRow} from './panelLayout';

// Only the gateway's own fault gets an alarming colour. A caller presenting a
// bad token is the system working, and painting that red trains operators to
// ignore the row that does mean something.
function classChip(reasonClass: BearerReasonClass, t: TFunction): {color: 'success' | 'error' | 'warning' | 'default'; label: string} {
	switch (reasonClass) {
		case 'admitted':
			return {color: 'success', label: t('Admitted')};
		case 'credential':
			return {color: 'default', label: t('Caller credential')};
		case 'authorization':
			return {color: 'warning', label: t('Not authorized')};
		case 'gateway-fault':
			return {color: 'error', label: t('Gateway fault')};
		case 'unclassified':
			// Upstream records promoting the finer reason taxonomy onto this
			// label as an open decision, so a value this build has never seen
			// is expected. Show it as itself rather than guess its meaning.
			return {color: 'default', label: t('Unrecognized reason')};
	}
}

function Tenants({tenants}: {tenants: readonly string[]}) {
	const {t} = useTranslation();
	const named = tenants.filter(x => x !== JWT_LABEL_ABSENT);
	if (named.length === 0) {
		return (
			<Typography variant="body2" color="text.secondary" component="span">
				{t('Unattributed (denied before verification)')}
			</Typography>
		);
	}
	return <>{named.join(', ')}</>;
}

export default function BearerAdmissionPanel({admission}: {admission: BearerAdmission}) {
	const {t} = useTranslation();

	if (admission.kind !== 'ok') {
		return (
			<Typography variant="body2" color="text.secondary">
				{admission.kind === 'not-exported'
					? t('No bearer verdicts recorded. This fills once an LB rule selects the JWT arm and a request carrying an Authorization header reaches it.')
					: t('N/A')}
			</Typography>
		);
	}

	return (
		<>
			<StatRow label={t('Admitted')} value={formatRate(admission.admitted, t)} />
			<StatRow label={t('Denied')} value={formatRate(admission.denied, t)} />
			{/* Called out on its own line: this is the gateway failing closed and
			    refusing traffic it should have served, which needs an operator —
			    unlike a caller turning up with a bad token. */}
			<StatRow label={t('Denied by gateway fault')} value={formatRate(admission.gatewayFault, t)} />
			<Table size="small" sx={{mt: 1}}>
				<TableHead>
					<TableRow>
						<TableCell>{t('Reason')}</TableCell>
						<TableCell>{t('Class')}</TableCell>
						<TableCell>{t('Tenant')}</TableCell>
						<TableCell align="right">{t('Rate')}</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{admission.byReason.map(r => {
						const chip = classChip(r.reasonClass, t);
						return (
							<TableRow key={r.reason}>
								<TableCell sx={{fontFamily: 'monospace'}}>{r.reason}</TableCell>
								<TableCell>
									<Chip size="small" variant="outlined" color={chip.color} label={chip.label} />
								</TableCell>
								<TableCell>
									<Tenants tenants={r.tenants} />
								</TableCell>
								<TableCell align="right">{formatRate(r.rate, t)}</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</>
	);
}
