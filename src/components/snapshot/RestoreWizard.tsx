//---------------------------------------------------------
// Restore wizard (docs/SNAPSHOT_UI_DESIGN.md §5.2).
//
// Two-step modal mirroring the API's dry-run-first contract:
//   1. DRY-RUN (automatic on open) — compatibility + plan table; errors
//      disable Commit.
//   2. COMMIT confirmation — typed instance-name gate, then the awaited
//      commit call (seconds-scale, no polling), then the result screen
//      rendered VERBATIM from the commit response: ok / rolled-back /
//      ROLLBACK-FAILED each render distinctly and honestly.
//
// A purpose-built MUI Dialog (mounts under .MuiModal-root so the shared E2E
// dialog helpers keep working) — the global PopUp can't hold multi-step flows.
//---------------------------------------------------------
import {
	Alert,
	AlertTitle,
	Box,
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	LinearProgress,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableRow,
	TextField,
	Typography,
} from '@mui/material';
import {request_restore_snapshot} from 'connector/oam/snapshotApi';
import {t} from 'i18next';
import React from 'react';
import {IGatewayRestoreResult, IRestoreOutcomeParsed, ISnapshot, TRestoreWizardStep} from 'types/snapshot';
import {retryAfterSeconds} from 'utils/retryAfter';
import {asRestoreResult, canContinueToCommit, classifyCommitResult, classifyDryRun, gatewayRefusalText} from './wizardLogic';
import {snapshotOpErrorText} from './snapshotOpError';

//---------------------------------------------------------
// Sub-renderers
//---------------------------------------------------------
function PlanTable(props: {plan: IGatewayRestoreResult['plan']}) {
	const plan = props.plan ?? [];
	if (plan.length === 0) return null;
	return (
		<Box sx={{overflowX: 'auto'}}>
			<Table size="small" aria-label={t('Restore plan')}>
				<TableHead>
					<TableRow>
						<TableCell>{t('Domain')}</TableCell>
						<TableCell align="right">{t('To Delete')}</TableCell>
						<TableCell align="right">{t('To Apply')}</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{plan.map((p, i) => (
						<TableRow key={i}>
							<TableCell>{p.domain}</TableCell>
							<TableCell align="right">{p.to_delete ?? 0}</TableCell>
							<TableCell align="right">{p.to_apply ?? 0}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</Box>
	);
}

/**
 * The gateway's non-fatal findings. Rendered wherever a result or a dry-run is
 * shown — INCLUDING a success, which is the case that used to drop them: a
 * restore that re-encrypted inbound secrets, could not verify an optional
 * recovery dependency, or skipped duplicate items still returns result "ok",
 * and saying only "succeeded" reports a cleaner outcome than the gateway did.
 */
function WarningList(props: {warnings?: string[]}) {
	const warnings = props.warnings ?? [];
	if (warnings.length === 0) return null;
	return (
		<Box sx={{mt: 1}}>
			<Typography variant="body2" sx={{fontWeight: 600}}>
				{t('Warnings')}
			</Typography>
			<Box component="ul" sx={{mt: 0.5, mb: 0, pl: 3}}>
				{warnings.map((w, i) => (
					<li key={i}>
						<Typography variant="body2" sx={{wordBreak: 'break-word'}}>
							{w}
						</Typography>
					</li>
				))}
			</Box>
		</Box>
	);
}

function ErrorList(props: {errors?: string[] | null}) {
	const errors = props.errors ?? [];
	if (errors.length === 0) return null;
	return (
		<Box component="ul" sx={{mt: 1, mb: 0, pl: 3}}>
			{errors.map((e, i) => (
				<li key={i}>
					<Typography variant="body2" sx={{wordBreak: 'break-word'}}>
						{e}
					</Typography>
				</li>
			))}
		</Box>
	);
}

// The wait the gateway asked for, and only when it asked for one.
function RetryAfterNote(props: {outcome: IRestoreOutcomeParsed | null}) {
	const seconds = retryAfterSeconds(props.outcome?.gateway_retry_after);
	if (seconds === null) return null;
	return <Typography variant="body2">{t('Try again in {{seconds}} s.', {seconds})}</Typography>;
}

// A body that is not a restore result: the gateway's sentence when it has
// one, else the body as it arrived.
function RawGatewayBody(props: {body: unknown}) {
	const text = gatewayRefusalText(props.body) ?? JSON.stringify(props.body ?? {}, null, 1);
	return (
		<Typography variant="body2" sx={{whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace'}}>
			{text}
		</Typography>
	);
}

/** Exported for tests: what Step 1 says about a dry-run the gateway answered. */
export function DryRunResult(props: {outcome: IRestoreOutcomeParsed}) {
	const {outcome} = props;
	const verdict = classifyDryRun(outcome, null);
	const gw = asRestoreResult(outcome.gateway_response);
	const title =
		verdict === 'pass'
			? t('Dry-run passed — the snapshot is applicable')
			: verdict === 'busy'
				? t('The gateway cannot run a restore right now (HTTP {{code}})', {code: outcome.gateway_status ?? '?'})
				: verdict === 'refused'
					? t('This snapshot cannot be restored')
					: t('The dry-run answer could not be read');
	const unverified = verdict === 'unreadable' && <Typography variant="body2">{t('Nothing was verified, so the restore cannot continue.')}</Typography>;

	// The gateway's error envelope, or a body that is no JSON object: there is
	// no schema, compatibility or plan to report.
	if (gw === null) {
		return (
			<Alert severity="error">
				<AlertTitle>{title}</AlertTitle>
				{unverified}
				<RawGatewayBody body={outcome.gateway_response} />
				<RetryAfterNote outcome={outcome} />
			</Alert>
		);
	}

	// Only meaningful when the gateway reported both versions (a rejected
	// document can come back with an empty snapshot_gateway_version).
	const versionNote =
		gw.snapshot_gateway_version && gw.current_gateway_version && gw.snapshot_gateway_version !== gw.current_gateway_version
			? t('Snapshot was taken on gateway {{from}}; the target runs {{to}}.', {from: gw.snapshot_gateway_version, to: gw.current_gateway_version})
			: null;

	return (
		<Stack spacing={2}>
			<Alert severity={verdict === 'pass' ? 'success' : 'error'}>
				<AlertTitle>{title}</AlertTitle>
				{unverified}
				{typeof gw.compatible === 'boolean' && (
					<Typography variant="body2">
						{t('Schema')} {gw.schema_version || '?'} · {gw.compatible ? t('compatible') : t('incompatible')}
					</Typography>
				)}
				{versionNote && <Typography variant="body2">{versionNote}</Typography>}
				{outcome.cross_instance && (
					<Typography variant="body2">{t('⚠ Cross-instance restore: this snapshot was taken from a different instance.')}</Typography>
				)}
				<ErrorList errors={gw.errors} />
				<WarningList warnings={gw.warnings} />
				<RetryAfterNote outcome={outcome} />
			</Alert>
			<PlanTable plan={gw.plan} />
		</Stack>
	);
}

// Renders the commit outcome verbatim — one panel per §5.2 branch.
/** Exported for tests: the commit/dry-run outcome rendering is the honesty
 *  surface, so it is asserted directly rather than through the whole wizard. */
export function CommitResult(props: {outcome: IRestoreOutcomeParsed | null; oamError: string | null; instanceName: string}) {
	const {outcome, oamError, instanceName} = props;
	const branch = classifyCommitResult(outcome, oamError);

	if (branch === 'oam-error') {
		return (
			<Alert severity="error">
				<AlertTitle>{t('Restore failed before reaching the gateway')}</AlertTitle>
				<Typography variant="body2" sx={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
					{oamError}
				</Typography>
			</Alert>
		);
	}

	const gw = asRestoreResult(outcome?.gateway_response);

	if (branch === 'ok') {
		return (
			<Alert severity="success">
				<AlertTitle>{gw?.warnings?.length ? t('Restore succeeded with warnings') : t('Restore succeeded')}</AlertTitle>
				<Typography variant="body2">
					{t('Snapshot applied to {{name}} and verified by the gateway.', {name: instanceName})}
				</Typography>
				<PlanTable plan={gw?.plan} />
				<ErrorList errors={gw?.errors} />
				<WarningList warnings={gw?.warnings} />
			</Alert>
		);
	}

	// Applied, but a restart undoes it (or nothing says it will not). The
	// gateway puts its reason in `errors` while still answering "ok".
	if (branch === 'ok-not-durable' || branch === 'ok-durability-unreported') {
		const notDurable = branch === 'ok-not-durable';
		return (
			<Alert severity="warning">
				<AlertTitle>
					{notDurable
						? t('Restore applied, but not saved for restart')
						: t('Restore applied; the gateway did not say whether it was saved for restart')}
				</AlertTitle>
				<Typography variant="body2">
					{notDurable
						? t(
								'The snapshot is live on {{name}} now, but the gateway could not write it to its boot configuration. A restart brings back the configuration from before this restore.',
								{name: instanceName},
							)
						: t(
								'The snapshot is live on {{name}} now. This gateway did not report whether it wrote the result to its boot configuration, so do not assume it survives a restart.',
								{name: instanceName},
							)}
				</Typography>
				<ErrorList errors={gw?.errors} />
				<PlanTable plan={gw?.plan} />
				<WarningList warnings={gw?.warnings} />
			</Alert>
		);
	}

	if (branch === 'rolled-back') {
		return (
			<Alert severity="warning">
				<AlertTitle>{t('Restore failed and was rolled back')}</AlertTitle>
				<Typography variant="body2">
					{t('The gateway could not apply the snapshot and restored the original configuration. The instance is running its previous config.')}
				</Typography>
				<ErrorList errors={gw?.errors} />
				<WarningList warnings={gw?.warnings} />
			</Alert>
		);
	}

	if (branch === 'rollback-failed') {
		return (
			<Alert severity="error">
				<AlertTitle>{t('ROLLBACK FAILED — manual recovery required')}</AlertTitle>
				<Typography variant="body2">
					{t('The restore failed AND the automatic rollback also failed. The instance may be in a partial configuration state. Recover manually from the pre-restore snapshot below.')}
				</Typography>
				{gw?.pre_restore_snapshot_persisted && (
					<Typography variant="body2" sx={{mt: 1, fontFamily: 'monospace', wordBreak: 'break-all'}}>
						{t('Pre-restore snapshot on gateway')}: {gw.pre_restore_snapshot_persisted}
					</Typography>
				)}
				<ErrorList errors={gw?.errors} />
				<WarningList warnings={gw?.warnings} />
			</Alert>
		);
	}

	// `incomplete`: the gateway stopped before APPLY or did not start, so
	// nothing was changed. `unconfirmed`: its status and its body do not agree
	// on what happened, so neither is repeated as fact. Both show what actually
	// arrived, never a fabricated success.
	const unconfirmed = branch === 'unconfirmed';
	return (
		<Alert severity="error">
			<AlertTitle>
				{unconfirmed
					? t('Restore outcome unconfirmed (gateway HTTP {{code}})', {code: outcome?.gateway_status ?? '?'})
					: t('Restore did not complete (gateway HTTP {{code}})', {code: outcome?.gateway_status ?? '?'})}
			</AlertTitle>
			{unconfirmed && (
				<Typography variant="body2">
					{t(
						'The answer does not say clearly whether the snapshot was applied. Read the configuration of {{name}} before doing anything else, and do not run the restore again until you have.',
						{name: instanceName},
					)}
				</Typography>
			)}
			<ErrorList errors={gw?.errors} />
			<WarningList warnings={gw?.warnings} />
			{!gw?.errors?.length && <RawGatewayBody body={outcome?.gateway_response} />}
			<RetryAfterNote outcome={outcome} />
		</Alert>
	);
}

//---------------------------------------------------------
// Main Component
//---------------------------------------------------------
interface RestoreWizardProps {
	open: boolean;
	snapshot: ISnapshot;
	instanceName: string;
	// Called on close; committed=true when a commit was attempted (whatever
	// its outcome — even a failed commit created a pre_restore row, so the
	// caller must refetch).
	onClose: (committed: boolean) => void;
}

export default function RestoreWizard(props: RestoreWizardProps) {
	const {open, snapshot, instanceName, onClose} = props;

	const [step, setStep] = React.useState<TRestoreWizardStep>('dry-run');
	const [dryRunLoading, setDryRunLoading] = React.useState(false);
	const [dryRunOutcome, setDryRunOutcome] = React.useState<IRestoreOutcomeParsed | null>(null);
	const [dryRunError, setDryRunError] = React.useState<string | null>(null);
	const [confirmText, setConfirmText] = React.useState('');
	const [commitOutcome, setCommitOutcome] = React.useState<IRestoreOutcomeParsed | null>(null);
	const [commitError, setCommitError] = React.useState<string | null>(null);
	const committedRef = React.useRef(false);

	// Step 1 runs automatically on open.
	React.useEffect(() => {
		if (!open || !snapshot.id) return;
		setStep('dry-run');
		setDryRunLoading(true);
		setDryRunOutcome(null);
		setDryRunError(null);
		setConfirmText('');
		setCommitOutcome(null);
		setCommitError(null);
		committedRef.current = false;

		let cancelled = false;
		request_restore_snapshot(snapshot.id, 'dry-run').then(res => {
			if (cancelled) return;
			setDryRunLoading(false);
			if (res.status === 'confirmed' && res.data) setDryRunOutcome(res.data);
			// The wizard's error panel is this flow's diagnostic surface — keep
			// the server detail visible under the localized headline (deliberate
			// deviation; restore panels render gateway output verbatim by design).
			else setDryRunError(snapshotOpErrorText(res));
		});
		return () => {
			cancelled = true;
		};
	}, [open, snapshot.id]);

	const canContinue = canContinueToCommit(dryRunOutcome, dryRunError, dryRunLoading);

	// Ref-guarded: two rapid clicks on "Restore Now" both run before React
	// re-renders the step, and a doubled commit means a doubled restore plus a
	// duplicate pre_restore snapshot on the server.
	const commitInFlightRef = React.useRef(false);
	const handleCommit = async () => {
		if (!snapshot.id || commitInFlightRef.current) return;
		commitInFlightRef.current = true;
		setStep('committing');
		committedRef.current = true;
		const res = await request_restore_snapshot(snapshot.id, 'commit');
		if (res.status === 'confirmed' && res.data) setCommitOutcome(res.data);
		else setCommitError(snapshotOpErrorText(res));
		setStep('result');
	};

	// Non-dismissable while the commit is in flight.
	const handleDialogClose = () => {
		if (step === 'committing') return;
		onClose(committedRef.current);
	};

	return (
		<Dialog open={open} onClose={handleDialogClose} maxWidth="md" fullWidth aria-labelledby="restore-wizard-title">
			<DialogTitle id="restore-wizard-title">
				{t('Restore Snapshot')}: {snapshot.name}
			</DialogTitle>

			{step === 'dry-run' && (
				<>
					<DialogContent dividers>
						{dryRunLoading && (
							<Stack alignItems="center" spacing={2} sx={{py: 3}}>
								<CircularProgress aria-label={t('Running dry-run')} />
								<Typography variant="body2">{t('Running dry-run validation on the gateway…')}</Typography>
							</Stack>
						)}
						{dryRunError !== null && (
							<Alert severity="error">
								<AlertTitle>{t('Dry-run failed')}</AlertTitle>
								<Typography variant="body2" sx={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
									{dryRunError}
								</Typography>
							</Alert>
						)}
						{dryRunOutcome !== null && <DryRunResult outcome={dryRunOutcome} />}
					</DialogContent>
					<DialogActions>
						<Button onClick={handleDialogClose}>{t('Cancel')}</Button>
						<Button variant="contained" disabled={!canContinue} onClick={() => setStep('confirm')}>
							{t('Continue to Restore')}
						</Button>
					</DialogActions>
				</>
			)}

			{step === 'confirm' && (
				<>
					<DialogContent dividers>
						<Stack spacing={2}>
							<Alert severity="warning">
								{t(
									'This wipes the live configuration of "{{instance}}" and applies snapshot "{{snapshot}}". A pre-restore snapshot is taken automatically before anything is changed.',
									{instance: instanceName, snapshot: snapshot.name},
								)}
							</Alert>
							<TextField
								label={t('Type the instance name to confirm')}
								value={confirmText}
								onChange={e => setConfirmText(e.target.value)}
								placeholder={instanceName}
								autoComplete="off"
								fullWidth
								inputProps={{'aria-label': t('Type the instance name to confirm')}}
							/>
						</Stack>
					</DialogContent>
					<DialogActions>
						<Button onClick={handleDialogClose}>{t('Cancel')}</Button>
						<Button variant="contained" color="error" disabled={confirmText !== instanceName} onClick={handleCommit}>
							{t('Restore Now')}
						</Button>
					</DialogActions>
				</>
			)}

			{step === 'committing' && (
				<DialogContent dividers>
					<Stack spacing={2} sx={{py: 2}}>
						<Typography variant="body2">{t('Restoring… do not close this window.')}</Typography>
						<LinearProgress aria-label={t('Restore in progress')} />
					</Stack>
				</DialogContent>
			)}

			{step === 'result' && (
				<>
					<DialogContent dividers>
						<CommitResult outcome={commitOutcome} oamError={commitError} instanceName={instanceName} />
					</DialogContent>
					<DialogActions>
						<Button variant="contained" onClick={handleDialogClose}>
							{t('Close')}
						</Button>
					</DialogActions>
				</>
			)}
		</Dialog>
	);
}
