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
export default function FirewallRuleArgsForm(props: {value: IRuleArguments; onChange: (data: IRuleArguments) => void; params?: any}) {
	const {value, onChange, params} = props;

	const protocol_list: IEnumItem[] = protocolList;

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
				   <ParamBox label={t('Port Max')} value={value?.maxSourcePort ?? ''} onChange={handleChange('maxSourcePort')} param_desc={{...params?.maxSourcePort, type: 'port'}} />
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
			</HorizontalStack>
		</Stack>
	);
}
