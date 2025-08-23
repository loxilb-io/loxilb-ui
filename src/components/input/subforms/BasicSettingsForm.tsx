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
export default function BasicSettingsForm(props: {value: IServiceArguments; onChange: (val: Partial<IServiceArguments>) => void; params?: any}) {
	const {value, onChange, params} = props;

	const handleChange = useCallback((field: keyof IServiceArguments) => (newValue: any) => onChange({...value, [field]: newValue}), [value, onChange]);

	// Ensure protocol has a default value when undefined
	React.useEffect(() => {
		if (!value?.protocol) {
			onChange({...value, protocol: 'tcp'});
		}
	}, [value, onChange]);

	return (
		<Fragment>
	   <ParamBox label={t('Rule Name')} value={value?.name ?? ''} onChange={handleChange('name')} param_desc={params?.name} />

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
							   />
							   <ParamBox label={t('Host')} value={value?.host ?? ''} onChange={handleChange('host')} param_desc={params?.host} />
					   </HorizontalStack>

					   <HorizontalStack>
							   <ParamBox label={t('External IP')} value={value?.externalIP ?? ''} onChange={handleChange('externalIP')} param_desc={{...params?.externalIP, type: 'ipaddress'}} />
							   <ParamBox label={t('Private IP')} value={value?.privateIP ?? ''} onChange={handleChange('privateIP')} param_desc={{...params?.privateIP, type: 'ipaddress'}} />
					   </HorizontalStack>

					   <HorizontalStack>
							   <ParamBox label={t('Port Min')} value={value?.port ?? ''} onChange={handleChange('port')} param_desc={{...params?.port, type: 'port'}} />
							   <ParamBox label={t('Port Max')} value={value?.portMax ?? ''} onChange={handleChange('portMax')} param_desc={{...params?.portMax, type: 'port'}} />
					   </HorizontalStack>
			   </Stack>
	   </AccordionBox>
		</Fragment>
	);
}
