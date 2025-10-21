//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Add} from '@mui/icons-material';
import {Box, Button, Stack} from '@mui/material';
import AccordionBox from 'components/element/AccordionBox';
import ParamBox from 'components/element/ParamBox';
import DropDownSelectBox from 'components/element/DropDownSelectBox';
import SimpleButton from 'components/element/SimpleButton';
import HorizontalStack from 'components/layout/HorizontalStack';
import {t} from 'i18next';
import {useCallback} from 'react';
import {IEndpoint, IServiceArguments} from 'types/load_balancer';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function EndpointListForm(props: {
	values: IEndpoint[]; 
	onChange: (values: IEndpoint[]) => void; 
	params: any;
	serviceArguments?: IServiceArguments;
	onServiceArgumentsChange?: (value: IServiceArguments) => void;
	serviceArgumentsParams?: any;
}) {
	const {values, onChange, params, serviceArguments, onServiceArgumentsChange, serviceArgumentsParams} = props;

	const handleChange = useCallback(
		(index: number, field: keyof IEndpoint, value: string | number) => {
			const updated = [...values];
			updated[index] = {...updated[index], [field]: ['weight', 'targetPort'].includes(field) ? Number(value) : value};
			onChange(updated);
		},
		[values, onChange],
	);

	const handleAdd = useCallback(() => {
		onChange([...values, {endpointIP: '', weight: 1, targetPort: 0, state: '', counter: ''}]);
	}, [values, onChange]);

	const handleDelete = useCallback(
		(index: number) => {
			const updated = values.filter((_, i) => i !== index);
			onChange(updated);
		},
		[values, onChange],
	);

	const handleServiceArgChange = useCallback(
		(field: keyof IServiceArguments) => (newValue: any) => {
			if (onServiceArgumentsChange && serviceArguments) {
				onServiceArgumentsChange({...serviceArguments, [field]: newValue});
			}
		},
		[serviceArguments, onServiceArgumentsChange],
	);

	const isProbePortEnabled: boolean = serviceArguments?.probetype !== '' && serviceArguments?.probetype !== 'ping';
	const isProbeTimeoutRetriesEnabled: boolean = serviceArguments?.probetype !== '' && serviceArguments?.probetype !== 'ping';
	const isProbeReqRespEnabled = () => ['udp', 'http', 'https'].includes(serviceArguments?.probetype || '');

	return (
		<AccordionBox title={t('Endpoints')} tooltip={"Define the list of endpoints (IP addresses) for this Load Balancer"}>
			<Stack spacing={2}>
				{/* Health Check Configuration */}
				{serviceArguments && onServiceArgumentsChange && (
					<Stack spacing={2}>
						<HorizontalStack>
							<DropDownSelectBox 
								label={t('Probe Type')} 
								value={serviceArguments.probetype} 
								onChange={handleServiceArgChange('probetype')} 
								item_list={[
									{id: 1, name: 'None', send_value: ''},
									{id: 2, name: 'PING', send_value: 'ping'},
									{id: 3, name: 'TCP', send_value: 'tcp'},
									{id: 4, name: 'UDP', send_value: 'udp'},
									{id: 5, name: 'HTTP', send_value: 'http'},
									{id: 6, name: 'HTTPS', send_value: 'https'}
								]}
							/>
							<ParamBox
								label={t('Probe Port')}
								value={serviceArguments.probeport}
								onChange={handleServiceArgChange('probeport')}
								param_desc={{...serviceArgumentsParams?.probeport, type: 'port'}}
								disabled={!isProbePortEnabled}
							/>
						</HorizontalStack>

						<HorizontalStack>
							<ParamBox
								label={t('Probe Request')}
								value={serviceArguments?.probereq ?? ''}
								onChange={handleServiceArgChange('probereq')}
								param_desc={serviceArgumentsParams?.probereq}
								disabled={!isProbeReqRespEnabled()}
							/>
							<ParamBox
								label={t('Probe Response')}
								value={serviceArguments?.proberesp ?? ''}
								onChange={handleServiceArgChange('proberesp')}
								param_desc={serviceArgumentsParams?.proberesp}
								disabled={!isProbeReqRespEnabled()}
							/>
						</HorizontalStack>

						<HorizontalStack>
							<ParamBox
								label={t('Probe Timeout')}
								value={serviceArguments?.probeTimeout ?? ''}
								onChange={handleServiceArgChange('probeTimeout')}
								param_desc={serviceArgumentsParams?.probeTimeout}
								disabled={!isProbeTimeoutRetriesEnabled}
							/>
							<ParamBox
								label={t('Probe Retries')}
								value={serviceArguments?.probeRetries ?? ''}
								onChange={handleServiceArgChange('probeRetries')}
								param_desc={serviceArgumentsParams?.probeRetries}
								disabled={!isProbeTimeoutRetriesEnabled}
							/>
						</HorizontalStack>
					</Stack>
				)}

				{/* Endpoint List */}
				<Stack spacing={2}>
					{values.map((item, index) => (
						<Box border={'1px solid #ccc'} borderRadius={2} padding={2} key={index}>
							<Stack spacing={1} direction="row" justifyContent="space-between" alignItems="center">
								<Stack spacing={2}>
									<HorizontalStack>
										<ParamBox
											label={t('IP')}
											value={item.endpointIP}
											onChange={val => handleChange(index, 'endpointIP', val)}
											param_desc={{...params?.endpointIP, type: 'ipaddress'}}
										/>
									</HorizontalStack>
									<HorizontalStack>
										<ParamBox
											label={t('Target Port')}
											value={item.targetPort}
											onChange={val => handleChange(index, 'targetPort', val)}
											param_desc={{...params?.targetPort, type: 'port'}}
										/>
										<ParamBox label={t('Weight')} value={item.weight} onChange={val => handleChange(index, 'weight', val)} param_desc={params?.weight} />
									</HorizontalStack>
								</Stack>

								<SimpleButton type="delete" onClick={() => handleDelete(index)} />
							</Stack>
						</Box>
					))}
				</Stack>

				<Button
					variant="outlined"
					startIcon={<Add />}
					size="small"
					sx={{width: 'fit-content'}}
					onClick={handleAdd}
					disabled={values.length > 0 && !values.at(-1)?.endpointIP?.trim()}
				>
					{t('Add')}
				</Button>
			</Stack>
		</AccordionBox>
	);
}