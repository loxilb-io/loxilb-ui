//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, Typography} from '@mui/material';
import protocolList from 'assets/json/protocols.json';
import ParamBox from 'components/element/ParamBox';
import UnsignedIntegerField from '../UnsignedIntegerField';
import HorizontalStack from 'components/layout/HorizontalStack';
import {t} from 'i18next';
import {useCallback} from 'react';
import {IRuleArguments} from 'types/firewall';
import {IEnumItem} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
// Shared with FirewallInputForm: omitted bounds are zero on the wire.
// A minimum above that maximum must block submission.
export function getPortRangeError(min: number | undefined | null, max: number | undefined | null): string | undefined {
	return Number(min ?? 0) > Number(max ?? 0) ? 'Min port must not exceed max port' : undefined;
}

export default function FirewallRuleArgsForm(props: {value: IRuleArguments; onChange: (data: Partial<IRuleArguments>) => void; params?: any}) {
	const {value, onChange, params} = props;

	const protocol_list: IEnumItem[] = protocolList;

	const srcRangeError = getPortRangeError(value?.minSourcePort, value?.maxSourcePort);
	const dstRangeError = getPortRangeError(value?.minDestinationPort, value?.maxDestinationPort);

	const handleChange = useCallback((field: keyof IRuleArguments) => (newValue: any) => onChange({[field]: newValue}), [onChange]);

	return (
		<Stack spacing={2}>
			<Typography variant="subtitle1" color="textSecondary">
				{t('Firewall Rule Arguments')}
			</Typography>

			<HorizontalStack>
			   <ParamBox label={t('Source IP')} value={value?.sourceIP ?? ''} onChange={handleChange('sourceIP')} param_desc={{...params?.sourceIP, type: 'ipaddress_cidr'}} />

				<HorizontalStack>
				   <UnsignedIntegerField label={t('Port Min')} value={value?.minSourcePort} onChange={handleChange('minSourcePort')} params={params?.minSourcePort} max={65535} rangeError={srcRangeError ? t(srcRangeError) : undefined} />
				   <UnsignedIntegerField label={t('Port Max')} value={value?.maxSourcePort} onChange={handleChange('maxSourcePort')} params={params?.maxSourcePort} max={65535} rangeError={srcRangeError ? t(srcRangeError) : undefined} />
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
				   <UnsignedIntegerField label={t('Port Min')} value={value?.minDestinationPort} onChange={handleChange('minDestinationPort')} params={params?.minDestinationPort} max={65535} rangeError={dstRangeError ? t(dstRangeError) : undefined} />
				   <UnsignedIntegerField label={t('Port Max')} value={value?.maxDestinationPort} onChange={handleChange('maxDestinationPort')} params={params?.maxDestinationPort} max={65535} rangeError={dstRangeError ? t(dstRangeError) : undefined} />
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
			   <UnsignedIntegerField label={t('Preference')} value={value?.preference} onChange={handleChange('preference')} params={params?.preference} max={65535} />
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
