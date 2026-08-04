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
import {IServiceArguments} from 'types/load_balancer';

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
					<SingleTextBox label={t('Security')} value={serviceArguments.security} tooltip='Value for Security mode (0-Plain, 1-https, 2-tls, 3-e2ehttps, 0-default) in fullproxy mode'/>
					<SingleTextBox label={t('Backend Protocol')} value={serviceArguments.backend_protocol} tooltip="Backend protocol capability for ALPN negotiation ('http1', 'http2', or 'both')"/>
					<SingleTextBox label={t('Proxy Protocol v2')} value={serviceArguments.proxyprotocolv2} tooltip='Flag to enable proxy protocol v2' />
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
