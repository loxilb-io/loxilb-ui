//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Grid2, Stack} from '@mui/material';
import modes from 'assets/json/modes.json';
import sels from 'assets/json/sels.json';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import {t} from 'i18next';
import {IEnumItem} from 'types/global';
import {resolveCircuitBreaker} from 'types/ai_gateway';
import {IServiceArguments} from 'types/load_balancer';

//---------------------------------------------------------
// Read-back helpers
//---------------------------------------------------------
type HalfCloseEffective = NonNullable<IServiceArguments['half_close_effective']>;

/**
 * The half-close mode in force, with who decided it. The gateway resolves it
 * from three places — the rule, the process default, and a process-wide block
 * — so the mode alone would not say why a rule is not holding. A default the
 * gateway could not apply to this rule carries its own reason, shown verbatim.
 * A mode or source this UI does not know is passed through, not guessed at.
 */
export function halfCloseReadBack(effective: HalfCloseEffective | undefined): string | undefined {
	if (!effective?.mode) return undefined;
	const mode = effective.mode === 'hold' ? t('Hold') : effective.mode === 'off' ? t('Off') : effective.mode;
	if (effective.not_applied) return t('{{mode}} (gateway default not applied: {{reason}})', {mode, reason: effective.not_applied});
	switch (effective.source) {
		case 'rule': return t('{{mode}} (set on the rule)', {mode});
		case 'default': return t('{{mode}} (gateway default)', {mode});
		case 'blocked': return t('{{mode}} (holds are blocked on this gateway)', {mode});
		default: return effective.source ? `${mode} (${effective.source})` : mode;
	}
}

const SOCKMAP_MODE_NAMES: Record<string, string> = {
	off: 'Off',
	both: 'Both directions',
	request: 'Request only (client to backend)',
	response: 'Response only (backend to client)',
};

/** The declared sockmap mode by name; an unknown one is shown as sent. */
export function sockMapReadBack(mode: IServiceArguments['sockMapMode']): string | undefined {
	if (!mode) return undefined;
	return SOCKMAP_MODE_NAMES[mode] ? t(SOCKMAP_MODE_NAMES[mode]) : mode;
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SettingsPanel(props: {serviceArguments: IServiceArguments}) {
	const {serviceArguments} = props;

	const sel_list: IEnumItem[] = sels;
	const mode_list: IEnumItem[] = modes;

	const sel = serviceArguments.sel ?? 0;
	const mode = serviceArguments.mode ?? 0;

	const selValue = sel_list.find(item => item.id === sel)?.name || '';
	const modeValue = mode_list.find(item => item.id === mode)?.name || '';

	const blockValue = serviceArguments.block ?? 0;
	const timeoutValue = serviceArguments.probeTimeout ?? 1800;
	const inactiveTimeOutValue = serviceArguments.inactiveTimeOut ?? 0;

	// Absent on non-fullproxy rules; the fields then render as "None".
	const mtls = serviceArguments.mtls_frontend ?? {};

	// Fullproxy read-backs. A gateway that does not report one gets no row,
	// rather than an "Off" this UI would be making up.
	const halfClose = mode === 4 ? halfCloseReadBack(serviceArguments.half_close_effective) : undefined;
	const sockMap = mode === 4 ? sockMapReadBack(serviceArguments.sockMapMode) : undefined;

	return (
		<Stack spacing={2}>
			<ValueBunch name={t('Service Identity')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Name')} value={serviceArguments.name} />
					<SingleTextBox label={t('External IP')} value={serviceArguments.externalIP} />
					<SingleTextBox label={t('Private IP')} value={serviceArguments.privateIP} />
					<SingleTextBox label={t('Port')} value={serviceArguments.port} />
					<SingleTextBox label={t('Port Max')} value={serviceArguments.portMax} />
					<SingleTextBox label={t('Protocol')} value={serviceArguments.protocol} />
					<SingleTextBox label={t('BGP')} value={serviceArguments.bgp ?? false} tooltip='Flag to enable BGP'/>
					<SingleTextBox label={t('SEL')} value={selValue} tooltip='Value for load balance algorithim(0-rr, 1-hash, 2-priority, 3-persist, 4-lc, 5-n2, 6-n3, 8-chwbl, 0-default)'/>
					<SingleTextBox label={t('Mode')} value={modeValue} tooltip="Value for NAT mode (0-DNAT, 1-onearm, 2-fullnat, 3-dsr, 4-fullproxy, 5-hostonearm, 0-default)"/>
					<SingleTextBox label={t('Block')} value={blockValue} tooltip='Value for Firewall block (0-disabled, Other-Firewall number)' />
					<SingleTextBox label={t('SNAT')} value={serviceArguments.snat ?? false} tooltip='Flag to enable SNAT' />
					<SingleTextBox label={t('Egress')} value={serviceArguments.egress} tooltip='Flag to indicate an egress rule'/>
					<SingleTextBox label={t('Operation')} value={serviceArguments.oper} tooltip='End-point specific op (0-create, 1-attachEP, 2-detachEP)'/>
					<SingleTextBox label={t('Inactive Timeout')} value={inactiveTimeOutValue} tooltip='Value for inactive timeout seconds' />
				</Grid2>
			</ValueBunch>

			<ValueBunch name={t('Probe Information')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Type')} value={serviceArguments.probetype} />
					<SingleTextBox label={t('Port')} value={serviceArguments.probeport} />
					<SingleTextBox label={t('Request')} value={serviceArguments.probereq} />
					<SingleTextBox label={t('Response')} value={serviceArguments.proberesp} />
					<SingleTextBox label={t('Timeout')} value={timeoutValue} />
					<SingleTextBox label={t('Retries')} value={serviceArguments.probeRetries} />
					<SingleTextBox label={t('Monitoring')} value={serviceArguments.monitor ?? false} />
				</Grid2>
			</ValueBunch>
			<ValueBunch name={t('L7 Proxy Information')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Host')} value={serviceArguments.host} tooltip='Ingress specific host URL path'/>
					<SingleTextBox label={t('Path Prefix')} value={serviceArguments.path_prefix} tooltip='URL path prefix for L7 routing (e.g., /v1/users)'/>
					<SingleTextBox label={t('Path Match Mode')} value={serviceArguments.path_match_mode} tooltip="Path matching mode ('disabled', 'prefix', or 'exact')"/>
					<SingleTextBox label={t('Security')} value={serviceArguments.security} tooltip='Value for Security mode (0-Plain, 1-https/tls, 2-e2ehttps, 0-default) in fullproxy mode'/>
					<SingleTextBox label={t('Backend Protocol')} value={serviceArguments.backend_protocol} tooltip="Backend protocol capability for ALPN negotiation ('http1', 'http2', or 'both')"/>
					<SingleTextBox label={t('Proxy Protocol v2')} value={serviceArguments.proxyprotocolv2} tooltip='Flag to enable proxy protocol v2' />
					{/* Fullproxy only, and a read-back: absent means off (see resolveCircuitBreaker). */}
					{mode === 4 && <SingleTextBox label={t('Circuit Breaker')} value={resolveCircuitBreaker(serviceArguments, true) ? t('Enabled') : t('Disabled')} tooltip={t('Per-endpoint circuit breaker as resolved by the gateway.')} />}
					{halfClose !== undefined && (
						<SingleTextBox
							label={t('Half-Close')}
							value={halfClose}
							width={serviceArguments.half_close_effective?.not_applied ? 'wide' : 'normal'}
							tooltip={t('What the gateway does with a client that shuts down its write side after sending its request: hold keeps it open until the answer is out, off closes it at once. This is the mode in force and where it came from.')}
						/>
					)}
					{sockMap !== undefined && (
						<SingleTextBox
							label={t('Sockmap Mode')}
							value={sockMap}
							tooltip={t('The sockmap acceleration this rule declares. A declared mode is not proof that traffic is accelerated: the gateway must also be started with sockmap support.')}
						/>
					)}
					{/* Frontend mTLS is TLS configuration, not AI routing, so it belongs
					    with the L7 proxy settings rather than in the AI Gateway tab. */}
					<SingleTextBox label={t('Client Cert Mode')} value={mtls.client_cert_mode} tooltip="Client-certificate verification ('disabled', 'optional', or 'required'); fullproxy + TLS only" />
					{/* Filesystem paths and CN patterns run long — the wide column keeps
					    them on one line. */}
					<SingleTextBox label={t('Client CA Path')} value={mtls.client_ca_path} width="wide" tooltip='Path to the client CA bundle (PEM) on the gateway' />
					<SingleTextBox label={t('Client CA Data')} value={mtls.client_ca_cert_data ? t('Provided') : undefined} tooltip='Inline base64 PEM client CA bundle (alternative to the path)' />
					<SingleTextBox label={t('Require Client CN')} value={mtls.require_client_cn} tooltip='Additionally require the client certificate CN to match a pattern' />
					<SingleTextBox label={t('Client CN Pattern')} value={mtls.client_cn_pattern} width="wide" tooltip='CN pattern to match, wildcard supported (used with Require Client CN)' />
					<SingleTextBox label={t('Client CRL Path')} value={mtls.client_crl_path} width="wide" tooltip='Optional static CRL (PEM) for leaf-certificate revocation' />
				</Grid2>
			</ValueBunch>
			<ValueBunch name={t('Kubernetes Information')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Managed')} value={serviceArguments.managed ?? false} tooltip='Kubernetes Load Balancer externally managed rule or not' />					
				</Grid2>
			</ValueBunch>
		</Stack>
	);
}
