//---------------------------------------------------------
// Priority bands, default reservation and class-configuration source, as the
// gateway reports them in `fc_effective` (gateway 9f5017e2).
//
// Read-only on purpose: every knob shown here is set with loxicmd or the API
// (CLI_ONLY_SERVICE_ARGUMENTS). The panel says what is in force, where it
// came from, and the states an operator must act on.
//
// Absence rule: these members are newer than the admission block above. A
// member the gateway does not report is "not reported" (–), never 0. An
// explicit 0 or false IS reported and is shown as such.
//---------------------------------------------------------
import {Alert, Box, Grid2, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography} from '@mui/material';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import {t} from 'i18next';
import {IFcEffective} from 'types/load_balancer';

type Effective = IFcEffective & Record<string, unknown>;
type BandRow = NonNullable<NonNullable<IFcEffective['bands']>['critical']>;

const NOT_REPORTED = '–';

const BANDS = ['critical', 'standard', 'sheddable'] as const;

const BAND_COLUMNS: readonly {key: keyof BandRow; label: string; help: string}[] = [
	{key: 'inflight', label: 'Executing', help: 'Service units the band holds now.'},
	{key: 'queued', label: 'Waiting', help: 'Requests of the band waiting now.'},
	{key: 'wait_ms', label: 'Wait (ms)', help: 'The band\'s wait window; 0 is the queue\'s.'},
	{key: 'queue_pct', label: 'Queue share (%)', help: 'The most of the queue the band may hold; 0 is the shared depth.'},
	{key: 'min_share_pct', label: 'Floor (%)', help: 'Guaranteed share of the ceiling while the band has a waiter.'},
	{key: 'floor_units', label: 'Floor (units)', help: 'The floor in service units as the gate enforces it.'},
	{key: 'weight', label: 'Weight', help: 'Credits per round under the weighted wake; 0 is not set.'},
	{key: 'weight_pct', label: 'Weight (%)', help: 'The weight\'s share of one round.'},
];

const BAND_NAMES: Record<(typeof BANDS)[number], string> = {critical: 'Critical', standard: 'Standard', sheddable: 'Sheddable'};

/** Why the gate runs other band settings than configured; the gateway's tokens, worded from its contract. */
const FALLBACK_REASONS: Record<string, string> = {
	none: 'Runs as configured.',
	sockmap_request: 'sockMapMode request or both on a rule that is not an AI-gateway service: every band knob runs at its default.',
	zero_weight: 'Weighted wake with a zero weight: runs strict.',
	no_queue: 'Shed queue on without a queue depth: runs off.',
};

const CONFIG_SOURCES: Record<string, string> = {
	store: 'Key store',
	lkg: 'Last-known-good file',
	none: 'Nothing read',
};

const RESERVATION_KINDS: Record<string, string> = {
	tenant: 'Tenant',
	tenant_model: 'Tenant and model',
	user: 'User',
	user_model: 'User and model',
	key: 'API key',
	service: 'Service (keyless)',
};

const SOURCE_NAMES: Record<string, string> = {rule: 'rule', env: 'environment', default: 'default'};

/** A reported value, shown as given (0 and false included); an absent one is not reported. */
function shown(value: unknown): string {
	if (value === undefined || value === null) return NOT_REPORTED;
	if (typeof value === 'boolean') return value ? t('Yes') : t('No');
	return String(value);
}

function withSource(value: unknown, source?: unknown): string {
	const text = shown(value);
	if (text === NOT_REPORTED || typeof source !== 'string' || source === '') return text;
	return `${text} (${SOURCE_NAMES[source] ? t(SOURCE_NAMES[source]) : source})`;
}

/** A configured value beside the one the gate runs, when they differ. */
function configuredVersusEffective(configured: unknown, effective: unknown): string {
	if (effective === undefined || effective === configured) return shown(configured);
	return t('{{configured}} (runs {{effective}})', {configured: shown(configured), effective: shown(effective)});
}

/** A known token in words; an unknown one as the gateway sent it, never hidden. */
function named(table: Record<string, string>, token: unknown): string {
	if (typeof token !== 'string' || token === '') return NOT_REPORTED;
	return table[token] ? t(table[token]) : t('Unknown ({{value}})', {value: token});
}

function hasAny(effective: Effective, members: readonly string[]): boolean {
	return members.some(member => effective[member] !== undefined && effective[member] !== null);
}

const BAND_MEMBERS = ['wake_policy', 'wake_policy_effective', 'weights_in_use', 'shed_queue', 'shed_queue_effective', 'tenant_wake', 'tenant_wake_effective', 'band_fallback_reason', 'llmd_headers', 'bands_configured', 'bands'] as const;
const RESERVATION_MEMBERS = ['default_reservation', 'default_max_tokens', 'reservation_clamped_burst', 'reservation_clamped_budget', 'reservation_epoch', 'reservation_held_claims', 'reservation_held_truncated', 'reservation_held'] as const;
const CONFIG_MEMBERS = ['config_source', 'store_reachable', 'store_last_read'] as const;

export function PriorityBandsReadBack({effective}: {effective: IFcEffective}) {
	const e = effective as Effective;
	if (!hasAny(e, BAND_MEMBERS)) return null;
	const source = (effective.source ?? {}) as Record<string, string | undefined>;
	const bands = effective.bands;
	const reason = effective.band_fallback_reason;
	const fallingBack = typeof reason === 'string' && reason !== 'none';

	return (
		<ValueBunch name={t('Priority Bands')}>
			<Stack spacing={1} width="100%">
				{fallingBack && (
					<Alert severity="warning">
						{t('The gate runs band settings other than the configured ones: {{reason}}', {reason: named(FALLBACK_REASONS, reason)})}
					</Alert>
				)}
				<Grid2 container spacing={2}>
					<SingleTextBox
						label={t('Wake Policy')}
						value={withSource(configuredVersusEffective(effective.wake_policy, effective.wake_policy_effective), source.wake_policy)}
						tooltip={t('Which band a freed unit wakes. strict serves the highest band with a waiter; weighted shares wake-ups by the band weights.')}
					/>
					<SingleTextBox label={t('Weights in Use')} value={shown(effective.weights_in_use)} tooltip={t('Whether the weights decide the wake. Declared weights are stored but not used unless the wake policy in force is weighted.')} />
					<SingleTextBox
						label={t('Shed Queue')}
						value={withSource(configuredVersusEffective(effective.shed_queue, effective.shed_queue_effective), source.shed_queue)}
						tooltip={t('Whether a sheddable request at the ceiling waits in its band instead of being refused.')}
					/>
					<SingleTextBox
						label={t('In-band Order')}
						value={withSource(configuredVersusEffective(effective.tenant_wake, effective.tenant_wake_effective), source.tenant_wake)}
						tooltip={t('The order inside one band: fifo, or round robin across tenants (rr).')}
					/>
					<SingleTextBox label={t('llm-d Headers')} value={withSource(effective.llmd_headers, source.llmd_headers)} tooltip={t('Whether refusals carry the llm-d dropped-reason header and an llm-d TTL may shorten a wait.')} />
					<SingleTextBox label={t('Bands Configured')} value={shown(effective.bands_configured)} tooltip={t('Whether any band knob in force differs from its default.')} />
					<SingleTextBox label={t('Fallback Reason')} value={named(FALLBACK_REASONS, reason)} tooltip={t('Why the gate runs other band settings than configured, if it does.')} />
					<SingleTextBox
						label={t('Critical Reserve')}
						value={bands?.critical_reserve_pct === undefined && bands?.critical_reserve_units === undefined
							? NOT_REPORTED
							: t('{{pct}}% ({{units}} units)', {pct: shown(bands?.critical_reserve_pct), units: shown(bands?.critical_reserve_units)})}
						tooltip={t('Units of the ceiling in force no other band may take, even when critical is idle. The only true reservation.')}
					/>
				</Grid2>
				{bands && BANDS.some(band => bands[band] !== undefined) && (
					<TableContainer>
						<Table size="small" aria-label={t('Priority band state')}>
							<TableHead>
								<TableRow>
									<TableCell component="th" scope="col">{t('Band')}</TableCell>
									{BAND_COLUMNS.map(column => (
										<TableCell key={column.key} component="th" scope="col" align="right" title={t(column.help)}>{t(column.label)}</TableCell>
									))}
								</TableRow>
							</TableHead>
							<TableBody>
								{BANDS.map(band => (
									<TableRow key={band}>
										<TableCell component="th" scope="row">{t(BAND_NAMES[band])}</TableCell>
										{BAND_COLUMNS.map(column => (
											<TableCell key={column.key} align="right">{shown(bands[band]?.[column.key])}</TableCell>
										))}
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>
				)}
				<Typography variant="caption" color="text.secondary">
					{t('Band settings are set with loxicmd or the API. Executing and waiting move with traffic; – means not reported.')}
				</Typography>
			</Stack>
		</ValueBunch>
	);
}

/** The minute a reading belongs to, as a local time. */
function epochMinute(epoch: unknown): string {
	if (typeof epoch !== 'number' || !Number.isFinite(epoch) || epoch <= 0) return NOT_REPORTED;
	return new Date(epoch * 60_000).toLocaleTimeString();
}

export function ReservationReadBack({effective}: {effective: IFcEffective}) {
	const e = effective as Effective;
	if (!hasAny(e, RESERVATION_MEMBERS)) return null;
	const source = (effective.source ?? {}) as Record<string, string | undefined>;
	const held = effective.reservation_held ?? [];

	return (
		<ValueBunch name={t('Default Token Reservation')}>
			<Stack spacing={1} width="100%">
				{effective.reservation_held_truncated === true && (
					<Alert severity="info">{t('Not every bucket holding a reservation is listed. The claim count covers the tracked buckets.')}</Alert>
				)}
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Default Reservation')} value={withSource(effective.default_reservation, source.default_reservation)} tooltip={t('Whether a request without a declared max_tokens reserves a default completion budget at admission.')} />
					<SingleTextBox label={t('Default Max Tokens')} value={withSource(effective.default_max_tokens, source.default_max_tokens)} tooltip={t('The default reservation in tokens in force; 0 while the reservation is off.')} />
					<SingleTextBox label={t('Clamped (burst)')} value={shown(effective.reservation_clamped_burst)} tooltip={t('Requests admitted with less than the default reserved because it exceeds what a bucket can hold. A configuration to fix. Counted per service since the process started; every model pool of the service shows the same number. Never a refusal.')} />
					<SingleTextBox label={t('Clamped (budget)')} value={shown(effective.reservation_clamped_budget)} tooltip={t('Requests admitted with less than the default reserved because the bucket budget was already taken. Transient. Counted per service since the process started. Never a refusal.')} />
					<SingleTextBox label={t('Held Claims')} value={shown(effective.reservation_held_claims)} tooltip={t('Token reservations held now, one per request and bucket.')} />
					<SingleTextBox label={t('Reading Minute')} value={epochMinute(effective.reservation_epoch)} tooltip={t('The minute the held reservations belong to. A reservation does not outlive its minute.')} />
				</Grid2>
				{held.length > 0 && (
					<TableContainer>
						<Table size="small" aria-label={t('Buckets holding reserved tokens')}>
							<TableHead>
								<TableRow>
									<TableCell component="th" scope="col">{t('Quota')}</TableCell>
									<TableCell component="th" scope="col">{t('Bucket')}</TableCell>
									<TableCell component="th" scope="col" align="right">{t('Reserved Tokens')}</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{held.map((row, index) => (
									<TableRow key={`${row.kind ?? ''}|${row.bucket ?? ''}|${index}`}>
										<TableCell component="th" scope="row">{named(RESERVATION_KINDS, row.kind)}</TableCell>
										<TableCell sx={{overflowWrap: 'anywhere'}}>{shown(row.bucket)}</TableCell>
										<TableCell align="right">{shown(row.tokens)}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>
				)}
			</Stack>
		</ValueBunch>
	);
}

export function ClassConfigSourceReadBack({effective}: {effective: IFcEffective}) {
	const e = effective as Effective;
	if (!hasAny(e, CONFIG_MEMBERS)) return null;
	const configSource = effective.config_source;
	const reachable = effective.store_reachable;
	const lastRead = effective.store_last_read;

	return (
		<ValueBunch name={t('Objectives and Classes Source')}>
			<Stack spacing={1} width="100%">
				{configSource === 'lkg' && (
					<Alert severity="warning">{t('The gateway is serving the last-known-good file because the key store has not answered since it started. Objective and class writes are refused meanwhile.')}</Alert>
				)}
				{reachable === false && configSource !== 'lkg' && (
					<Alert severity="warning">{t('The key store did not answer the latest read. The configuration read earlier stays in force.')}</Alert>
				)}
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Applied From')} value={named(CONFIG_SOURCES, configSource)} tooltip={t('Where the objectives and the tenant and key classes in force came from. The same on every rule. Nothing read means every request is standard; it does not say the store is healthy.')} />
					<SingleTextBox label={t('Key Store Reachable')} value={shown(reachable)} tooltip={t('Whether the key store answered the gateway\'s latest read. Not reported when no key store is configured.')} />
					<SingleTextBox label={t('Last Store Read')} value={typeof lastRead === 'string' && lastRead !== '' ? lastRead : NOT_REPORTED} tooltip={t('When a read of the key store last answered in this process.')} />
				</Grid2>
			</Stack>
		</ValueBunch>
	);
}

export default function AdmissionBandsReadBack({effective}: {effective?: IFcEffective}) {
	if (!effective) return null;
	return (
		<Box display="flex" flexDirection="column" gap={2}>
			<PriorityBandsReadBack effective={effective} />
			<ReservationReadBack effective={effective} />
			<ClassConfigSourceReadBack effective={effective} />
		</Box>
	);
}
