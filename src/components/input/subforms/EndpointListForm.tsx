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
import ep_roles from 'assets/json/ep_roles.json';
import {t} from 'i18next';
import {useCallback, useState, useEffect} from 'react';
import {IEnumItem} from 'types/global';
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

	// Local state to manage endpoints including empty ones for UI
	const [localEndpoints, setLocalEndpoints] = useState<IEndpoint[]>(values);

	// Sync local state with props when values change externally
	useEffect(() => {
		setLocalEndpoints(values);
	}, [values]);

	const handleChange = useCallback(
		(index: number, field: keyof IEndpoint, value: string | number) => {
			const updated = [...localEndpoints];
			updated[index] = {...updated[index], [field]: ['weight', 'targetPort', 'ep_role', 'nixl_port'].includes(field) ? Number(value) : value};
			setLocalEndpoints(updated);
			// Filter out endpoints with empty endpointIP before passing to parent
			onChange(updated.filter(ep => ep.endpointIP?.trim() !== ''));
		},
		[localEndpoints, onChange],
	);

	const handleAdd = useCallback(() => {
		// Add empty endpoint to local state without calling onChange
		setLocalEndpoints([...localEndpoints, {endpointIP: '', weight: 1, targetPort: 0, state: '', counter: ''}]);
	}, [localEndpoints]);

	const handleDelete = useCallback(
		(index: number) => {
			const updated = localEndpoints.filter((_, i) => i !== index);
			setLocalEndpoints(updated);
			// Filter out endpoints with empty endpointIP before passing to parent
			onChange(updated.filter(ep => ep.endpointIP?.trim() !== ''));
		},
		[localEndpoints, onChange],
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

	const ep_role_list: IEnumItem[] = ep_roles;

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
								disabled={!isProbePortEnabled && !serviceArguments.monitor}
							/>
						</HorizontalStack>

						<HorizontalStack>
							<ParamBox
								label={t('Probe Request')}
								value={serviceArguments?.probereq ?? ''}
								onChange={handleServiceArgChange('probereq')}
								param_desc={serviceArgumentsParams?.probereq}
								disabled={!isProbeReqRespEnabled() && !serviceArguments.monitor}
							/>
							<ParamBox
								label={t('Probe Response')}
								value={serviceArguments?.proberesp ?? ''}
								onChange={handleServiceArgChange('proberesp')}
								param_desc={serviceArgumentsParams?.proberesp}
								disabled={!isProbeReqRespEnabled() && !serviceArguments.monitor}
							/>
						</HorizontalStack>

						<HorizontalStack>
							<ParamBox
								label={t('Probe Timeout')}
								value={serviceArguments?.probeTimeout ?? ''}
								onChange={handleServiceArgChange('probeTimeout')}
								param_desc={serviceArgumentsParams?.probeTimeout}
								disabled={!isProbeTimeoutRetriesEnabled && !serviceArguments.monitor}
							/>
							<ParamBox
								label={t('Probe Retries')}
								value={serviceArguments?.probeRetries ?? ''}
								onChange={handleServiceArgChange('probeRetries')}
								param_desc={serviceArgumentsParams?.probeRetries}
								disabled={!isProbeTimeoutRetriesEnabled && !serviceArguments.monitor}
							/>
						</HorizontalStack>
					</Stack>
				)}

				{/* Endpoint List */}
				<Stack spacing={2}>
					{localEndpoints.map((item, index) => (
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
									{/* P/D disaggregation endpoint fields — only when pd_disagg_mode is on */}
									{serviceArguments?.pd_disagg_mode && (
										<HorizontalStack>
											<ParamBox
												label={t('EP Role')}
												value={item.ep_role ?? ''}
												onChange={val => handleChange(index, 'ep_role', val)}
												param_desc={{type: 'integer', enum: ep_role_list, description: t('Prefill/decode role: 0 normal, 1 prefill, 2 decode.')}}
											/>
											<ParamBox
												label={t('NIXL Port')}
												value={item.nixl_port ?? ''}
												onChange={val => handleChange(index, 'nixl_port', val)}
												param_desc={{type: 'port', description: t('NIXL side-channel port for KV transfer. 0 = use target port.')}}
											/>
										</HorizontalStack>
									)}
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
					disabled={localEndpoints.length > 0 && !localEndpoints.at(-1)?.endpointIP?.trim()}
				>
					{t('Add')}
				</Button>
			</Stack>
		</AccordionBox>
	);
}