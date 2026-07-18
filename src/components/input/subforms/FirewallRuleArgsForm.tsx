//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, Typography} from '@mui/material';
import protocolList from 'assets/json/protocols.json';
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {t} from 'i18next';
import {useCallback} from 'react';
import {IRuleArguments} from 'types/firewall';
import {IEnumItem} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
// Exported so FirewallInputForm can gate submit on the same rule (F4 class:
// a min>max range passes the gateway, so the form must block it).
export function getPortRangeError(min: number | undefined | null, max: number | undefined | null): string | undefined {
	if (min == null || max == null) return undefined;
	return Number(min) > Number(max) ? 'Min port must not exceed max port' : undefined;
}

export default function FirewallRuleArgsForm(props: {value: IRuleArguments; onChange: (data: IRuleArguments) => void; params?: any}) {
	const {value, onChange, params} = props;

	const protocol_list: IEnumItem[] = protocolList;

	const srcRangeError = getPortRangeError(value?.minSourcePort, value?.maxSourcePort);
	const dstRangeError = getPortRangeError(value?.minDestinationPort, value?.maxDestinationPort);

	const handleChange = useCallback((field: keyof IRuleArguments) => (newValue: any) => onChange({...value, [field]: newValue}), [value, onChange]);

	return (
		<Stack spacing={2}>
			<Typography variant="subtitle1" color="textSecondary">
				{t('Firewall Rule Arguments')}
			</Typography>

			<HorizontalStack>
			   <ParamBox label={t('Source IP')} value={value?.sourceIP ?? ''} onChange={handleChange('sourceIP')} param_desc={{...params?.sourceIP, type: 'ipaddress_cidr'}} />

				<HorizontalStack>
				   <ParamBox label={t('Port Min')} value={value?.minSourcePort ?? ''} onChange={handleChange('minSourcePort')} param_desc={{...params?.minSourcePort, type: 'port'}} />
				   <ParamBox
					   label={t('Port Max')}
					   value={value?.maxSourcePort ?? ''}
					   onChange={handleChange('maxSourcePort')}
					   param_desc={{...params?.maxSourcePort, type: 'port'}}
					   error={!!srcRangeError}
					   helperText={srcRangeError && t(srcRangeError)}
				   />
				</HorizontalStack>
			</HorizontalStack>

			<HorizontalStack>
				<ParamBox
					label={t('Destination IP')}
				   value={value?.destinationIP ?? ''}
					onChange={handleChange('destinationIP')}
				param_desc={{...params?.destinationIP, type: 'ipaddress_cidr'}}
				/>

				<HorizontalStack>
				   <ParamBox
					   label={t('Port Min')}
					   value={value?.minDestinationPort ?? ''}
					   onChange={handleChange('minDestinationPort')}
					   param_desc={{...params?.minDestinationPort, type: 'port'}}
				   />
				   <ParamBox
					   label={t('Port Max')}
					   value={value?.maxDestinationPort ?? ''}
					   onChange={handleChange('maxDestinationPort')}
					   param_desc={{...params?.maxDestinationPort, type: 'port'}}
					   error={!!dstRangeError}
					   helperText={dstRangeError && t(dstRangeError)}
				   />
				</HorizontalStack>
			</HorizontalStack>

			<HorizontalStack>
				<ParamBox
					label={t('Protocol')}
				   value={value?.protocol ?? ''}
					onChange={(event: any) => handleChange('protocol')(event.target?.value ?? event)}
					param_desc={{...params?.protocol, enum: protocol_list}}
				/>
			   <ParamBox label={t('Port Name')} value={value?.portName ?? ''} onChange={handleChange('portName')} param_desc={params?.portName} />
			   <ParamBox label={t('Preference')} value={value?.preference ?? ''} onChange={handleChange('preference')} param_desc={params?.preference} />
			   <ParamBox
				   label={t('HW Offload')}
				   value={value?.hwOffload ?? false}
				   onChange={handleChange('hwOffload')}
				   param_desc={{...params?.hwOffload, type: 'boolean', description: 'Offload this rule to hardware when supported'}}
			   />
			</HorizontalStack>
		</Stack>
	);
}
