import {Box, Stack} from '@mui/material';
import modes from 'assets/json/modes.json';
import opers from 'assets/json/opers.json';
import securities from 'assets/json/securities.json';
import sels from 'assets/json/sels.json';
import path_match_modes from 'assets/json/path_match_modes.json';
import backend_protocols from 'assets/json/backend_protocols.json';
import AccordionBox from 'components/element/AccordionBox';
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {t} from 'i18next';
import {useCallback} from 'react';
import {IEnumItem} from 'types/global';
import {IServiceArguments} from 'types/load_balancer';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function AdvancedSettingsForm(props: {value: IServiceArguments; onChange: any; params?: any}) {
	const {value, onChange, params} = props;

	const sel_list: IEnumItem[] = sels;
	const oper_list: IEnumItem[] = opers;
	const mode_list: IEnumItem[] = modes;
	const security_list: IEnumItem[] = securities;
	const path_match_mode_list: IEnumItem[] = path_match_modes;
	const backend_protocol_list: IEnumItem[] = backend_protocols;

	const handleChange = useCallback(
		(field: keyof IServiceArguments) => (newValue: any) => {
			onChange({...value, [field]: newValue});
		},
		[value, onChange],
	);

	return (
	   <AccordionBox title={t('Advanced Settings (LB Algo, NAT modes, etc)')} tooltip={"Configure advanced settings for the load balancer, including algorithms and NAT modes."}>
			   <Stack spacing={2}>
					   <HorizontalStack>
							   <ParamBox label={t('SEL')} value={value?.sel ?? ''} onChange={handleChange('sel')} param_desc={{...params?.sel, enum: sel_list, description: t('Select an SEL algorithm.(0-rr, 1-hash, 2-priority, 3-persist, 4-lc)')}} />
							   <ParamBox label={t('Oper')} value={value?.oper ?? ''} onChange={handleChange('oper')} param_desc={{...params?.oper, enum: oper_list}} />
					   </HorizontalStack>

					   <HorizontalStack>
							   <ParamBox label={t('Mode')} value={value?.mode ?? ''} onChange={handleChange('mode')} param_desc={{...params?.mode, enum: mode_list, description: t('Select a NAT mode.(0-dnat, 1-onearm, 2-fullnat, 3-dsr)')}} />
							   <ParamBox label={t('Inactive Timeout')} value={value?.inactiveTimeOut ?? 0} onChange={handleChange('inactiveTimeOut')} param_desc={params?.inactiveTimeOut} />
					   </HorizontalStack>

					   {/* <HorizontalStack>
								<ParamBox label={t('Security')} value={value?.security ?? ''} onChange={handleChange('security')} param_desc={{...params?.security, enum: security_list}} disabled={value?.mode !== 4} />
								<ParamBox label={t('Block')} value={value?.block ?? ''} onChange={handleChange('block')} param_desc={params?.block} />
						</HorizontalStack> */}
						<HorizontalStack>
							<ParamBox label={t('Enable Monitor')} value={value.monitor} onChange={handleChange('monitor')} param_desc={params?.monitor} />
							<ParamBox label={t('BGP')} value={value?.bgp ?? ''} onChange={handleChange('bgp')} param_desc={params?.bgp} />
						</HorizontalStack>
					   {/* <HorizontalStack>
							   <ParamBox label={t('Host')} value={value?.host ?? ''} onChange={handleChange('host')} param_desc={params?.host} disabled={value?.mode !== 4} />
							   <ParamBox label={t('Private IP')} value={value?.privateIP ?? ''} onChange={handleChange('privateIP')} param_desc={{...params?.privateIP, type: 'ipaddress'}} />
					   </HorizontalStack> */}

					   {/* L7 Routing Configuration */}
					   <HorizontalStack>
							<ParamBox label={t('Host')} value={value?.host ?? ''} onChange={handleChange('host')} param_desc={params?.host} disabled={value?.mode !== 4} />
							<ParamBox
								label={t('Path Match Mode')}
								value={value?.path_match_mode ?? ''}
								onChange={handleChange('path_match_mode')}
								param_desc={{...params?.path_match_mode, enum: path_match_mode_list, description: t('Path matching mode (disabled: hostname-only, prefix: longest prefix match, exact: exact path match)')}}
								disabled={value?.mode !== 4}
							/>
					   </HorizontalStack>
					   <HorizontalStack>
							<ParamBox
								label={t('Path Prefix')}
								value={value?.path_prefix ?? ''}
								onChange={handleChange('path_prefix')}
								param_desc={{...params?.path_prefix, description: t('URL path prefix for L7 routing (e.g., /v1/users)')}}
								disabled={value?.mode !== 4}
							/>
					   </HorizontalStack>

					   {/* Backend Protocol & LLM Configuration */}
					   <HorizontalStack>
							   <ParamBox
								   label={t('Backend Protocol')}
								   value={value?.backend_protocol ?? ''}
								   onChange={handleChange('backend_protocol')}
								   param_desc={{...params?.backend_protocol, enum: backend_protocol_list, description: t('Backend protocol for ALPN negotiation (http1: HTTP/1.1 only, http2: HTTP/2 only, both: supports both)')}}
								   disabled={value?.mode !== 4}
							   />
							   <ParamBox
								   label={t('LLM Type')}
								   value={value?.llm_type ?? ''}
								   onChange={handleChange('llm_type')}
								   param_desc={{...params?.llm_type, description: t('LLM catalog profile for GPU-aware load balancing (e.g., chat-interactive, rag-longcontext, batch-inference)')}}
								   disabled={value?.mode !== 4}
							   />
					   </HorizontalStack>
			   </Stack>
	   </AccordionBox>
	);
}
