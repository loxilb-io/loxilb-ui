//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Grid2, Stack, Switch, FormControlLabel, Divider} from '@mui/material';
import NewBox from 'components/layout/NewBox';
import ParamBox from 'components/element/ParamBox';
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

export default function SecurityRateInputForm(props: SecurityRateInputFormProps) {
	const {onChange, value} = props;

	const [form, setForm] = React.useState<ISecurityRateConfigMod>(value ?? {
		synEnabled: true,
		synThreshold: 100,
		cookieThreshold: 50,
		connRateEnabled: true,
		ratePerSec: 50,
		concurrentLimit: 200,
		udpEnabled: false,
		udpPktThreshold: 1000,
		udpBandwidthMB: 100,
		whitelistIps: [],
	});

	const [whitelistInput, setWhitelistInput] = React.useState((value?.whitelistIps ?? []).join(', '));

	const handleChange = (field: keyof ISecurityRateConfigMod) => (value: any) => {
		const newForm = {...form, [field]: value};
		setForm(newForm);
		onChange({...newForm, isValid: validateForm(newForm)});
	};

	const validateForm = (data: ISecurityRateConfigMod): boolean => {
		if (data.synEnabled && data.cookieThreshold >= data.synThreshold) return false;
		if (data.synThreshold < 0 || data.cookieThreshold < 0) return false;
		if (data.ratePerSec < 0 || data.concurrentLimit < 0) return false;
		if (data.udpPktThreshold < 0 || data.udpBandwidthMB < 0) return false;
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
			setForm(value);
			setWhitelistInput((value.whitelistIps ?? []).join(', '));
		}
	}, [value]);

	React.useEffect(() => {
		onChange({...form, isValid: validateForm(form)});
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
								value={form.synThreshold.toString()}
								onChange={(value: string) => handleChange('synThreshold')(parseInt(value) || 0)}
								param_desc={{type: 'integer', description: 'Maximum SYNs per second per IP (hard drop threshold)', required: true}}
							/>
							<ParamBox
								label={t('Cookie Threshold')}
								value={form.cookieThreshold.toString()}
								onChange={(value: string) => handleChange('cookieThreshold')(parseInt(value) || 0)}
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
								value={form.ratePerSec.toString()}
								onChange={(value: string) => handleChange('ratePerSec')(parseInt(value) || 0)}
								param_desc={{type: 'integer', description: 'Maximum new connections per second per IP', required: true}}
							/>
							<ParamBox
								label={t('Concurrent Limit')}
								value={form.concurrentLimit.toString()}
								onChange={(value: string) => handleChange('concurrentLimit')(parseInt(value) || 0)}
								param_desc={{type: 'integer', description: 'Maximum concurrent connections per IP', required: true}}
							/>
						</Grid2>
					)}
				</Stack>

				<Divider />

				{/* UDP Flood Protection */}
				<Stack spacing={2}>
					<FormControlLabel
						control={<Switch checked={form.udpEnabled} onChange={e => handleChange('udpEnabled')(e.target.checked)} />}
						label={t('Enable UDP Flood Protection (P0-7)')}
					/>
					{form.udpEnabled && (
						<Grid2 container spacing={2}>
							<ParamBox
								label={t('UDP Packet Threshold')}
								value={form.udpPktThreshold.toString()}
								onChange={(value: string) => handleChange('udpPktThreshold')(parseInt(value) || 0)}
								param_desc={{type: 'integer', description: 'Maximum UDP packets per second per IP', required: true}}
							/>
							<ParamBox
								label={t('UDP Bandwidth (MB/s)')}
								value={form.udpBandwidthMB.toString()}
								onChange={(value: string) => handleChange('udpBandwidthMB')(parseInt(value) || 0)}
								param_desc={{type: 'integer', description: 'Maximum UDP bandwidth in MB per second per IP', required: true}}
							/>
						</Grid2>
					)}
				</Stack>

				<Divider />

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
