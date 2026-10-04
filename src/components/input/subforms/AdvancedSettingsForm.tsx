import {Stack} from '@mui/material';
import modes from 'assets/json/modes.json';
import opers from 'assets/json/opers.json';
import securities from 'assets/json/securities.json';
import sels from 'assets/json/sels.json';
import path_match_modes from 'assets/json/path_match_modes.json';
import backend_protocols from 'assets/json/backend_protocols.json';
import AccordionBox from 'components/element/AccordionBox';
import ParamBox from 'components/element/ParamBox';
import {useInstanceCapabilities} from 'hooks/query/flavorHook';
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

	// Flavor gating: enum options loxilb hard-rejects (422) disappear, and
	// write-field groups it silently drops (L7 routing, frontend mTLS) hide
	// entirely — an operator must not configure what the backend won't honor.
	const caps = useInstanceCapabilities();
	const SA = 'LoadbalanceEntry.serviceArguments';
	const allowedSel = caps.allowedEnum(`${SA}.sel`, sels.map(s => s.send_value));
	const sel_list: IEnumItem[] = sels.filter(s => allowedSel.includes(s.send_value));
	const allowedSecurity = caps.allowedEnum(`${SA}.security`, securities.map(s => s.send_value));
	const security_list: IEnumItem[] = securities.filter(s => allowedSecurity.includes(s.send_value));
	const hasL7 = caps.hasField(SA, 'path_prefix');
	const hasMtls = caps.hasField(SA, 'mtls_frontend');
	const oper_list: IEnumItem[] = opers;
	const mode_list: IEnumItem[] = modes;
	const path_match_mode_list: IEnumItem[] = path_match_modes;
	const backend_protocol_list: IEnumItem[] = backend_protocols;

	// Delta update — see LBInputForm.handleServiceArguments for why a full
	// {...value, field} spread here corrupts sibling sub-forms' fields.
	const handleChange = useCallback(
		(field: keyof IServiceArguments) => (newValue: any) => {
			onChange({[field]: newValue});
		},
		[onChange],
	);

	// mtls_frontend is a nested object — merge one sub-field at a time onto the
	// prior mtls_frontend so sibling mTLS fields survive, then emit it as a delta
	// on serviceArguments (same delta contract as handleChange).
	const handleMtls = useCallback(
		(field: keyof NonNullable<IServiceArguments['mtls_frontend']>) => (newValue: any) => {
			onChange({mtls_frontend: {...(value?.mtls_frontend ?? {}), [field]: newValue}});
		},
		[onChange, value?.mtls_frontend],
	);

	// Frontend mTLS applies only to a TLS-terminating fullproxy rule
	// (mode=fullproxy + security != Plain) — mirrors the gateway constraint.
	const mtlsEnabled = value?.mode === 4 && !!value?.security;
	const clientCertModeList: IEnumItem[] = [
		{id: 0, name: 'disabled', send_value: 'disabled'},
		{id: 1, name: 'optional', send_value: 'optional'},
		{id: 2, name: 'required', send_value: 'required'},
	];

	return (
	   <AccordionBox title={t('Advanced Settings (LB Algo, NAT modes, etc)')} tooltip={"Configure advanced settings for the load balancer, including algorithms and NAT modes."}>
			   <Stack spacing={2}>
					   <HorizontalStack>
							   <ParamBox label={t('SEL')} value={value?.sel ?? ''} onChange={handleChange('sel')} param_desc={{...params?.sel, enum: sel_list, description: t('Select a load-balancing algorithm (options reflect what this instance supports).')}} />
							   <ParamBox label={t('Oper')} value={value?.oper ?? ''} onChange={handleChange('oper')} param_desc={{...params?.oper, enum: oper_list}} />
					   </HorizontalStack>

					   <HorizontalStack>
							   <ParamBox label={t('Mode')} value={value?.mode ?? ''} onChange={handleChange('mode')} param_desc={{...params?.mode, enum: mode_list, description: t('Select a NAT mode.(0-dnat, 1-onearm, 2-fullnat, 3-dsr, 4-fullproxy, 5-hostonearm)')}} />
							   <ParamBox label={t('Inactive Timeout')} value={value?.inactiveTimeOut ?? 0} onChange={handleChange('inactiveTimeOut')} param_desc={params?.inactiveTimeOut} />
					   </HorizontalStack>

						<HorizontalStack>
							<ParamBox label={t('Security')} value={value?.security ?? ''} onChange={handleChange('security')} param_desc={{...params?.security, enum: security_list, description: t('TLS termination mode — only applies to fullproxy (Plain, https, e2ehttps).')}} disabled={value?.mode !== 4} />
							<ParamBox label={t('Block')} value={value?.block ?? ''} onChange={handleChange('block')} param_desc={{...params?.block, type: 'integer', description: t('Firewall mark (fwmark) stamped on matched traffic; 0 = none.')}} />
						</HorizontalStack>
						<HorizontalStack>
							<ParamBox label={t('Enable Monitor')} value={value.monitor} onChange={handleChange('monitor')} param_desc={params?.monitor} />
							<ParamBox label={t('BGP')} value={value?.bgp ?? ''} onChange={handleChange('bgp')} param_desc={params?.bgp} />
						</HorizontalStack>
						<HorizontalStack>
							<ParamBox label={t('SNAT')} value={value?.snat} onChange={handleChange('snat')} param_desc={{...params?.snat, type: 'boolean', description: t('Source-NAT client traffic to the LB address.')}} />
							<ParamBox label={t('Egress')} value={value?.egress} onChange={handleChange('egress')} param_desc={{...params?.egress, type: 'boolean', description: t('Treat this as an egress (outbound) load-balancer rule.')}} />
						</HorizontalStack>
						<HorizontalStack>
							<ParamBox label={t('Proxy Protocol v2')} value={value?.proxyprotocolv2} onChange={handleChange('proxyprotocolv2')} param_desc={{...params?.proxyprotocolv2, type: 'boolean', description: t('Prepend a PROXY protocol v2 header to backend connections.')}} />
							<ParamBox label={t('Private IP')} value={value?.privateIP ?? ''} onChange={handleChange('privateIP')} param_desc={{...params?.privateIP, type: 'ipaddress', description: t('Private (NAT-translated) address the VIP maps to.')}} />
						</HorizontalStack>

					   {/* L7 Routing Configuration (Host is shared; the rest is gateway-only) */}
					   <HorizontalStack>
							<ParamBox label={t('Host')} value={value?.host ?? ''} onChange={handleChange('host')} param_desc={params?.host} disabled={value?.mode !== 4} />
							{hasL7 && <ParamBox
								label={t('Path Match Mode')}
								value={value?.path_match_mode ?? ''}
								onChange={handleChange('path_match_mode')}
								param_desc={{...params?.path_match_mode, enum: path_match_mode_list, description: t('Path matching mode (disabled: hostname-only, prefix: longest prefix match, exact: exact path match)')}}
								disabled={value?.mode !== 4}
							/>}
					   </HorizontalStack>
					   {hasL7 && <HorizontalStack>
							<ParamBox
								label={t('Path Prefix')}
								value={value?.path_prefix ?? ''}
								onChange={handleChange('path_prefix')}
								param_desc={{...params?.path_prefix, description: t('URL path prefix for L7 routing (e.g., /v1/users)')}}
								disabled={value?.mode !== 4}
							/>
					   </HorizontalStack>}

					   {/* Backend Protocol & LLM Configuration */}
					   {hasL7 && <HorizontalStack>
							   <ParamBox
								   label={t('Backend Protocol')}
								   value={value?.backend_protocol ?? ''}
								   onChange={handleChange('backend_protocol')}
								   param_desc={{...params?.backend_protocol, enum: backend_protocol_list, description: t('Backend protocol for ALPN negotiation (http1: HTTP/1.1 only, http2: HTTP/2 only, both: supports both)')}}
								   disabled={value?.mode !== 4}
							   />
					   </HorizontalStack>}

					   {/* Frontend mTLS — client-certificate verification (fullproxy + TLS only) */}
					   {hasMtls && <><HorizontalStack>
							<ParamBox
								label={t('Client Cert Mode')}
								value={value?.mtls_frontend?.client_cert_mode ?? ''}
								onChange={handleMtls('client_cert_mode')}
								param_desc={{type: 'string', enum: clientCertModeList, description: t('Frontend mTLS client-certificate requirement (disabled, optional, required). Requires fullproxy + a TLS security.')}}
								disabled={!mtlsEnabled}
							/>
							<ParamBox
								label={t('Client CA Path')}
								value={value?.mtls_frontend?.client_ca_path ?? ''}
								onChange={handleMtls('client_ca_path')}
								param_desc={{type: 'string', description: t('Path to the client CA bundle (PEM) on the gateway used to verify client certificates.')}}
								disabled={!mtlsEnabled}
							/>
					   </HorizontalStack>
					   <HorizontalStack>
							<ParamBox
								label={t('Require Client CN')}
								value={value?.mtls_frontend?.require_client_cn}
								onChange={handleMtls('require_client_cn')}
								param_desc={{type: 'boolean', description: t('Additionally require the client certificate CN to match a pattern.')}}
								disabled={!mtlsEnabled}
							/>
							<ParamBox
								label={t('Client CN Pattern')}
								value={value?.mtls_frontend?.client_cn_pattern ?? ''}
								onChange={handleMtls('client_cn_pattern')}
								param_desc={{type: 'string', description: t('Required client CN pattern, wildcards supported (e.g. *.internal.corp.com). Used only when Require Client CN is on.')}}
								disabled={!mtlsEnabled || !value?.mtls_frontend?.require_client_cn}
							/>
					   </HorizontalStack></>}
			   </Stack>
	   </AccordionBox>
	);
}
