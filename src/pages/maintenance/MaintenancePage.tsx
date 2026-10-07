//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert, Box, Button, Stack, TextField, Typography} from '@mui/material';
import {useQueryClient} from '@tanstack/react-query';
import FreshnessBadge from 'components/observability/FreshnessBadge';
import {PanelPaper, StatRow} from 'components/observability/panelLayout';
import QueryStateGate from 'components/state/QueryStateGate';
import {toPageState} from 'components/state/pageState';
import {opErrorText} from 'connector/fetcher/opResultText';
import {IMaintenanceStatus, request_enter_maintenance, request_leave_maintenance} from 'connector/instance/maintenance';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {MAINTENANCE_CADENCE_MS, MAINTENANCE_DRAIN_CADENCE_MS, useMaintenance} from 'hooks/query/maintenanceHooks';
import {useRole} from 'hooks/query/oamHooks';
import {t} from 'i18next';
import {useRef} from 'react';
import {inFlightRequests, maintenancePhase, MaintenancePhase, parseDrainWindow} from 'types/maintenance';

//---------------------------------------------------------
// Operator maintenance: enter, read back, and leave.
//---------------------------------------------------------
// The gateway never leaves maintenance on its own, and neither does this
// page: Resume is a button an operator presses, and nothing here presses it
// for them — not a drain window running out, not a counter reaching zero.
//
// What the page says after a change is what the gateway reads back, not what
// the PUT answered. A change whose read-back fails is reported as sent and
// unconfirmed, with the state left for the operator to refresh.

const PHASE_SEVERITY: Record<MaintenancePhase, 'success' | 'info' | 'warning'> = {
	active: 'success',
	draining: 'warning',
	'config-only': 'warning',
	'maintenance-unreported': 'warning',
	unknown: 'info',
};

function phaseText(phase: MaintenancePhase, status: IMaintenanceStatus): string {
	switch (phase) {
		case 'active':
			return t('Active: the gateway accepts configuration changes and inference traffic.');
		case 'draining':
			return t('In maintenance, draining: configuration changes are refused, new inference requests are refused, and requests already executing are left to finish.');
		case 'config-only':
			return t('In maintenance, configuration only: configuration changes are refused. Inference traffic is NOT being refused, so nothing is draining.');
		case 'maintenance-unreported':
			return t('In maintenance: configuration changes are refused. This gateway does not say whether inference traffic is refused.');
		default:
			return t('The gateway reported a maintenance state this UI does not know: {{state}}.', {state: status.state ?? t('Not reported')});
	}
}

const yesNo = (value: boolean | undefined): string => (typeof value !== 'boolean' ? t('Not reported') : value ? t('Yes') : t('No'));
const count = (value: number | undefined): string | number => value ?? t('Not reported');

export default function MaintenancePage() {
	const inst = useInstanceFromURL();
	const queryClient = useQueryClient();
	const {openPopUp} = usePopUp();
	const {can_write_gateway} = useRole();
	const maintenance_query = useMaintenance(inst);
	const {refetch} = maintenance_query;
	const drainWindowRef = useRef('');

	// Whatever the answer, the dashboard banner reads the same episode from
	// the diagnostics, and must not go on showing the state before the change.
	const readBack = async (): Promise<IMaintenanceStatus | undefined> => {
		queryClient.invalidateQueries({queryKey: ['instance', 'diagnostics', inst?.id]});
		const result = await refetch();
		return result.isError ? undefined : result.data?.data;
	};

	const handleEnter = () => {
		if (!inst) return;
		drainWindowRef.current = '';
		const form = (
			<Stack spacing={2} key={Date.now()}>
				<Typography variant="body1">
					{t('Entering maintenance makes the gateway refuse configuration changes. On a gateway with an attached data path it also refuses new inference requests with 503 and ends the requests waiting in its queues; requests already executing are left to finish.')}
				</Typography>
				<Typography variant="body1">{t('The gateway stays in maintenance until an operator resumes it. A drain window is reported when it runs out; it never ends the maintenance.')}</Typography>
				<TextField
					size="small"
					label={t('Drain window (seconds, optional)')}
					defaultValue=""
					onChange={e => {
						drainWindowRef.current = e.target.value;
					}}
					helperText={t('Leave empty to declare no deadline. The window of an episode cannot be changed after it starts.')}
					slotProps={{htmlInput: {inputMode: 'numeric'}}}
				/>
			</Stack>
		);
		openPopUp(t('Enter Maintenance'), form, t('Enter Maintenance'), t('Cancel'), async () => {
			const window = parseDrainWindow(drainWindowRef.current);
			if (window.error) {
				openPopUp(t('Error'), t('The drain window must be a whole number of seconds.'), t('OK'));
				return;
			}
			const res = await request_enter_maintenance(inst, window.seconds);
			if (res.status !== 'confirmed') {
				await readBack();
				openPopUp(t('Error'), t('Maintenance was not entered. {{error}}', {error: opErrorText(res)}), t('OK'));
				return;
			}
			const now = await readBack();
			if (!now) openPopUp(t('Warning'), t('The request to enter maintenance was accepted, but the state could not be read back. Refresh before relying on it.'), t('OK'));
			else if (now.state !== 'maintenance') openPopUp(t('Warning'), t('The request to enter maintenance was accepted, but the gateway reports the state {{state}}.', {state: now.state ?? t('Not reported')}), t('OK'));
			else openPopUp(t('Success'), t('The gateway is in maintenance.'), t('OK'));
		});
	};

	const handleResume = () => {
		if (!inst) return;
		openPopUp(
			t('Resume'),
			t('Resuming ends the maintenance: the gateway accepts configuration changes and new inference requests again. Requests are not waited for; resume when you have decided the drain is over.'),
			t('Resume'),
			t('Cancel'),
			async () => {
				const res = await request_leave_maintenance(inst);
				if (res.status !== 'confirmed') {
					await readBack();
					openPopUp(t('Error'), t('Maintenance was not ended. {{error}}', {error: opErrorText(res)}), t('OK'));
					return;
				}
				const now = await readBack();
				if (!now) openPopUp(t('Warning'), t('The request to resume was accepted, but the state could not be read back. Refresh before relying on it.'), t('OK'));
				else if (now.state !== 'active') openPopUp(t('Warning'), t('The request to resume was accepted, but the gateway reports the state {{state}}.', {state: now.state ?? t('Not reported')}), t('OK'));
				else openPopUp(t('Success'), t('The gateway is active.'), t('OK'));
			},
		);
	};

	return (
		<Stack spacing={2} padding={2} maxWidth={760}>
			<Typography variant="h6" component="h2">
				{t('Operator Maintenance')}
			</Typography>
			<QueryStateGate
				state={toPageState(maintenance_query, {op: 'maintenance.get', isEmpty: () => false})}
				name={t('maintenance state')}
				onRetry={() => refetch()}
			>
				{(read, {stale}) => {
					if (!read) return null;
					const status = read.data;
					const phase = maintenancePhase(status);
					const inMaintenance = status.state === 'maintenance';
					return (
						<Stack spacing={2} data-testid="maintenance-state">
							<Alert
								severity={PHASE_SEVERITY[phase]}
								action={
									<Box sx={{alignSelf: 'center'}}>
										<FreshnessBadge receivedAtMs={read.receivedAtMs} cadenceMs={inMaintenance ? MAINTENANCE_DRAIN_CADENCE_MS : MAINTENANCE_CADENCE_MS} />
									</Box>
								}
							>
								{phaseText(phase, status)}
							</Alert>
							{inMaintenance && status.drain_deadline_exceeded === true && (
								<Alert severity="warning">
									{t('The declared drain window has run out. The gateway stays in maintenance, and nothing was cancelled: an operator decides when to resume.')}
								</Alert>
							)}
							{inMaintenance && status.cancellable === false && (
								<Alert severity="info">{t('The gateway reports that maintenance cannot be left right now.')}</Alert>
							)}

							<PanelPaper title={t('State')}>
								<StatRow label={t('Refusing configuration changes')} value={yesNo(status.refusing_new_config)} />
								<StatRow label={t('Refusing new inference requests')} value={yesNo(status.refusing_new_inference)} />
								<StatRow label={t('Executing inference requests')} value={count(inFlightRequests(status))} />
								<StatRow label={t('Open streaming sessions')} value={count(status.in_flight_streams)} />
								{inMaintenance && (
									<>
										<StatRow label={t('Operation ID')} value={status.operation_id || t('Not reported')} />
										<StatRow label={t('Entered at')} value={status.entered_at || t('Not reported')} />
										<StatRow label={t('Elapsed (seconds)')} value={count(status.elapsed_seconds)} />
										<StatRow label={t('Drain window (seconds)')} value={status.drain_timeout_seconds ? status.drain_timeout_seconds : t('None declared')} />
										{status.drain_timeout_seconds ? <StatRow label={t('Drain window run out')} value={yesNo(status.drain_deadline_exceeded)} /> : null}
									</>
								)}
							</PanelPaper>
							<Typography variant="body2" color="text.secondary">
								{t('The counters are observations at the time of the read. Executing requests are those the capacity gate counts and are 0 where no pool is gated; streaming sessions cover SSE only. Neither reaching zero proves that traffic has drained.')}
							</Typography>

							{can_write_gateway ? (
								<Stack direction="row" spacing={1}>
									{/* Entering needs a state to enter from; a refresh that failed has
									    not said the gateway is active. Resume stays: it is the one
									    action an operator must be able to reach, and it is idempotent. */}
									{!inMaintenance && (
										<Button variant="contained" color="warning" onClick={handleEnter} disabled={stale || phase !== 'active'}>
											{t('Enter Maintenance')}
										</Button>
									)}
									{inMaintenance && (
										<Button variant="contained" onClick={handleResume}>
											{t('Resume')}
										</Button>
									)}
								</Stack>
							) : (
								<Typography variant="body2" color="text.secondary">
									{t('Entering and leaving maintenance needs the operator or administrator role.')}
								</Typography>
							)}
						</Stack>
					);
				}}
			</QueryStateGate>
		</Stack>
	);
}
