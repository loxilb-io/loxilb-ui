//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack} from '@mui/material';
import AccordionBox from 'components/element/AccordionBox';
import ParamBox from 'components/element/ParamBox';
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
					<ParamBox label={t('Probe Type')} value={value.probetype} onChange={handleChange('probetype')} param_desc={{...params?.probetype}} />
					<ParamBox
						label={t('Probe Port')}
						value={value.probeport}
						onChange={handleChange('probeport')}
						param_desc={{...params?.probeport, type: 'port'}}
						disabled={!isProbePortEnabled}
					/>
				</HorizontalStack>

				<HorizontalStack>
					<ParamBox
						label={t('Probe Request')}
						value={value.probereq}
						onChange={handleChange('probereq')}
						param_desc={params?.probereq}
						disabled={!isProbeReqRespEnabled}
					/>
				   <ParamBox
					   label={t('Probe Response')}
					   value={value?.proberesp ?? ''}
					   onChange={handleChange('proberesp')}
					   param_desc={params?.proberesp}
					   disabled={!isProbeReqRespEnabled}
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
