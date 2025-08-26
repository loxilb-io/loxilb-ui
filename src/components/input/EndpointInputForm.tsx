//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Divider} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import DropDownSelectBox from 'components/element/DropDownSelectBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import React from 'react';
import {IEndpointInput} from 'types/endpoint';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
interface LEndpointInputFormProps {
	onChange: (data: IEndpointInput & { isValid?: boolean; errors?: any }) => void;
	onValidation?: (isValid: boolean) => void;
}

export default function EndpointInputForm(props: LEndpointInputFormProps) {
	// const {onChange} = props;

	// const {form, params, handleChange} = useFormWithParams<IEndpointInput>('IEndpointInput', onChange);

	const {onChange, onValidation} = props;
	const {form, params, handleChange, errors, isValid} = useFormWithParams<IEndpointInput>('IEndpointInput');

	// Notify parent of validation state and form data
	React.useEffect(() => {
		if (form) {
			// onChange({ ...form, isValid, errors });
			onChange({ ...form, probeType: form.probeType || 'ping', isValid, errors });
		}
		if (onValidation) {
			onValidation(isValid);
		}
	}, [form, isValid, errors, onChange, onValidation]);
	

	if (!form) return null;
	return (
		<NewBox item_name={t('Endpoint')}>
		   <ParamBox label={t('Host Name')} value={form?.hostName ?? ''} onChange={handleChange('hostName')} param_desc={{...params?.hostName, type: 'ipaddress'}} />

		   <HorizontalStack>
			   <ParamBox label={t('Name')} value={form?.name ?? ''} onChange={handleChange('name')} param_desc={params?.name} />
			   <ParamBox label={t('Inactive Retries')} value={form?.inactiveReTries ?? ''} onChange={handleChange('inactiveReTries')} param_desc={params?.inactiveReTries} />
		   </HorizontalStack>

			<Divider />

		   <HorizontalStack>
			   {/* <ParamBox label={t('Probe Type')} value={form?.probeType ?? ''} onChange={handleChange('probeType')} param_desc={params?.probeType} /> */}
			   <DropDownSelectBox 
					label={t('Probe Type')} 
					value={form?.probeType ?? 'ping'} 
					onChange={handleChange('probeType')} 
					item_list={[
						{id: 1, name: 'PING', send_value: 'ping'},
						{id: 2, name: 'TCP', send_value: 'tcp'},
						{id: 3, name: 'UDP', send_value: 'udp'},
						{id: 4, name: 'HTTP', send_value: 'http'},
						{id: 5, name: 'HTTPS', send_value: 'https'}
					]}
				/>
			   <ParamBox label={t('Probe Duration')} value={form?.probeDuration ?? ''} onChange={handleChange('probeDuration')} param_desc={params?.probeDuration} />
			   <ParamBox label={t('Probe Port')} value={form?.probePort ?? ''} onChange={handleChange('probePort')} param_desc={{...params?.probePort, type: 'port'}} />
		   </HorizontalStack>

		   <HorizontalStack>
			   <ParamBox label={t('Probe Request')} value={form?.probeReq ?? ''} onChange={handleChange('probeReq')} param_desc={params?.probeReq} disabled={!["udp", "http", "https"].includes(form?.probeType || '')} />
			   <ParamBox label={t('Probe Response')} value={form?.probeResp ?? ''} onChange={handleChange('probeResp')} param_desc={params?.probeResp} disabled={!["udp", "http", "https"].includes(form?.probeType || '')} />
		   </HorizontalStack>
		</NewBox>
	);
}
