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

	const sel = serviceArguments.sel ?? -1;
	const mode = serviceArguments.mode ?? -1;

	const selValue = sel_list.find(item => item.id === sel)?.name || '';
	const modeValue = mode_list.find(item => item.id === mode)?.name || '';

	const blockValue = serviceArguments.block ?? 0;
	const timeoutValue = serviceArguments.probeTimeout ?? 1800;

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
					<SingleTextBox label={t('BGP')} value={serviceArguments.bgp} />
					<SingleTextBox label={t('SEL')} value={selValue} />
					<SingleTextBox label={t('Mode')} value={modeValue} />
					<SingleTextBox label={t('Block')} value={blockValue} />
					<SingleTextBox label={t('SNAT')} value={serviceArguments.snat} />
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
					<SingleTextBox label={t('Monitoring')} value={serviceArguments.monitor} />
				</Grid2>
			</ValueBunch>

			<ValueBunch name={t('Kubernetes Information')}>
				<Grid2 container spacing={2}>
					<SingleTextBox label={t('Managed')} value={serviceArguments.managed} />
					<SingleTextBox label={t('Security')} value={serviceArguments.security} />
					<SingleTextBox label={t('Host')} value={serviceArguments.host} />
					<SingleTextBox label={t('Proxy Protocol v2')} value={serviceArguments.proxyprotocolv2} />
					<SingleTextBox label={t('Egress')} value={serviceArguments.egress} />
					<SingleTextBox label={t('Operation')} value={serviceArguments.oper} />
				</Grid2>
			</ValueBunch>
		</Stack>
	);
}
