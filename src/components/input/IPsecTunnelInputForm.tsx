//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Alert, Divider, FormControlLabel, Grid2, Stack, Switch, Typography} from '@mui/material';
import NewBox from 'components/layout/NewBox';
import ParamBox from 'components/element/ParamBox';
import {isValidIPAddress, isValidIPAddressCidr} from 'common';
import {t} from 'i18next';
import React from 'react';
import {IIPsecCACertificate, IIPsecCertificate, IIPsecTunnelMod} from 'types/ipsec';

//---------------------------------------------------------
// Proposal option sets
//
// The gateway composes strongSwan proposals from the individual tokens:
//   ike = <ikeEncryption>-<ikeIntegrity>-<ikeDhGroup>
//   esp = <espEncryption>-<espIntegrity>
// so each field must be a single algorithm token, not a full suite string.
//---------------------------------------------------------
const ENCRYPTION_ALGOS = ['aes256', 'aes128', 'aes256gcm16', 'aes128gcm16', '3des (legacy)'];
const INTEGRITY_ALGOS = ['sha256', 'sha384', 'sha512', 'sha1 (legacy)'];
const DH_GROUPS = ['modp2048', 'modp3072', 'modp4096', 'ecp256', 'ecp384', 'modp1024 (legacy)'];

const stripLegacy = (v: string) => v.replace(' (legacy)', '');

// Named policy presets (Meraki pattern) — fill the proposal fields; every
// value stays editable under Advanced.
const PRESETS: Record<string, Partial<IIPsecTunnelMod>> = {
	default: {
		ikeVersion: 'ikev2',
		ikeEncryption: 'aes256',
		ikeIntegrity: 'sha256',
		ikeDhGroup: 'modp2048',
		ikeLifetime: 28800,
		espEncryption: 'aes256',
		espIntegrity: 'sha256',
		espDhGroup: 'modp2048',
		espLifetime: 3600,
	},
	aws: {
		ikeVersion: 'ikev2',
		ikeEncryption: 'aes256',
		ikeIntegrity: 'sha256',
		ikeDhGroup: 'modp2048',
		ikeLifetime: 28800,
		espEncryption: 'aes256',
		espIntegrity: 'sha256',
		espDhGroup: 'modp2048',
		espLifetime: 3600,
		dpd: {action: 'restart', delay: 10, timeout: 30},
	},
	azure: {
		ikeVersion: 'ikev2',
		ikeEncryption: 'aes256',
		ikeIntegrity: 'sha256',
		ikeDhGroup: 'modp1024',
		ikeLifetime: 28800,
		espEncryption: 'aes256',
		espIntegrity: 'sha256',
		espDhGroup: 'modp1024',
		espLifetime: 3600,
	},
};

const DEFAULT_FORM: IIPsecTunnelMod = {
	name: '',
	localIp: '',
	remoteIp: '',
	authMode: 'psk',
	psk: '',
	ikeVersion: 'ikev2',
	ikeEncryption: 'aes256',
	ikeIntegrity: 'sha256',
	ikeDhGroup: 'modp2048',
	ikeLifetime: 28800,
	espEncryption: 'aes256',
	espIntegrity: 'sha256',
	espDhGroup: 'modp2048',
	espLifetime: 3600,
	tunnelMode: 'tunnel',
	auto: 'start',
	mark: 100,
	installPolicy: true,
	compress: false,
	mobike: false,
	rekey: true,
	reauth: false,
	selector: {srcCidr: '', dstCidr: ''},
	dpd: {action: 'restart', delay: 30, timeout: 150},
};

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface IPsecTunnelInputFormProps {
	// Pre-fill for the recreate-based edit flow; name locked, PSK must be re-entered
	value?: Partial<IIPsecTunnelMod>;
	isEdit?: boolean;
	certificates: IIPsecCertificate[];
	caCertificates: IIPsecCACertificate[];
	onChange: (data: IIPsecTunnelMod & {isValid?: boolean}) => void;
}

export default function IPsecTunnelInputForm(props: IPsecTunnelInputFormProps) {
	const {onChange, value, isEdit, certificates, caCertificates} = props;

	const [form, setForm] = React.useState<IIPsecTunnelMod>({...DEFAULT_FORM, ...value});
	const [preset, setPreset] = React.useState('default');
	const [showAdvanced, setShowAdvanced] = React.useState(false);

	const certNames = certificates.map(c => c.name ?? '').filter(n => n.length > 0);
	const caCertNames = caCertificates.map(c => c.name ?? '').filter(n => n.length > 0);

	const validateForm = (data: IIPsecTunnelMod): boolean => {
		if (data.name.trim().length === 0) return false;
		if (!isValidIPAddress(data.localIp) || !isValidIPAddress(data.remoteIp)) return false;
		// On edit an empty PSK means "keep the stored one" (PUT carries it over)
		if (data.authMode === 'psk' && (data.psk ?? '').length === 0 && !isEdit) return false;
		if (data.authMode === 'cert' && (!data.certName || !data.caCertName)) return false;
		if (data.selector?.srcCidr && !isValidIPAddressCidr(data.selector.srcCidr)) return false;
		if (data.selector?.dstCidr && !isValidIPAddressCidr(data.selector.dstCidr)) return false;
		if ((data.ikeLifetime ?? 0) < 0 || (data.espLifetime ?? 0) < 0) return false;
		return true;
	};

	const emit = (newForm: IIPsecTunnelMod) => {
		setForm(newForm);
		onChange({...newForm, isValid: validateForm(newForm)});
	};

	const handleChange = (field: keyof IIPsecTunnelMod) => (val: any) => {
		emit({...form, [field]: val});
	};

	const handleSelectorChange = (field: 'srcCidr' | 'dstCidr') => (val: string) => {
		emit({...form, selector: {...form.selector, [field]: val}});
	};

	const handleDpdChange = (field: 'action' | 'delay' | 'timeout') => (val: any) => {
		emit({...form, dpd: {...(form.dpd ?? DEFAULT_FORM.dpd), [field]: val}});
	};

	const handlePreset = (name: string) => {
		setPreset(name);
		if (PRESETS[name]) emit({...form, ...PRESETS[name]});
	};

	React.useEffect(() => {
		onChange({...form, isValid: validateForm(form)});
	}, []);

	return (
		<NewBox item_name={isEdit ? t('Edit IPsec Tunnel') : t('IPsec Tunnel')}>
			<Stack spacing={3}>
				{isEdit && (
					<Alert severity="info">
						{t('The tunnel is updated in place (single strongSwan reload). Leave the PSK blank to keep the current one.')}
					</Alert>
				)}

				{/* General */}
				<Grid2 container spacing={2}>
					<ParamBox
						label={t('Name')}
						value={form.name}
						onChange={handleChange('name')}
						disabled={isEdit}
						param_desc={{type: 'string', description: 'Unique tunnel name', required: true}}
					/>
					<ParamBox
						label={t('Local IP')}
						value={form.localIp}
						onChange={handleChange('localIp')}
						param_desc={{type: 'string', format: 'ipv4', description: 'Local gateway IP address', required: true}}
					/>
					<ParamBox
						label={t('Remote IP')}
						value={form.remoteIp}
						onChange={handleChange('remoteIp')}
						param_desc={{type: 'string', format: 'ipv4', description: 'Remote peer gateway IP address', required: true}}
					/>
				</Grid2>

				{/* Authentication */}
				<Divider />
				<Typography variant="subtitle2">{t('Authentication')}</Typography>
				<Grid2 container spacing={2}>
					<ParamBox
						label={t('Auth Mode')}
						value={form.authMode}
						onChange={handleChange('authMode')}
						param_desc={{type: 'string', enum: ['psk', 'cert'], description: 'psk = pre-shared key, cert = X.509 certificates', required: true}}
					/>
					{form.authMode === 'psk' && (
						<ParamBox
							label={t('Pre-Shared Key')}
							value={form.psk ?? ''}
							onChange={handleChange('psk')}
							param_desc={{
								type: 'string',
								description: isEdit ? 'Leave blank to keep the current key' : 'Shared secret — must match the remote peer',
								required: !isEdit,
							}}
						/>
					)}
					{form.authMode === 'cert' && (
						<>
							<ParamBox
								label={t('Local Certificate')}
								value={form.certName ?? ''}
								onChange={handleChange('certName')}
								param_desc={{type: 'string', enum: certNames, description: 'Certificate from the IPsec certificate store', required: true}}
							/>
							<ParamBox
								label={t('CA Certificate (peer validation)')}
								value={form.caCertName ?? ''}
								onChange={handleChange('caCertName')}
								param_desc={{type: 'string', enum: caCertNames, description: 'CA used to validate the peer certificate', required: true}}
							/>
						</>
					)}
				</Grid2>
				{form.authMode === 'cert' && certNames.length === 0 && (
					<Alert severity="info">{t('No certificates uploaded yet — add them under IPsec VPN → Certificates first.')}</Alert>
				)}

				{/* Traffic selectors */}
				<Divider />
				<Typography variant="subtitle2">{t('Traffic Selectors')}</Typography>
				<Grid2 container spacing={2}>
					<ParamBox
						label={t('Local Subnet (CIDR)')}
						value={form.selector?.srcCidr ?? ''}
						onChange={handleSelectorChange('srcCidr')}
						param_desc={{type: 'string', description: 'Local traffic selector, e.g. 10.0.0.0/24 (empty = host-to-host)'}}
					/>
					<ParamBox
						label={t('Remote Subnet (CIDR)')}
						value={form.selector?.dstCidr ?? ''}
						onChange={handleSelectorChange('dstCidr')}
						param_desc={{type: 'string', description: 'Remote traffic selector, e.g. 10.1.0.0/24 (empty = host-to-host)'}}
					/>
				</Grid2>

				{/* Policy preset */}
				<Divider />
				<Grid2 container spacing={2}>
					<ParamBox
						label={t('Policy Preset')}
						value={preset}
						onChange={handlePreset}
						param_desc={{
							type: 'string',
							enum: Object.keys(PRESETS),
							description: 'Fills the IKE/ESP proposals with a known-good suite (default = recommended; aws / azure = interop values). All values editable under Advanced.',
						}}
					/>
					<FormControlLabel
						control={<Switch checked={showAdvanced} onChange={e => setShowAdvanced(e.target.checked)} />}
						label={t('Show Advanced Settings')}
					/>
				</Grid2>

				{showAdvanced && (
					<Stack spacing={3}>
						{/* IKE */}
						<Divider />
						<Typography variant="subtitle2">{t('IKE (Phase 1)')}</Typography>
						<Grid2 container spacing={2}>
							<ParamBox
								label={t('IKE Version')}
								value={form.ikeVersion ?? 'ikev2'}
								onChange={handleChange('ikeVersion')}
								param_desc={{type: 'string', enum: ['ikev2', 'ikev1'], description: 'IKEv2 recommended'}}
							/>
							<ParamBox
								label={t('Encryption')}
								value={form.ikeEncryption ?? 'aes256'}
								onChange={(v: string) => handleChange('ikeEncryption')(stripLegacy(v))}
								param_desc={{type: 'string', enum: ENCRYPTION_ALGOS, description: 'IKE encryption algorithm'}}
							/>
							<ParamBox
								label={t('Integrity')}
								value={form.ikeIntegrity ?? 'sha256'}
								onChange={(v: string) => handleChange('ikeIntegrity')(stripLegacy(v))}
								param_desc={{type: 'string', enum: INTEGRITY_ALGOS, description: 'IKE integrity/hash algorithm'}}
							/>
							<ParamBox
								label={t('DH Group')}
								value={form.ikeDhGroup ?? 'modp2048'}
								onChange={(v: string) => handleChange('ikeDhGroup')(stripLegacy(v))}
								param_desc={{type: 'string', enum: DH_GROUPS, description: 'Diffie-Hellman group'}}
							/>
							<ParamBox
								label={t('IKE Lifetime (s)')}
								value={(form.ikeLifetime ?? 28800).toString()}
								onChange={(v: string) => handleChange('ikeLifetime')(parseInt(v) || 0)}
								param_desc={{type: 'integer', description: 'Phase 1 SA lifetime in seconds (default 28800)'}}
							/>
						</Grid2>

						{/* ESP */}
						<Divider />
						<Typography variant="subtitle2">{t('ESP (Phase 2)')}</Typography>
						<Grid2 container spacing={2}>
							<ParamBox
								label={t('Encryption')}
								value={form.espEncryption ?? 'aes256'}
								onChange={(v: string) => handleChange('espEncryption')(stripLegacy(v))}
								param_desc={{type: 'string', enum: ENCRYPTION_ALGOS, description: 'ESP encryption algorithm'}}
							/>
							<ParamBox
								label={t('Integrity')}
								value={form.espIntegrity ?? 'sha256'}
								onChange={(v: string) => handleChange('espIntegrity')(stripLegacy(v))}
								param_desc={{type: 'string', enum: INTEGRITY_ALGOS, description: 'ESP integrity algorithm'}}
							/>
							<ParamBox
								label={t('PFS Group')}
								value={form.espDhGroup ?? 'modp2048'}
								onChange={(v: string) => handleChange('espDhGroup')(stripLegacy(v))}
								param_desc={{type: 'string', enum: DH_GROUPS, description: 'Perfect Forward Secrecy DH group, appended to the ESP proposal'}}
							/>
							<ParamBox
								label={t('ESP Lifetime (s)')}
								value={(form.espLifetime ?? 3600).toString()}
								onChange={(v: string) => handleChange('espLifetime')(parseInt(v) || 0)}
								param_desc={{type: 'integer', description: 'Phase 2 SA lifetime in seconds (default 3600)'}}
							/>
						</Grid2>

						{/* Identifiers + connection behavior */}
						<Divider />
						<Typography variant="subtitle2">{t('Identifiers & Connection')}</Typography>
						<Grid2 container spacing={2}>
							<ParamBox
								label={t('Local ID')}
								value={form.localId ?? ''}
								onChange={handleChange('localId')}
								param_desc={{type: 'string', description: 'IKE local identifier (defaults to local IP)'}}
							/>
							<ParamBox
								label={t('Remote ID')}
								value={form.remoteId ?? ''}
								onChange={handleChange('remoteId')}
								param_desc={{type: 'string', description: 'IKE remote identifier (defaults to remote IP)'}}
							/>
							<ParamBox
								label={t('Mode')}
								value={form.tunnelMode ?? 'tunnel'}
								onChange={handleChange('tunnelMode')}
								param_desc={{type: 'string', enum: ['tunnel', 'transport'], description: 'IPsec encapsulation mode'}}
							/>
							<ParamBox
								label={t('Startup')}
								value={form.auto ?? 'start'}
								onChange={handleChange('auto')}
								param_desc={{type: 'string', enum: ['start', 'add', 'route'], description: 'start = initiate now, add = wait as responder, route = on-demand'}}
							/>
							<ParamBox
								label={t('VTI Mark')}
								value={(form.mark ?? 100).toString()}
								onChange={(v: string) => handleChange('mark')(parseInt(v) || 0)}
								param_desc={{type: 'integer', description: 'Netfilter mark for VTI routing (0 = no mark)'}}
							/>
						</Grid2>
						<Grid2 container spacing={2}>
							<FormControlLabel
								control={<Switch checked={form.installPolicy ?? true} onChange={e => handleChange('installPolicy')(e.target.checked)} />}
								label={t('Install XFRM Policies')}
							/>
							<FormControlLabel
								control={<Switch checked={form.rekey ?? true} onChange={e => handleChange('rekey')(e.target.checked)} />}
								label={t('Auto Rekey')}
							/>
							<FormControlLabel
								control={<Switch checked={form.reauth ?? false} onChange={e => handleChange('reauth')(e.target.checked)} />}
								label={t('Reauth on Rekey')}
							/>
							<FormControlLabel
								control={<Switch checked={form.mobike ?? false} onChange={e => handleChange('mobike')(e.target.checked)} />}
								label={t('MOBIKE')}
							/>
							<FormControlLabel
								control={<Switch checked={form.compress ?? false} onChange={e => handleChange('compress')(e.target.checked)} />}
								label={t('IP Compression')}
							/>
							<FormControlLabel
								control={<Switch checked={form.compatFallback ?? false} onChange={e => handleChange('compatFallback')(e.target.checked)} />}
								label={t('Legacy Cipher Fallback')}
							/>
						</Grid2>

						{/* DPD */}
						<Divider />
						<Typography variant="subtitle2">{t('Dead Peer Detection')}</Typography>
						<Grid2 container spacing={2}>
							<ParamBox
								label={t('Action')}
								value={form.dpd?.action ?? 'restart'}
								onChange={handleDpdChange('action')}
								param_desc={{type: 'string', enum: ['restart', 'clear', 'hold'], description: 'Action when the peer stops responding'}}
							/>
							<ParamBox
								label={t('Delay (s)')}
								value={(form.dpd?.delay ?? 30).toString()}
								onChange={(v: string) => handleDpdChange('delay')(parseInt(v) || 0)}
								param_desc={{type: 'integer', description: 'Seconds between DPD probes (default 30)'}}
							/>
							<ParamBox
								label={t('Timeout (s)')}
								value={(form.dpd?.timeout ?? 150).toString()}
								onChange={(v: string) => handleDpdChange('timeout')(parseInt(v) || 0)}
								param_desc={{type: 'integer', description: 'Declare peer dead after this many seconds (default 150)'}}
							/>
						</Grid2>
					</Stack>
				)}
			</Stack>
		</NewBox>
	);
}
