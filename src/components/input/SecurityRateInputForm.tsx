//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert, Grid2, Stack, Switch, FormControlLabel, Divider} from '@mui/material';
import NewBox from 'components/layout/NewBox';
import ParamBox from 'components/element/ParamBox';
import {evaluateNumericField, NumericFieldSpec} from 'components/input/numericField';
import {validateSecurityRateConfig} from 'types/security_rate_policy';
import {t} from 'i18next';
import {ISecurityRateConfigMod} from 'types/security';
import React from 'react';
import {validGatewayCidr} from 'types/network_prefix';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface SecurityRateInputFormProps {
	value?: ISecurityRateConfigMod;
	supportsAggregate?: boolean;
	onChange: (data: ISecurityRateConfigMod & {isValid?: boolean}) => void;
}

// Defaults scaffold a NEW configuration. GET omits zero values; editing an
// existing row must preserve its omitted flags/thresholds as false/zero.
// Every required POST field is still materialized explicitly.
const DEFAULT_FORM: ISecurityRateConfigMod = {
	synEnabled: true,
	synThreshold: 100,
	cookieThreshold: 50,
	connRateEnabled: true,
	ratePerSec: 50,
	udpEnabled: false,
	udpPktThreshold: 1000,
	udpBandwidthMB: 100,
	whitelistIps: [],
};

function withDefaults(value?: ISecurityRateConfigMod): ISecurityRateConfigMod {
	return {
		synEnabled: value ? Boolean(value.synEnabled) : DEFAULT_FORM.synEnabled,
		synThreshold: value ? value.synThreshold ?? 0 : DEFAULT_FORM.synThreshold,
		cookieThreshold: value ? value.cookieThreshold ?? 0 : DEFAULT_FORM.cookieThreshold,
		connRateEnabled: value ? Boolean(value.connRateEnabled) : DEFAULT_FORM.connRateEnabled,
		ratePerSec: value ? value.ratePerSec ?? 0 : DEFAULT_FORM.ratePerSec,
		udpEnabled: value?.udpEnabled ?? DEFAULT_FORM.udpEnabled,
		udpPktThreshold: value ? value.udpPktThreshold ?? 0 : DEFAULT_FORM.udpPktThreshold,
		udpBandwidthMB: value ? value.udpBandwidthMB ?? 0 : DEFAULT_FORM.udpBandwidthMB,
		whitelistIps: value?.whitelistIps ?? DEFAULT_FORM.whitelistIps,
		aggregateSynThreshold: value?.aggregateSynThreshold ?? 0,
		aggregateConnRatePerSec: value?.aggregateConnRatePerSec ?? 0,
		aggregateUdpPktThreshold: value?.aggregateUdpPktThreshold ?? 0,
		aggregateUdpBandwidthMB: value?.aggregateUdpBandwidthMB ?? 0,
	};
}

type NumericRateField = 'synThreshold' | 'cookieThreshold' | 'ratePerSec' | 'udpPktThreshold' | 'udpBandwidthMB' | 'aggregateSynThreshold' | 'aggregateConnRatePerSec' | 'aggregateUdpPktThreshold' | 'aggregateUdpBandwidthMB';
type RateRaws = Record<NumericRateField, string>;

function rawsFrom(v: ISecurityRateConfigMod): RateRaws {
	return {
		synThreshold: String(v.synThreshold),
		cookieThreshold: String(v.cookieThreshold),
		ratePerSec: String(v.ratePerSec),
		udpPktThreshold: String(v.udpPktThreshold),
		udpBandwidthMB: String(v.udpBandwidthMB),
		aggregateSynThreshold: String(v.aggregateSynThreshold ?? 0),
		aggregateConnRatePerSec: String(v.aggregateConnRatePerSec ?? 0),
		aggregateUdpPktThreshold: String(v.aggregateUdpPktThreshold ?? 0),
		aggregateUdpBandwidthMB: String(v.aggregateUdpBandwidthMB ?? 0),
	};
}

export default function SecurityRateInputForm(props: SecurityRateInputFormProps) {
	const {onChange, value, supportsAggregate = false} = props;
	// Legacy instances must not receive fields that their schema does not support.
	const reportChange = (data: ISecurityRateConfigMod & {isValid?: boolean}) => {
		const {aggregateSynThreshold, aggregateConnRatePerSec, aggregateUdpPktThreshold, aggregateUdpBandwidthMB, ...legacy} = data;
		onChange(supportsAggregate ? {...legacy, aggregateSynThreshold, aggregateConnRatePerSec, aggregateUdpPktThreshold, aggregateUdpBandwidthMB} : legacy);
	};

	const [form, setForm] = React.useState<ISecurityRateConfigMod>(withDefaults(value));

	// Raw text as typed for the numeric fields: the wire
	// object keeps the last VALID numbers; garbage never overwrites them and
	// never coerces to 0 — it just makes the form invalid until corrected.
	const [raws, setRaws] = React.useState<RateRaws>(() => rawsFrom(withDefaults(value)));

	const [whitelistInput, setWhitelistInput] = React.useState((value?.whitelistIps ?? []).join(', '));

	const handleChange = (field: keyof ISecurityRateConfigMod) => (value: any) => {
		const newForm = {...form, [field]: value};
		setForm(newForm);
		reportChange({...newForm, isValid: validateForm(newForm) && allRawsValid(raws)});
	};

	// Gateway upper bounds (securityrate.go): PPS thresholds cap at 2^24 and
	// udpBandwidthMB at 4095 — and the gateway range-checks every field
	// unconditionally, even when its section is off. Enforce them client-side so
	// an out-of-range value is caught here instead of coming back as a 400.
	const PPS_MAX = 1 << 24; // secRateMaxPPSThreshold
	const UDP_BW_MAX = 4095; // secRateMaxUDPBandwidthMB

	const NUMERIC_SPECS: Record<NumericRateField, NumericFieldSpec> = {
		synThreshold: {required: true, min: 0, max: PPS_MAX},
		cookieThreshold: {required: true, min: 0, max: PPS_MAX},
		ratePerSec: {required: true, min: 0, max: PPS_MAX},
		udpPktThreshold: {required: true, min: 0, max: PPS_MAX},
		udpBandwidthMB: {required: true, min: 0, max: UDP_BW_MAX},
		aggregateSynThreshold: {required: true, min: 0, max: PPS_MAX},
		aggregateConnRatePerSec: {required: true, min: 0, max: PPS_MAX},
		aggregateUdpPktThreshold: {required: true, min: 0, max: PPS_MAX},
		aggregateUdpBandwidthMB: {required: true, min: 0, max: UDP_BW_MAX},
	};

	const allRawsValid = (r: RateRaws): boolean =>
		(Object.keys(NUMERIC_SPECS) as NumericRateField[]).every(f => evaluateNumericField(r[f], NUMERIC_SPECS[f]).valid);

	const handleNumericChange = (field: NumericRateField) => (rawVal: string) => {
		const newRaws = {...raws, [field]: rawVal};
		setRaws(newRaws);
		const state = evaluateNumericField(rawVal, NUMERIC_SPECS[field]);
		// Only a fully valid integer reaches the wire object; the stale number
		// is unreachable while invalid because isValid gates the submit.
		const newForm = state.parsed !== undefined ? {...form, [field]: state.parsed} : form;
		if (state.parsed !== undefined) setForm(newForm);
		reportChange({...newForm, isValid: validateForm(newForm) && allRawsValid(newRaws)});
	};

	const numericFieldProps = (field: NumericRateField) => {
		const state = evaluateNumericField(raws[field], NUMERIC_SPECS[field]);
		return {value: raws[field], onChange: handleNumericChange(field), raw: true, error: !state.valid, helperText: state.error};
	};

	// The gateway also rejects a zero threshold on any *enabled* protection and
	// a config with every protection switched off (disable has its own
	// endpoint). Mirror both rules so the bad combination is blocked here with
	// an explanation instead of coming back as a 400.
	const hasZeroThreshold = (data: ISecurityRateConfigMod): boolean =>
		(data.synEnabled && data.synThreshold <= 0) ||
		(data.connRateEnabled && data.ratePerSec <= 0) ||
		(data.udpEnabled && (data.udpPktThreshold <= 0 || data.udpBandwidthMB <= 0));

	const allProtectionsDisabled = (data: ISecurityRateConfigMod): boolean =>
		!data.synEnabled && !data.connRateEnabled && !data.udpEnabled &&
		!(supportsAggregate && [data.aggregateSynThreshold, data.aggregateConnRatePerSec, data.aggregateUdpPktThreshold, data.aggregateUdpBandwidthMB].some(n => (n ?? 0) > 0));

	const validateForm = (data: ISecurityRateConfigMod): boolean =>
		!allProtectionsDisabled(data) && validateSecurityRateConfig(data).length === 0;

	const handleWhitelistChange = (value: string) => {
		setWhitelistInput(value);
		const ips = value
			.split(',')
			.map(ip => ip.trim())
			.filter(ip => ip.length > 0);
		handleChange('whitelistIps')(ips);
	};

	React.useEffect(() => {
		if (value) {
			setForm(withDefaults(value));
			setRaws(rawsFrom(withDefaults(value)));
			setWhitelistInput((value.whitelistIps ?? []).join(', '));
		}
	}, [value]);

	React.useEffect(() => {
		reportChange({...form, isValid: validateForm(form) && allRawsValid(raws)});
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	}, []);

	return (
		<NewBox item_name={t('Security Rate Limiting Configuration')}>
			<Stack spacing={3}>
				{/* SYN Flood Protection */}
				<Stack spacing={2}>
					<FormControlLabel
						control={<Switch checked={form.synEnabled} onChange={e => handleChange('synEnabled')(e.target.checked)} />}
						label={t('Enable SYN Flood Protection')}
					/>
					{form.synEnabled && (
						<Grid2 container spacing={2}>
							<ParamBox
								label={t('SYN Threshold')}
								{...numericFieldProps('synThreshold')}
								param_desc={{type: 'integer', description: 'Maximum SYNs per second per IP (hard drop threshold)', required: true}}
							/>
							<ParamBox
								label={t('Cookie Threshold')}
								{...numericFieldProps('cookieThreshold')}
								param_desc={{type: 'integer', description: 'SYN threshold telemetry, not a SYN-cookie exchange. Must be below SYN Threshold. Explicit zero becomes 50 in the datapath.', required: true}}
							/>
						</Grid2>
					)}
				</Stack>

				<Divider />

				{/* Connection Rate Limiting */}
				<Stack spacing={2}>
					<FormControlLabel
						control={<Switch checked={form.connRateEnabled} onChange={e => handleChange('connRateEnabled')(e.target.checked)} />}
						label={t('Enable Connection Rate Limiting')}
					/>
					{form.connRateEnabled && (
						<Grid2 container spacing={2}>
							<ParamBox
								label={t('Rate Per Second')}
								{...numericFieldProps('ratePerSec')}
								param_desc={{type: 'integer', description: 'Maximum SYN packets per second per source IP, not completed connections.', required: true}}
							/>
						</Grid2>
					)}
				</Stack>

				<Divider />

				{/* UDP Flood Protection */}
				<Stack spacing={2}>
					<FormControlLabel
						control={<Switch checked={form.udpEnabled} onChange={e => handleChange('udpEnabled')(e.target.checked)} />}
						label={t('Enable UDP Flood Protection')}
					/>
					{form.udpEnabled && (
						<Grid2 container spacing={2}>
							<ParamBox
								label={t('UDP Packet Threshold')}
								{...numericFieldProps('udpPktThreshold')}
								param_desc={{type: 'integer', description: 'Maximum UDP packets per second per IP', required: true}}
							/>
							<ParamBox
								label={t('UDP Bandwidth (MiB/s)')}
								{...numericFieldProps('udpBandwidthMB')}
								param_desc={{type: 'integer', description: 'Maximum UDP bandwidth in MiB per second per source IP (1 MiB = 1048576 bytes).', required: true}}
							/>
						</Grid2>
					)}
				</Stack>

				<Divider />

				{hasZeroThreshold(form) && (
					<Alert severity="warning">{t('Every enabled protection needs a threshold greater than zero.')}</Alert>
				)}
				{allProtectionsDisabled(form) && (
					<Alert severity="warning">{t('Enable at least one per-source protection or a positive aggregate budget. Use Disable to turn protection off entirely.')}</Alert>
				)}
				{supportsAggregate && (
					<Stack spacing={2}>
						<Alert severity="info">{t('Aggregate budgets apply across listeners and interfaces before authentication. Zero disables that budget. Whitelisted sources bypass rate protection.')}</Alert>
						<Grid2 container spacing={2}>
							{([
								['aggregateSynThreshold', 'Aggregate SYN Packets/s'],
								['aggregateConnRatePerSec', 'Aggregate Connection SYN Packets/s'],
								['aggregateUdpPktThreshold', 'Aggregate UDP Packets/s'],
								['aggregateUdpBandwidthMB', 'Aggregate UDP Bandwidth (MiB/s)'],
							] as const).map(([field, label]) => <ParamBox key={field} label={t(label)} {...numericFieldProps(field)} param_desc={{type: 'integer', required: true}} />)}
						</Grid2>
					</Stack>
				)}

				{/* Whitelist IPs */}
				<ParamBox
					label={t('Whitelist IPs (comma-separated)')}
					value={whitelistInput}
					error={(form.whitelistIps ?? []).length > 1024 || !(form.whitelistIps ?? []).every(validGatewayCidr)}
					helperText={t('Enter at most 1024 IPv4 or IPv6 CIDRs. Empty clears the previous whitelist.')}
					onChange={handleWhitelistChange}
					param_desc={{type: 'string', description: 'CIDRs bypassing security-rate checks; shared maps with IP Filter whitelist. Empty clears the previous list.'}}
				/>
			</Stack>
		</NewBox>
	);
}
