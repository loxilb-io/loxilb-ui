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

export default function EndpointInputForm({ initialData, isEdit = false, onChange, onValidation }: LEndpointInputFormProps & { initialData?: Partial<IEndpointInput>; isEdit?: boolean }) {
	// Initialize form data with initialData (same pattern as AlertRuleForm)
	const [formData, setFormData] = React.useState<IEndpointInput>({
		hostName: initialData?.hostName || '',
		name: initialData?.name || '',
		inactiveReTries: initialData?.inactiveReTries || 2,
		probeType: initialData?.probeType || 'ping',
		probeDuration: initialData?.probeDuration || 60,
		probePort: initialData?.probePort || 8080,
		probeReq: initialData?.probeReq || '',
		probeResp: initialData?.probeResp || '',
	});

	const [errors, setErrors] = React.useState<Record<string, string>>({});

	// Get params for validation only (don't use form state from this hook)
	const {params} = useFormWithParams<IEndpointInput>('IEndpointInput');

	// Validation function
	const validateForm = React.useCallback(() => {
		const newErrors: Record<string, string> = {};

		if (!formData.hostName?.trim()) {
			newErrors.hostName = t('Host Name is required');
		}

		if (!formData.name?.trim()) {
			newErrors.name = t('Name is required');
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	}, [formData]);

	// Update parent component when form changes
	React.useEffect(() => {
		const isValid = validateForm();
		
		onChange({
			...formData,
			isValid,
			errors,
		});

		if (onValidation) {
			onValidation(isValid);
		}
	}, [formData, onChange, onValidation, validateForm]);

	// Handle form field changes
	const handleChange = (field: keyof IEndpointInput, value: any) => {
		setFormData(prev => ({
			...prev,
			[field]: value,
		}));
	};

	// Wait for params to be ready before rendering form content
	if (!params) {
		return null;
	}

	return (
		<NewBox item_name={isEdit ? t('Edit Endpoint') : t('New Endpoint')}>
		   <ParamBox
		   	label={t('Host Name')}
		   	value={formData.hostName}
		   	onChange={(value) => handleChange('hostName', value)}
		   	param_desc={{...params.hostName, type: isEdit ? 'string' : 'ipaddress'}}
		   	disabled={isEdit}
		   />

		   <HorizontalStack>
			   <ParamBox
			   	label={t('Name')}
			   	value={formData.name}
			   	onChange={(value) => handleChange('name', value)}
			   	param_desc={params.name}
			   />
			   <ParamBox
			   	label={t('Inactive Retries')}
			   	value={formData.inactiveReTries}
			   	onChange={(value) => handleChange('inactiveReTries', value)}
			   	param_desc={params.inactiveReTries}
			   />
		   </HorizontalStack>

			<Divider />

		   <HorizontalStack>
			   <DropDownSelectBox 
				label={t('Probe Type')} 
				value={formData.probeType} 
				onChange={(value) => handleChange('probeType', value)} 
				item_list={[
					{id: 1, name: 'PING', send_value: 'ping'},
					{id: 2, name: 'TCP', send_value: 'tcp'},
					{id: 3, name: 'UDP', send_value: 'udp'},
					{id: 4, name: 'HTTP', send_value: 'http'},
					{id: 5, name: 'HTTPS', send_value: 'https'}
				]}
				/>
			   <ParamBox
			   	label={t('Probe Duration')}
			   	value={formData.probeDuration}
			   	onChange={(value) => handleChange('probeDuration', value)}
			   	param_desc={params.probeDuration}
			   />
			   <ParamBox
			   	label={t('Probe Port')}
			   	value={formData.probePort}
			   	onChange={(value) => handleChange('probePort', value)}
			   	param_desc={{...params.probePort, type: 'port'}}
			   />
		   </HorizontalStack>

		   <HorizontalStack>
			   <ParamBox
			   	label={t('Probe Request')}
			   	value={formData.probeReq}
			   	onChange={(value) => handleChange('probeReq', value)}
			   	param_desc={params.probeReq}
			   	disabled={!["udp", "http", "https"].includes(formData.probeType || '')}
			   />
			   <ParamBox
			   	label={t('Probe Response')}
			   	value={formData.probeResp}
			   	onChange={(value) => handleChange('probeResp', value)}
			   	param_desc={params.probeResp}
			   	disabled={!["udp", "http", "https"].includes(formData.probeType || '')}
			   />
		   </HorizontalStack>
		</NewBox>
	);
}