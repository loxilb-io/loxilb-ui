//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert, Grid2, Stack, Switch, FormControlLabel, Divider} from '@mui/material';
import NewBox from 'components/layout/NewBox';
import ParamBox from 'components/element/ParamBox';
import {evaluateNumericField, NumericFieldSpec} from 'components/input/numericField';
import {t} from 'i18next';
import {ISecurityRateConfigMod} from 'types/security';
import React from 'react';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface SecurityRateInputFormProps {
	value?: ISecurityRateConfigMod;
	onChange: (data: ISecurityRateConfigMod & {isValid?: boolean}) => void;
}

// Per-field defaults. The gateway omits false booleans (omitempty), so an
// existing config loaded for edit can arrive missing e.g. udpEnabled — merge
// each field over these defaults rather than taking `value` wholesale, or the
// POST drops the missing keys and the gateway 422s.
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
		synEnabled: value?.synEnabled ?? DEFAULT_FORM.synEnabled,
		synThreshold: value?.synThreshold ?? DEFAULT_FORM.synThreshold,
		cookieThreshold: value?.cookieThreshold ?? DEFAULT_FORM.cookieThreshold,
		connRateEnabled: value?.connRateEnabled ?? DEFAULT_FORM.connRateEnabled,
		ratePerSec: value?.ratePerSec ?? DEFAULT_FORM.ratePerSec,
		udpEnabled: value?.udpEnabled ?? DEFAULT_FORM.udpEnabled,
		udpPktThreshold: value?.udpPktThreshold ?? DEFAULT_FORM.udpPktThreshold,
		udpBandwidthMB: value?.udpBandwidthMB ?? DEFAULT_FORM.udpBandwidthMB,
		whitelistIps: value?.whitelistIps ?? DEFAULT_FORM.whitelistIps,
	};
}

type NumericRateField = 'synThreshold' | 'cookieThreshold' | 'ratePerSec' | 'udpPktThreshold' | 'udpBandwidthMB';
type RateRaws = Record<NumericRateField, string>;

function rawsFrom(v: ISecurityRateConfigMod): RateRaws {
	return {
		synThreshold: String(v.synThreshold),
		cookieThreshold: String(v.cookieThreshold),
		ratePerSec: String(v.ratePerSec),
		udpPktThreshold: String(v.udpPktThreshold),
		udpBandwidthMB: String(v.udpBandwidthMB),
	};
}

export default function SecurityRateInputForm(props: SecurityRateInputFormProps) {
	const {onChange, value} = props;

	const [form, setForm] = React.useState<ISecurityRateConfigMod>(withDefaults(value));

	// Raw text as typed for the numeric fields: the wire
	// object keeps the last VALID numbers; garbage never overwrites them and
	// never coerces to 0 — it just makes the form invalid until corrected.
	const [raws, setRaws] = React.useState<RateRaws>(() => rawsFrom(withDefaults(value)));

	const [whitelistInput, setWhitelistInput] = React.useState((value?.whitelistIps ?? []).join(', '));

	const handleChange = (field: keyof ISecurityRateConfigMod) => (value: any) => {
		const newForm = {...form, [field]: value};
		setForm(newForm);
		onChange({...newForm, isValid: validateForm(newForm) && allRawsValid(raws)});
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
		onChange({...newForm, isValid: validateForm(newForm) && allRawsValid(newRaws)});
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
		!data.synEnabled && !data.connRateEnabled && !data.udpEnabled;

	const validateForm = (data: ISecurityRateConfigMod): boolean => {
		if (data.synEnabled && data.cookieThreshold >= data.synThreshold) return false;
		if (data.synThreshold < 0 || data.cookieThreshold < 0 || data.ratePerSec < 0 || data.udpPktThreshold < 0 || data.udpBandwidthMB < 0) return false;
		if (data.synThreshold > PPS_MAX || data.cookieThreshold > PPS_MAX || data.ratePerSec > PPS_MAX || data.udpPktThreshold > PPS_MAX) return false;
		if (data.udpBandwidthMB > UDP_BW_MAX) return false;
		if (hasZeroThreshold(data)) return false;
		if (allProtectionsDisabled(data)) return false;
		return true;
	};

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
		onChange({...form, isValid: validateForm(form)});
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
								param_desc={{type: 'integer', description: 'Enable SYN cookies above this rate (must be < synThreshold)', required: true}}
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
								param_desc={{type: 'integer', description: 'Maximum new connections per second per IP', required: true}}
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
								label={t('UDP Bandwidth (MB/s)')}
								{...numericFieldProps('udpBandwidthMB')}
								param_desc={{type: 'integer', description: 'Maximum UDP bandwidth in MB per second per IP', required: true}}
							/>
						</Grid2>
					)}
				</Stack>

				<Divider />

				{hasZeroThreshold(form) && (
					<Alert severity="warning">{t('Every enabled protection needs a threshold greater than zero.')}</Alert>
				)}
				{allProtectionsDisabled(form) && (
					<Alert severity="warning">{t('At least one protection (SYN Flood, Connection Rate, or UDP Flood) must be enabled. Use Disable to turn protection off entirely.')}</Alert>
				)}

				{/* Whitelist IPs */}
				<ParamBox
					label={t('Whitelist IPs (comma-separated)')}
					value={whitelistInput}
					onChange={handleWhitelistChange}
					param_desc={{type: 'string', description: 'IP addresses to bypass all rate limiting (comma-separated)'}}
				/>
			</Stack>
		</NewBox>
	);
}
