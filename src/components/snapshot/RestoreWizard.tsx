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
import {canContinueToCommit, classifyCommitResult, isDryRunBlocked} from './wizardLogic';

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

function ErrorList(props: {errors?: string[]}) {
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

// Renders the commit outcome verbatim — the three-way branch of §5.2.
function CommitResult(props: {outcome: IRestoreOutcomeParsed | null; oamError: string | null; instanceName: string}) {
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

	const gw = outcome?.gateway_response;

	if (branch === 'ok') {
		return (
			<Alert severity="success">
				<AlertTitle>{t('Restore succeeded')}</AlertTitle>
				<Typography variant="body2">
					{t('Snapshot applied to {{name}} and verified by the gateway.', {name: instanceName})}
				</Typography>
				<PlanTable plan={gw?.plan} />
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
			</Alert>
		);
	}

	// The gateway answered but with no recognizable result (e.g. stopped
	// before APPLY, or a non-JSON body) — show what we actually got, never a
	// fabricated success.
	return (
		<Alert severity="error">
			<AlertTitle>{t('Restore did not complete (gateway HTTP {{code}})', {code: outcome?.gateway_status ?? '?'})}</AlertTitle>
			<ErrorList errors={gw?.errors} />
			{!gw?.errors?.length && (
				<Typography variant="body2" sx={{whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace'}}>
					{JSON.stringify(outcome?.gateway_response ?? {}, null, 1)}
				</Typography>
			)}
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
			else setDryRunError(res.rawDetail ? `${t(res.localeKey)} ${res.rawDetail}` : t(res.localeKey));
		});
		return () => {
			cancelled = true;
		};
	}, [open, snapshot.id]);

	const gw = dryRunOutcome?.gateway_response;
	const dryRunBlocked = isDryRunBlocked(dryRunOutcome, dryRunError);
	const canContinue = canContinueToCommit(dryRunOutcome, dryRunError, dryRunLoading);

	// Only meaningful when the gateway reported both versions (a rejected
	// document can come back with an empty snapshot_gateway_version).
	const versionNote =
		gw?.snapshot_gateway_version && gw?.current_gateway_version && gw.snapshot_gateway_version !== gw.current_gateway_version
			? t('Snapshot was taken on gateway {{from}}; the target runs {{to}}.', {from: gw.snapshot_gateway_version, to: gw.current_gateway_version})
			: null;

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
		else setCommitError(res.rawDetail ? `${t(res.localeKey)} ${res.rawDetail}` : t(res.localeKey));
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
						{dryRunOutcome !== null && (
							<Stack spacing={2}>
								<Alert severity={dryRunBlocked ? 'error' : 'success'}>
									<AlertTitle>
										{dryRunBlocked ? t('This snapshot cannot be restored') : t('Dry-run passed — the snapshot is applicable')}
									</AlertTitle>
									<Typography variant="body2">
										{t('Schema')} {gw?.schema_version ?? '?'} ·{' '}
										{gw?.compatible === false ? t('incompatible') : t('compatible')}
									</Typography>
									{versionNote && <Typography variant="body2">{versionNote}</Typography>}
									{dryRunOutcome.cross_instance && (
										<Typography variant="body2">
											{t('⚠ Cross-instance restore: this snapshot was taken from a different instance.')}
										</Typography>
									)}
									<ErrorList errors={gw?.errors} />
								</Alert>
								<PlanTable plan={gw?.plan} />
							</Stack>
						)}
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
