//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack} from '@mui/material';
import AccordionBox from 'components/element/AccordionBox';
import ParamBox from 'components/element/ParamBox';
import DropDownSelectBox from 'components/element/DropDownSelectBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {t} from 'i18next';
import {useCallback} from 'react';
import {IServiceArguments} from 'types/load_balancer';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function HealthCheckForm(props: {value: IServiceArguments; onChange: any; params?: any}) {
	const {value, onChange, params} = props;

	const handleChange = useCallback((field: keyof IServiceArguments) => (newValue: any) => onChange({...value, [field]: newValue}), [value, onChange]);

	const isProbePortEnabled: boolean = value.probetype !== 'none' && value.probetype !== 'ping' && value.probetype !== 'none';
	const isProbeTimeoutRetriesEnabled: boolean = value.probetype !== 'none' && value.probetype !== 'ping' && value.probetype !== 'none';
	const isProbeReqRespEnabled = () => ['udp', 'http', 'https'].includes(value.probetype || '') && value.probetype !== 'none';

	return (
		<AccordionBox title={t('Health Check')}>
			<Stack spacing={2}>
				<HorizontalStack>
					<ParamBox label={t('Enable Monitor')} value={value.monitor} onChange={handleChange('monitor')} param_desc={params?.monitor} />
					<Box width="100%" id="empty-spacer" />
				</HorizontalStack>

				<HorizontalStack>
					<DropDownSelectBox 
						label={t('Probe Type')} 
						value={value.probetype} 
						onChange={handleChange('probetype')} 
						item_list={[
							{id: 1, name: 'PING', send_value: 'ping'},
							{id: 2, name: 'TCP', send_value: 'tcp'},
							{id: 3, name: 'UDP', send_value: 'udp'},
							{id: 4, name: 'HTTP', send_value: 'http'},
							{id: 5, name: 'HTTPS', send_value: 'https'}
						]}
						disabled={!value.monitor}
					/>
					<ParamBox
						label={t('Probe Port')}
						value={value.probeport}
						onChange={handleChange('probeport')}
						param_desc={{...params?.probeport, type: 'port'}}
						disabled={!value.monitor || !isProbePortEnabled}
					/>
				</HorizontalStack>

				<HorizontalStack>
					<ParamBox
						label={t('Probe Request')}
						value={value.probereq}
						onChange={handleChange('probereq')}
						param_desc={params?.probereq}
						disabled={!value.monitor || !isProbeReqRespEnabled()}
					/>
				   <ParamBox
					   label={t('Probe Response')}
					   value={value?.proberesp ?? ''}
					   onChange={handleChange('proberesp')}
					   param_desc={params?.proberesp}
					   disabled={!value.monitor || !isProbeReqRespEnabled()}
				   />
				</HorizontalStack>

				<HorizontalStack>
				   <ParamBox
					   label={t('Probe Timeout')}
					   value={value?.probeTimeout ?? ''}
					   onChange={handleChange('probeTimeout')}
					   param_desc={params?.probeTimeout}
					   disabled={!value.monitor || !isProbeTimeoutRetriesEnabled}
				   />
				   <ParamBox
					   label={t('Probe Retries')}
					   value={value?.probeRetries ?? ''}
					   onChange={handleChange('probeRetries')}
					   param_desc={params?.probeRetries}
					   disabled={!value.monitor || !isProbeTimeoutRetriesEnabled}
				   />
				</HorizontalStack>
			</Stack>
		</AccordionBox>
	);
}
