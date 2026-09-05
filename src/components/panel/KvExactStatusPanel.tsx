//---------------------------------------------------------
// KV Exact Enforcement Status — the RESOLVED, live position
// of the data plane, deliberately separate from the declared configuration
// shown above it. Resolved status never rides the config object (dedicated
// read model), so nothing here can be replayed back as configuration.
//
// Display contract, pinned by tests:
// - READY renders Ready ONLY with an explicitly lifted fence; a POST 2xx
//   or a pending ladder state is never Ready (AC-07/08).
// - READY_FUNCTIONAL_ONLY is a distinct, warning-marked state (audited
//   opt-in without a manifest trust root) — never plain Ready.
// - Legacy rules show "Legacy / unattested" and hide strict-only fields.
// - Unknown states/reasons render RAW; unknown states count as not ready;
//   nothing throws (open vocabulary, AC-10).
// - goFenced=false ("fence lifted") and goFenced absent ("not reported")
//   render differently; fenced/non-ready is conveyed by text + icon, not
//   color alone.
// - requiredEvidenceLevel is what the binding REQUIRES — never rendered as
//   achieved validation.
// - C-01: no registry setDigest correlation — bindingDigest is shown
//   verbatim and compared to nothing.
//---------------------------------------------------------
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {Alert, Box, Button, Chip, CircularProgress, Divider, Grid2, Stack, Typography} from '@mui/material';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useKvExactStatus} from 'hooks/query/kvExactStatusHook';
import {t} from 'i18next';
import {classifyKvExactReadiness, IKvExactStatusEntry, KvExactReadiness} from 'types/ai_gateway';
import {IServiceArguments} from 'types/load_balancer';

function fenceLabel(fenced?: boolean): string {
	if (fenced === true) return t('Fenced — exact routing denied');
	if (fenced === false) return t('Fence lifted');
	return t('Not reported');
}

/** Headline for one entry: honest wording + an icon so state never rides color alone. */
export function readinessHeadline(readiness: KvExactReadiness): {severity: 'success' | 'info' | 'warning' | 'error'; icon: JSX.Element; text: string} {
	const raw = readiness.rawState;
	switch (readiness.kind) {
		case 'ready':
			return readiness.ready
				? {severity: 'success', icon: <CheckCircleOutlineIcon fontSize="small" />, text: t('Ready — fully attested and enforced')}
				: {severity: 'warning', icon: <BlockIcon fontSize="small" />, text: readiness.fenced === true ? t('READY reported but the fence is closed — exact routing is denied') : t('READY reported but the fence state is not reported — not treated as ready')};
		case 'ready-functional-only':
			return readiness.ready
				? {severity: 'warning', icon: <WarningAmberIcon fontSize="small" />, text: t('Ready (functional only) — audited opt-in without a manifest trust root')}
				: {severity: 'warning', icon: <BlockIcon fontSize="small" />, text: t('READY_FUNCTIONAL_ONLY reported but the fence is not lifted — exact routing is denied')};
		case 'pending':
			return {severity: 'info', icon: <HourglassEmptyIcon fontSize="small" />, text: t('Not ready — {{state}} (attestation in progress)', {state: raw})};
		case 'degrading':
			return {severity: 'warning', icon: <WarningAmberIcon fontSize="small" />, text: t('Degrading — fence-first re-attestation in progress')};
		case 'degraded':
			return {severity: 'error', icon: <BlockIcon fontSize="small" />, text: t('Degraded — fenced after a confirmed degradation; exact routing denied')};
		case 'fault':
			return {severity: 'error', icon: <ErrorOutlineIcon fontSize="small" />, text: t('Enforcement fault — fenced, not silently downgraded to legacy')};
		case 'requires-migration':
			return {severity: 'warning', icon: <BlockIcon fontSize="small" />, text: t('Requires migration — restored profile-less rule; exact routing fenced until a profile is attached')};
		case 'legacy':
			return {severity: 'info', icon: <WarningAmberIcon fontSize="small" />, text: t('Legacy / unattested — profile-less rule running the legacy behavior')};
		default:
			return {severity: 'warning', icon: <BlockIcon fontSize="small" />, text: t('Unknown state "{{state}}" — treated as not ready', {state: raw})};
	}
}

function EntryStatus({entry}: {entry: IKvExactStatusEntry}) {
	const readiness = classifyKvExactReadiness(entry);
	const headline = readinessHeadline(readiness);
	const isLegacy = readiness.kind === 'legacy';
	const enforcement = entry.enforcement;

	return (
		<Stack spacing={2}>
			<Alert severity={headline.severity} icon={headline.icon} role="status">
				{headline.text}
			</Alert>

			<ValueBunch name={t('Rule Identity')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Rule')} value={entry.ruleIdentity} tooltip={t('Stable opaque id of the load-balancer rule.')} />
					<SingleTextBox label={t('Model')} value={entry.modelName} />
					<SingleTextBox label={t('Engine Family')} value={entry.engineFamily} />
					<SingleTextBox label={t('API Surface')} value={entry.apiMode} tooltip={t('Effective KV-exact API surface declaration.')} />
				</Grid2>
			</ValueBunch>

			{!isLegacy && (
				<ValueBunch name={t('Binding Identity')}>
					<Grid2 container spacing={2}>
						<SingleTextBox label={t('Model Profile')} value={entry.modelProfileId} tooltip={t('Bound profile and the registry generation it was bound at.')} />
						<SingleTextBox label={t('Profile Generation')} value={entry.modelProfileGen} />
						<SingleTextBox label={t('Engine Contract')} value={entry.engineContractId ?? t('Not yet served')} />
						<SingleTextBox label={t('Contract Generation')} value={entry.engineContractGen} />
						<SingleTextBox label={t('Binding Generation')} value={entry.bindingGen} tooltip={t('Data-plane handle. The digest, never this number, is the identity proof.')} />
						<SingleTextBox label={t('Binding Digest')} value={entry.bindingDigest} tooltip={t('Full digest over the composed binding identity, shown verbatim.')} />
						<SingleTextBox label={t('Hash Contract')} value={entry.hashContractId} />
						<SingleTextBox label={t('Wire Schema')} value={entry.wireSchemaId ?? t('Not yet served')} />
						<SingleTextBox label={t('P/D Dialect')} value={entry.pdDialectId ?? t('Not yet served')} />
						<SingleTextBox label={t('Required Evidence Level')} value={entry.requiredEvidenceLevel} tooltip={t('What the binding REQUIRES of its engine tuple — a requirement, not an achieved validation.')} />
					</Grid2>
				</ValueBunch>
			)}

			<ValueBunch name={t('Attestation Ladder')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Desired State')} value={entry.desiredState} />
					<SingleTextBox label={t('Enforced State')} value={entry.enforcedState} tooltip={t('What the data plane actually enforces — pending machinery reports honestly.')} />
				</Grid2>
				{(entry.reasonCodes ?? []).length > 0 ? (
					<Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1}}>
						{entry.reasonCodes.map(reason => (
							<Chip key={reason} size="small" variant="outlined" label={reason} sx={{fontFamily: 'monospace'}} />
						))}
					</Box>
				) : (
					<Typography variant="caption" color="text.secondary">{t('No qualifying reason reported.')}</Typography>
				)}
			</ValueBunch>

			{!isLegacy && enforcement && (
				<ValueBunch name={t('Data-plane Enforcement')}>
					<Grid2 container spacing={2}>
						<SingleTextBox label={t('Desired')} value={enforcement.desired} />
						<SingleTextBox label={t('Enforced')} value={enforcement.enforced} />
						<SingleTextBox label={t('Fence')} value={fenceLabel(enforcement.goFenced)} tooltip={t('Fail-closed tokenize-bridge deny-set. A lifted fence (false) is distinct from an unreported one.')} />
						<SingleTextBox label={t('Last Full ACK')} value={enforcement.lastAckAt ?? t('None since registration/restart')} />
						{enforcement.fault && <SingleTextBox label={t('Fault')} value={enforcement.fault} />}
					</Grid2>
				</ValueBunch>
			)}
		</Stack>
	);
}

export default function KvExactStatusPanel({serviceArguments}: {serviceArguments: IServiceArguments}) {
	const inst = useInstanceFromURL();
	const exactMode = serviceArguments.kvExactMode ?? 0;
	const isExact = exactMode !== 0;
	const isStrict = Boolean(serviceArguments.kvModelProfile);

	// Mounted only on the visible panel tab; strict rules poll on the status
	// cadence, a legacy rule reads once (no polling), non-exact rules never
	// query at all.
	const statusQuery = useKvExactStatus(
		isExact ? inst : null,
		isExact
			? {
				externalIP: serviceArguments.externalIP,
				port: serviceArguments.port,
				protocol: serviceArguments.protocol,
				modelName: serviceArguments.model_name || undefined,
			}
			: null,
		isExact,
		isStrict,
	);

	if (!isExact) return null;

	const {data, error, isPending, refetch, isFetching} = statusQuery;
	const status = (error as any)?.status as number | undefined;

	return (
		<Stack spacing={2}>
			<Divider />
			<Typography variant="subtitle1">{t('KV Exact Enforcement Status')}</Typography>
			<Typography variant="caption" color="text.secondary">
				{t('Live enforcement position resolved from the gateway — separate from the declared configuration above. A saved rule is not ready until the data plane attests it.')}
			</Typography>

			{isPending && (
				<Stack direction="row" spacing={1} alignItems="center">
					<CircularProgress size={18} aria-label={t('Loading enforcement status...')} />
					<Typography variant="body2" color="text.secondary">{t('Reading enforcement status...')}</Typography>
				</Stack>
			)}

			{!isPending && error != null && (
				status === 422 ? (
					<Alert severity="error" icon={<ErrorOutlineIcon fontSize="small" />}>
						{t('The gateway rejected the status query as malformed (422). Retrying will not help; this indicates a rule-key defect.')}
					</Alert>
				) : status === 401 || status === 403 ? (
					<Alert severity="warning">{t("You don't have permission to read the KV-exact enforcement status.")}</Alert>
				) : (
					<Alert
						severity="error"
						action={<Button color="inherit" size="small" onClick={() => refetch()} disabled={isFetching}>{t('Retry')}</Button>}
					>
						{status === 503
							? t('Enforcement status is temporarily unavailable. Automatic retries are bounded; retry manually when the store recovers.')
							: t("Couldn't read the enforcement status. The server returned an error.")}
					</Alert>
				)
			)}

			{!isPending && !error && data === null && (
				<Alert severity="info">{t('No KV-exact status for this selection.')}</Alert>
			)}

			{!isPending && !error && Array.isArray(data) && data.map(entry => (
				<EntryStatus key={`${entry.ruleIdentity}-${entry.modelName}`} entry={entry} />
			))}
		</Stack>
	);
}
