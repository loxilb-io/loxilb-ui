//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import AccordionBox from 'components/element/AccordionBox';
import ParamBox from 'components/element/ParamBox';
import DropDownSelectBox from 'components/element/DropDownSelectBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {t} from 'i18next';
import React, {Fragment, useCallback} from 'react';
import {IServiceArguments} from 'types/load_balancer';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function BasicSettingsForm(props: {value: IServiceArguments; onChange: (val: Partial<IServiceArguments>) => void; params?: any; isEdit?: boolean}) {
	const {value, onChange, params, isEdit = false} = props;

	const handleChange = useCallback((field: keyof IServiceArguments) => (newValue: any) => onChange({...value, [field]: newValue}), [value, onChange]);

	// Note: protocol defaults to 'tcp' upstream (LBInputForm formData init) and in
	// the dropdown's display value, so no setState-in-effect is needed here — that
	// pattern (with an onChange identity that changed every render) drove F14's
	// "Maximum update depth exceeded" render loop.

	// Validate port range
	const portRangeError = React.useMemo(() => {
		const portMin = value?.port;
		const portMax = value?.portMax;
		
		// Only validate if both ports are valid numbers
		if (portMin !== undefined && portMin !== null && portMax !== undefined && portMax !== null &&
			portMin > 0 && portMin <= 65535 && portMax > 0 && portMax <= 65535) {
			if (portMin > portMax) {
				return t('Port Min must be less than or equal to Port Max');
			}
		}
		return null;
	}, [value?.port, value?.portMax]);

	return (
		<Fragment>
	   <ParamBox label={t('Rule Name')} value={value?.name ?? ''} onChange={handleChange('name')} param_desc={params?.name} disabled={isEdit}/>

	   <AccordionBox title={t('Basic Settings(*)')}>
			   <Stack spacing={2}>
					   <HorizontalStack>
							   <DropDownSelectBox 
									label={t('Protocol')} 
									value={value?.protocol ?? 'tcp'} 
									onChange={handleChange('protocol')} 
									item_list={[
										{id: 1, name: 'TCP', send_value: 'tcp'},
										{id: 2, name: 'UDP', send_value: 'udp'},
										{id: 3, name: 'SCTP', send_value: 'sctp'}
									]}
									disabled={isEdit}
							   />
							   {/* <ParamBox label={t('Host')} value={value?.host ?? ''} onChange={handleChange('host')} param_desc={params?.host} /> */}
					   </HorizontalStack>

					   <HorizontalStack>
							   <ParamBox label={t('External IP')} value={value?.externalIP ?? ''} onChange={handleChange('externalIP')} param_desc={{...params?.externalIP, type: isEdit ? 'string' : 'ipaddress'}} disabled={isEdit} />
							   {/* <ParamBox label={t('Private IP')} value={value?.privateIP ?? ''} onChange={handleChange('privateIP')} param_desc={{...params?.privateIP, type: 'ipaddress'}} /> */}
					   </HorizontalStack>

					   <HorizontalStack>
						   <ParamBox label={t('Port Min')} value={value?.port?.toString() ?? ''} onChange={handleChange('port')} param_desc={{...params?.port, type: isEdit ? 'string' : 'port'}} disabled={isEdit} error={!!portRangeError} helperText={portRangeError || undefined} />
						   <ParamBox label={t('Port Max')} value={value?.portMax?.toString() ?? ''} onChange={handleChange('portMax')} param_desc={{...params?.portMax, type: isEdit ? 'string' : 'port'}} disabled={isEdit} error={!!portRangeError} helperText={portRangeError || undefined} />
					   </HorizontalStack>
			   </Stack>
	   </AccordionBox>
		</Fragment>
	);
}
