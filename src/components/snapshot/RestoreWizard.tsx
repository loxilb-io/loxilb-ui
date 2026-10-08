//---------------------------------------------------------
// Restore wizard (docs/SNAPSHOT_UI_DESIGN.md §5.2).
//
// Two-step modal mirroring the API's dry-run-first contract:
//   1. DRY-RUN (automatic on open) — compatibility + plan table; errors
//      disable Commit. The plan lists the domains the snapshot covers; the
//      operator may clear some, and that selection gets its own dry-run
//      before it can be committed.
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
	Checkbox,
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
import {query_get_snapshot, request_restore_snapshot} from 'connector/oam/snapshotApi';
import {t} from 'i18next';
import React from 'react';
import {IGatewayRestoreResult, IRestoreOutcomeParsed, ISnapshot, TRestoreWizardStep} from 'types/snapshot';
import {retryAfterSeconds} from 'utils/retryAfter';
import {
	answersSelection,
	asRestoreResult,
	canContinueToCommit,
	classifyCommitResult,
	classifyDryRun,
	commitChangedInstance,
	gatewayRefusalText,
	planDomains,
	restoreSelection,
} from './wizardLogic';
import {snapshotOpErrorText} from './snapshotOpError';

//---------------------------------------------------------
// Sub-renderers
//---------------------------------------------------------
// Which domains of the plan are ticked, when the plan is the place to choose them.
interface IDomainChoice {
	checked: ReadonlySet<string>;
	onToggle: (domain: string) => void;
}

function PlanTable(props: {plan: IGatewayRestoreResult['plan']; choice?: IDomainChoice}) {
	const {choice} = props;
	const plan = props.plan ?? [];
	if (plan.length === 0) return null;
	return (
		<Box sx={{overflowX: 'auto'}}>
			<Table size="small" aria-label={t('Restore plan')}>
				<TableHead>
					<TableRow>
						{choice && <TableCell padding="checkbox">{t('Restore')}</TableCell>}
						<TableCell>{t('Domain')}</TableCell>
						<TableCell align="right">{t('To Delete')}</TableCell>
						<TableCell align="right">{t('To Apply')}</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{plan.map((p, i) => (
						<TableRow key={i}>
							{choice && (
								<TableCell padding="checkbox">
									{p.domain && (
										<Checkbox
											size="small"
											checked={choice.checked.has(p.domain)}
											onChange={() => choice.onToggle(p.domain!)}
											inputProps={{'aria-label': t('Restore {{domain}}', {domain: p.domain})}}
										/>
									)}
								</TableCell>
							)}
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
export function DryRunResult(props: {outcome: IRestoreOutcomeParsed; sent?: readonly string[]; choice?: IDomainChoice}) {
	const {outcome, sent} = props;
	const verdict = classifyDryRun(outcome, null, sent);
	const gw = asRestoreResult(outcome.gateway_response);
	const title =
		verdict === 'pass'
			? t('Dry-run passed — the snapshot is applicable')
			: verdict === 'busy'
				? t('The gateway cannot run a restore right now (HTTP {{code}})', {code: outcome.gateway_status ?? '?'})
				: verdict === 'refused'
					? t('This snapshot cannot be restored')
					: verdict === 'other-domains'
						? t('The dry-run did not answer for the selected domains')
						: t('The dry-run answer could not be read');
	const unverified = verdict === 'unreadable' && <Typography variant="body2">{t('Nothing was verified, so the restore cannot continue.')}</Typography>;
	// The backend ran a dry-run, but not of what was selected: committing on
	// it could replace domains the operator cleared.
	const otherDomains = verdict === 'other-domains' && (
		<Typography variant="body2">
			{t('Selected: {{sent}}. Answered for: {{answered}}. The restore cannot continue, because a commit could replace domains that were not selected.', {
				sent: (sent ?? []).join(', '),
				answered: planDomains(outcome).join(', ') || t('none'),
			})}
		</Typography>
	);

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
				{otherDomains}
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
			<PlanTable plan={gw.plan} choice={verdict === 'pass' ? props.choice : undefined} />
		</Stack>
	);
}

// Renders the commit outcome verbatim — one panel per §5.2 branch.
/** Exported for tests: the commit/dry-run outcome rendering is the honesty
 *  surface, so it is asserted directly rather than through the whole wizard. */
export function CommitResult(props: {
	outcome: IRestoreOutcomeParsed | null;
	oamError: string | null;
	outcomeUnknown?: boolean;
	instanceName: string;
	/** The domains the commit was sent for; absent for the whole document. */
	sent?: readonly string[];
}) {
	const {outcome, oamError, instanceName, sent} = props;
	const branch = classifyCommitResult(outcome, oamError);
	if (sent === undefined || branch === 'oam-error') return <CommitPanel {...props} />;
	// A selected restore says which domains it was for, and says so when the
	// answer is about other domains than those.
	return (
		<Stack spacing={2}>
			<CommitPanel {...props} />
			{commitChangedInstance(branch) && !answersSelection(outcome, sent) ? (
				<Alert severity="error">
					<AlertTitle>{t('The answer is not for the selected domains')}</AlertTitle>
					<Typography variant="body2">
						{t('Selected: {{sent}}. Answered for: {{answered}}. Domains that were not selected may have been replaced. Read the configuration of {{name}} before doing anything else.', {
							sent: sent.join(', '),
							answered: planDomains(outcome).join(', ') || t('none'),
							name: instanceName,
						})}
					</Typography>
				</Alert>
			) : (
				<Typography variant="body2">{t('Sent for these domains only: {{domains}}. Other domains were not part of this restore.', {domains: sent.join(', ')})}</Typography>
			)}
		</Stack>
	);
}

function CommitPanel(props: {outcome: IRestoreOutcomeParsed | null; oamError: string | null; outcomeUnknown?: boolean; instanceName: string}) {
	const {outcome, oamError, outcomeUnknown, instanceName} = props;
	const branch = classifyCommitResult(outcome, oamError);

	if (branch === 'oam-error') {
		// No outcome object came back. That is "it never reached the gateway"
		// only when something answered and said so. A commit that timed out or
		// lost its connection may have restored — do not say it failed.
		return (
			<Alert severity={outcomeUnknown ? 'warning' : 'error'}>
				<AlertTitle>{outcomeUnknown ? t('Restore outcome unknown') : t('Restore failed before reaching the gateway')}</AlertTitle>
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

// What the wizard is restoring. An undo swaps the snapshot for the pre-restore
// one, with the domains of the restore it undoes ticked.
interface IRestoreTarget {
	snapshot: ISnapshot;
	undo?: {components: readonly string[] | undefined};
}

// The dry-run of a selection, kept with the selection it was run for: it says
// nothing about any other selection.
interface IPickedDryRun {
	components: string[];
	loading: boolean;
	outcome: IRestoreOutcomeParsed | null;
	error: string | null;
}

const AUDIT_SINK_DOMAIN = 'auditsink';

export default function RestoreWizard(props: RestoreWizardProps) {
	const {open, instanceName, onClose} = props;

	const [target, setTarget] = React.useState<IRestoreTarget>({snapshot: props.snapshot});
	const snapshot = target.snapshot;

	const [step, setStep] = React.useState<TRestoreWizardStep>('dry-run');
	const [dryRunLoading, setDryRunLoading] = React.useState(false);
	const [dryRunOutcome, setDryRunOutcome] = React.useState<IRestoreOutcomeParsed | null>(null);
	const [dryRunError, setDryRunError] = React.useState<string | null>(null);
	const [checked, setChecked] = React.useState<ReadonlySet<string>>(new Set());
	const [picked, setPicked] = React.useState<IPickedDryRun | null>(null);
	const [confirmText, setConfirmText] = React.useState('');
	const [commitOutcome, setCommitOutcome] = React.useState<IRestoreOutcomeParsed | null>(null);
	const [commitError, setCommitError] = React.useState<string | null>(null);
	const [commitUnknown, setCommitUnknown] = React.useState(false);
	// The domains the commit was sent for; undefined for the whole document.
	const [sent, setSent] = React.useState<string[] | undefined>(undefined);
	const [undoLoading, setUndoLoading] = React.useState(false);
	const [undoError, setUndoError] = React.useState<string | null>(null);
	const committedRef = React.useRef(false);
	// Ref-guarded: two rapid clicks on "Restore Now" both run before React
	// re-renders the step, and a doubled commit means a doubled restore plus a
	// duplicate pre_restore snapshot on the server.
	const commitInFlightRef = React.useRef(false);
	// Bumped for each target, so an answer for an earlier one is dropped.
	const runRef = React.useRef(0);

	// Step 1 runs automatically on open, and again for an undo: a dry-run of
	// the whole document, whose plan is also the list of domains to choose from.
	React.useEffect(() => {
		// Bumped first, so closing also drops an answer that is still on its way.
		const run = ++runRef.current;
		if (!open || !target.snapshot.id) return;
		setStep('dry-run');
		setDryRunLoading(true);
		setDryRunOutcome(null);
		setDryRunError(null);
		setChecked(new Set());
		setPicked(null);
		setConfirmText('');
		setCommitOutcome(null);
		setCommitError(null);
		setCommitUnknown(false);
		setSent(undefined);
		setUndoError(null);
		commitInFlightRef.current = false;

		request_restore_snapshot(target.snapshot.id, 'dry-run').then(res => {
			if (run !== runRef.current) return;
			setDryRunLoading(false);
			if (res.status === 'confirmed' && res.data) {
				setDryRunOutcome(res.data);
				const listed = planDomains(res.data);
				const wanted = target.undo?.components;
				setChecked(new Set(wanted ? listed.filter(d => wanted.includes(d)) : listed));
			}
			// The wizard's error panel is this flow's diagnostic surface — keep
			// the server detail visible under the localized headline (deliberate
			// deviation; restore panels render gateway output verbatim by design).
			else setDryRunError(snapshotOpErrorText(res));
		});
	}, [open, target]);

	const fullPass = canContinueToCommit(dryRunOutcome, dryRunError, dryRunLoading);
	const domains = fullPass ? planDomains(dryRunOutcome) : [];
	const selection = restoreSelection(domains, checked);
	const components = selection.kind === 'some' ? selection.components : undefined;
	// A dry-run of other domains than the ones ticked now does not count.
	const pickedNow = components !== undefined && picked !== null && picked.components.join(',') === components.join(',') ? picked : null;
	const needsPickedDryRun = fullPass && components !== undefined && pickedNow === null;
	const canContinue =
		selection.kind === 'all'
			? fullPass
			: pickedNow !== null && canContinueToCommit(pickedNow.outcome, pickedNow.error, pickedNow.loading, pickedNow.components);
	// Domains of the restore being undone that this snapshot's plan does not list.
	const undoMissing = fullPass ? (target.undo?.components ?? []).filter(d => !domains.includes(d)) : [];
	const restoresAuditSinks = (components ?? domains).includes(AUDIT_SINK_DOMAIN);

	const handleToggle = (domain: string) => {
		setChecked(prev => {
			const next = new Set(prev);
			if (!next.delete(domain)) next.add(domain);
			return next;
		});
	};

	const handlePickedDryRun = async () => {
		if (!snapshot.id || components === undefined) return;
		const run = runRef.current;
		const mine = components;
		setPicked({components: mine, loading: true, outcome: null, error: null});
		const res = await request_restore_snapshot(snapshot.id, 'dry-run', undefined, mine);
		if (run !== runRef.current) return;
		setPicked(prev =>
			prev?.components !== mine
				? prev
				: res.status === 'confirmed' && res.data
					? {components: mine, loading: false, outcome: res.data, error: null}
					: {components: mine, loading: false, outcome: null, error: snapshotOpErrorText(res)},
		);
	};

	const handleCommit = async () => {
		if (!snapshot.id || commitInFlightRef.current || !canContinue) return;
		commitInFlightRef.current = true;
		const run = runRef.current;
		setStep('committing');
		committedRef.current = true;
		// The commit carries the same list its dry-run was run for.
		setSent(components);
		const res = await request_restore_snapshot(snapshot.id, 'commit', undefined, components);
		if (run !== runRef.current) return;
		if (res.status === 'confirmed' && res.data) setCommitOutcome(res.data);
		else {
			setCommitUnknown(res.status === 'unknown');
			setCommitError(snapshotOpErrorText(res));
		}
		setStep('result');
	};

	// Undo is a restore of the pre-restore snapshot OAM took just before the
	// commit, for the same domains. It goes through the same steps, dry-run first.
	const preRestoreId = commitOutcome?.pre_restore_snapshot_id;
	const canUndo = !!preRestoreId && commitChangedInstance(classifyCommitResult(commitOutcome, commitError));
	const handleUndo = async () => {
		if (!preRestoreId || undoLoading) return;
		setUndoLoading(true);
		setUndoError(null);
		try {
			const pre = await query_get_snapshot(preRestoreId);
			if (!pre?.id) throw new Error(t('The answer holds no snapshot.'));
			setTarget({snapshot: pre, undo: {components: sent}});
		} catch (e) {
			setUndoError(t('The pre-restore snapshot could not be read: {{error}}', {error: e instanceof Error ? e.message : String(e)}));
		} finally {
			setUndoLoading(false);
		}
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
						<Stack spacing={2}>
							{target.undo && (
								<Alert severity="info">{t('Undo: this is the pre-restore snapshot taken just before the restore you ran. Restoring it puts back what that restore replaced.')}</Alert>
							)}
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
							{dryRunOutcome !== null && <DryRunResult outcome={dryRunOutcome} choice={{checked, onToggle: handleToggle}} />}
							{domains.length > 0 && (
								<Typography variant="body2" color="text.secondary">
									{t('Every ticked domain is replaced with what the snapshot holds; it is not merged. Clear a domain to leave it as it is on the instance. A selection gets its own dry-run before it can be restored.')}
								</Typography>
							)}
							{undoMissing.length > 0 && (
								<Alert severity="warning">
									{t('The restore being undone was for {{domains}}, which this snapshot does not list. Those cannot be put back from it.', {domains: undoMissing.join(', ')})}
								</Alert>
							)}
							{selection.kind === 'none' && <Alert severity="warning">{t('Tick at least one domain. A restore of no domains is not sent.')}</Alert>}
							{pickedNow !== null && (
								<Stack spacing={1}>
									<Typography variant="subtitle2">{t('Dry-run of the selected domains: {{domains}}', {domains: pickedNow.components.join(', ')})}</Typography>
									{pickedNow.loading && <LinearProgress aria-label={t('Running dry-run')} />}
									{pickedNow.error !== null && (
										<Alert severity="error">
											<AlertTitle>{t('Dry-run failed')}</AlertTitle>
											<Typography variant="body2" sx={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
												{pickedNow.error}
											</Typography>
										</Alert>
									)}
									{pickedNow.outcome !== null && <DryRunResult outcome={pickedNow.outcome} sent={pickedNow.components} />}
								</Stack>
							)}
						</Stack>
					</DialogContent>
					<DialogActions>
						<Button onClick={handleDialogClose}>{t('Cancel')}</Button>
						{needsPickedDryRun ? (
							<Button variant="contained" onClick={handlePickedDryRun}>
								{t('Dry-run Selected Domains')}
							</Button>
						) : (
							<Button variant="contained" disabled={!canContinue} onClick={() => setStep('confirm')}>
								{t('Continue to Restore')}
							</Button>
						)}
					</DialogActions>
				</>
			)}

			{step === 'confirm' && (
				<>
					<DialogContent dividers>
						<Stack spacing={2}>
							<Alert severity="warning">
								{components === undefined
									? t(
											'This wipes the live configuration of "{{instance}}" and applies snapshot "{{snapshot}}". A pre-restore snapshot is taken automatically before anything is changed.',
											{instance: instanceName, snapshot: snapshot.name},
										)
									: t(
											'This replaces these domains on "{{instance}}" with what snapshot "{{snapshot}}" holds: {{domains}}. Other domains are not changed. A pre-restore snapshot of the whole configuration is taken automatically before anything is changed.',
											{instance: instanceName, snapshot: snapshot.name, domains: components.join(', ')},
										)}
							</Alert>
							{restoresAuditSinks && (
								<Alert severity="warning">
									<AlertTitle>{t('This restore includes the audit sinks')}</AlertTitle>
									{t(
										'The gateway stops every audit sink on this instance, then configures only the sinks the snapshot holds: a sink that is not in the snapshot stops receiving. The audit policy is not part of a snapshot. Certificate and key files are not carried in it either, so the restore fails if a sink needs files the node does not have. Each sink continues from the place in the trail kept on the node.',
									)}
								</Alert>
							)}
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
						<Button variant="contained" color="error" disabled={confirmText !== instanceName || !canContinue} onClick={handleCommit}>
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
						<Stack spacing={2}>
							<CommitResult outcome={commitOutcome} oamError={commitError} outcomeUnknown={commitUnknown} instanceName={instanceName} sent={sent} />
							{canUndo && (
								<Typography variant="body2" color="text.secondary">
									{sent === undefined
										? t('To undo, restore the pre-restore snapshot taken just before this restore. Undo starts with a dry-run.')
										: t('To undo, restore the pre-restore snapshot taken just before this restore, for the same domains ({{domains}}). Undo starts with a dry-run.', {
												domains: sent.join(', '),
											})}
								</Typography>
							)}
							{undoError !== null && <Alert severity="error">{undoError}</Alert>}
						</Stack>
					</DialogContent>
					<DialogActions>
						{canUndo && (
							<Button color="warning" disabled={undoLoading} onClick={handleUndo}>
								{t('Undo This Restore…')}
							</Button>
						)}
						<Button variant="contained" onClick={handleDialogClose}>
							{t('Close')}
						</Button>
					</DialogActions>
				</>
			)}
		</Dialog>
	);
}
