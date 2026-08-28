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
import {useInstanceCapabilities} from 'hooks/query/flavorHook';
import {t} from 'i18next';
import {useCallback, useState, useEffect} from 'react';
import {resolveAIEngine} from 'types/ai_gateway';
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
		// Add empty endpoint to local state without calling onChange.
		// ep_role/nixl_port get concrete defaults (0 = normal / use target
		// port): with P/D mode on the EP Role dropdown would otherwise
		// auto-announce its default, and that announce path filters the
		// still-empty row out of the parent — which syncs back and deletes
		// the row the user just added.
		setLocalEndpoints([...localEndpoints, {endpointIP: '', weight: 1, targetPort: 0, state: '', counter: '', ep_role: 0, nixl_port: 0}]);
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

	// Delta update — see LBInputForm.handleServiceArguments for why a full
	// {...serviceArguments, field} spread here corrupts sibling fields.
	const handleServiceArgChange = useCallback(
		(field: keyof IServiceArguments) => (newValue: any) => {
			if (onServiceArgumentsChange) {
				onServiceArgumentsChange({[field]: newValue} as IServiceArguments);
			}
		},
		[onServiceArgumentsChange],
	);

	const isProbePortEnabled: boolean = serviceArguments?.probetype !== '' && serviceArguments?.probetype !== 'ping';
	const isProbeTimeoutRetriesEnabled: boolean = serviceArguments?.probetype !== '' && serviceArguments?.probetype !== 'ping';
	const isProbeReqRespEnabled = () => ['udp', 'http', 'https'].includes(serviceArguments?.probetype || '');

	// Flavor gating, hardcoded on purpose: upstream loxilb's LB-level probe
	// accepts only connect probes — rules.go rejects http/https with
	// "malformed-service-ptype" — while its swagger over-declares them, so
	// neither the capability map nor /meta can derive this. (Endpoint-object
	// probes DO support http/https upstream; this gate is LB-form only.)
	const caps = useInstanceCapabilities();
	const probe_type_list: IEnumItem[] = [
		{id: 1, name: 'None', send_value: ''},
		{id: 2, name: 'PING', send_value: 'ping'},
		{id: 3, name: 'TCP', send_value: 'tcp'},
		{id: 4, name: 'UDP', send_value: 'udp'},
		{id: 5, name: 'HTTP', send_value: 'http'},
		{id: 6, name: 'HTTPS', send_value: 'https'},
	].filter(item => caps.flavor !== 'loxilb' || !['http', 'https'].includes(String(item.send_value)));

	const ep_role_list: IEnumItem[] = ep_roles;
	const aiEngine = resolveAIEngine(serviceArguments?.kvEngineType);

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
								item_list={probe_type_list}
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
									{/* Keep stale role/NIXL values visible after a topology switch so the
									    operator can clear them; hidden stale values must never leak. */}
									{(serviceArguments?.pd_disagg_mode || !!item.ep_role || !!item.nixl_port) && (
										<HorizontalStack>
											<ParamBox
												label={t('EP Role')}
												value={item.ep_role ?? ''}
												onChange={val => handleChange(index, 'ep_role', val)}
												param_desc={{type: 'integer', enum: ep_role_list, description: t('Prefill/decode role: 0 normal, 1 prefill, 2 decode.')}}
											/>
											{((serviceArguments?.pd_disagg_mode && aiEngine === 'vllm') || !!item.nixl_port) && (
												<ParamBox
													label={t('NIXL Port')}
													value={item.nixl_port ?? 0}
													onChange={val => handleChange(index, 'nixl_port', val)}
													param_desc={{type: 'integer', format: 'int32', description: t('vLLM NIXL side-channel port for KV transfer. 0 uses the endpoint target port.')}}
												/>
											)}
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
