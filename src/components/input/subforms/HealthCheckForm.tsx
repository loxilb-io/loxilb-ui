//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
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

	const isProbePortEnabled: boolean = value.probetype !== '' && value.probetype !== 'ping' ;
	const isProbeTimeoutRetriesEnabled: boolean = value.probetype !== '' && value.probetype !== 'ping' ;
	const isProbeReqRespEnabled = () => ['udp', 'http', 'https'].includes(value.probetype || '') && value.probetype !== '';

	return (
		<AccordionBox title={t('Health Check')} tooltip={"If monitor is enabled, don't need to configure this. Configure health check settings manually for the load balancer to monitor the status of its endpoints."}>
			<Stack spacing={2}>
				<HorizontalStack>
					<DropDownSelectBox 
						label={t('Probe Type')} 
						value={value.probetype} 
						onChange={handleChange('probetype')} 
						item_list={[
							{id: 1, name: 'NONE', send_value: ''},
							{id: 2, name: 'PING', send_value: 'ping'},
							{id: 3, name: 'TCP', send_value: 'tcp'},
							{id: 4, name: 'UDP', send_value: 'udp'},
							{id: 5, name: 'HTTP', send_value: 'http'},
							{id: 6, name: 'HTTPS', send_value: 'https'}
						]}
						disabled={false}
					/>
					<ParamBox
						label={t('Probe Port')}
						value={value.probeport}
						onChange={handleChange('probeport')}
						param_desc={{...params.probeport, type: 'port'}}
						disabled={!isProbePortEnabled}
					/>
				</HorizontalStack>

				<HorizontalStack>
					<ParamBox
						label={t('Probe Request')}
						value={value?.probereq ?? ''}
						onChange={handleChange('probereq')}
						param_desc={params?.probereq}
						disabled={!isProbeReqRespEnabled()}
					/>
				<ParamBox
					label={t('Probe Response')}
					value={value?.proberesp ?? ''}
					onChange={handleChange('proberesp')}
					param_desc={params?.proberesp}
					disabled={!isProbeReqRespEnabled()}
				/>
				</HorizontalStack>

				<HorizontalStack>
				<ParamBox
					label={t('Probe Timeout')}
					value={value?.probeTimeout ?? ''}
					onChange={handleChange('probeTimeout')}
					param_desc={params?.probeTimeout}
					disabled={!isProbeTimeoutRetriesEnabled}
				/>
				<ParamBox
					label={t('Probe Retries')}
					value={value?.probeRetries ?? ''}
					onChange={handleChange('probeRetries')}
					param_desc={params?.probeRetries}
					disabled={!isProbeTimeoutRetriesEnabled}
				/>
				</HorizontalStack>
			</Stack>
		</AccordionBox>
	);
}
