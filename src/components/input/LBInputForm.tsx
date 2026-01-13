//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import React from 'react';
import {Stack, Typography} from '@mui/material';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IServiceConfiguration} from 'types/load_balancer';
import {AllowedSourcesListInputForm, SecondaryIPListInputForm} from './IPListInputForm';
import AdvancedSettingsForm from './subforms/AdvancedSettingsForm';
import BasicSettingsForm from './subforms/BasicSettingsForm';
import EndpointListForm from './subforms/EndpointListForm';
// import HealthCheckForm from './subforms/HealthCheckForm'; // Moved to EndpointListForm
import SecurityOptionsForm from './subforms/SecurityOptionsForm';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
interface LBInputFormProps {
	onChange: (data: IServiceConfiguration & { isValid?: boolean; errors?: any }) => void;
	onValidation?: (isValid: boolean) => void;
}

export default function LBInputForm({ initialData, isEdit = false, onChange, onValidation }: LBInputFormProps & { initialData?: Partial<IServiceConfiguration>; isEdit?: boolean }) {
	// Initialize form data with initialData (same pattern as EndpointInputForm)
	const [formData, setFormData] = React.useState<IServiceConfiguration>({
		serviceArguments: {
			// Spread initialData first
			...initialData?.serviceArguments,
			// Then apply defaults (these will override the spread values)
			externalIP: initialData?.serviceArguments?.externalIP || '',
			port: initialData?.serviceArguments?.port || 0,
			protocol: initialData?.serviceArguments?.protocol || 'tcp',
			name: initialData?.serviceArguments?.name || '',
			sel: initialData?.serviceArguments?.sel ?? 0,
			mode: initialData?.serviceArguments?.mode ?? 0,
			monitor: initialData?.serviceArguments?.monitor || false,
			probetype: initialData?.serviceArguments?.probetype || '',
			// Filter out -1 sentinel values for health check fields
			probeport: (initialData?.serviceArguments?.probeport && initialData.serviceArguments.probeport !== -1) ? initialData.serviceArguments.probeport : undefined,
			probereq: initialData?.serviceArguments?.probereq || '',
			proberesp: initialData?.serviceArguments?.proberesp || '',
			probeTimeout: initialData?.serviceArguments?.probeTimeout || 1800,
			probeRetries: (initialData?.serviceArguments?.probeRetries && initialData.serviceArguments.probeRetries !== -1) ? initialData.serviceArguments.probeRetries : undefined,
			block: initialData?.serviceArguments?.block ?? 0,
			inactiveTimeOut: initialData?.serviceArguments?.inactiveTimeOut ?? 0,
			// New optional fields for API updates
			path_prefix: initialData?.serviceArguments?.path_prefix,
			path_match_mode: initialData?.serviceArguments?.path_match_mode,
			llm_type: initialData?.serviceArguments?.llm_type,
			backend_protocol: initialData?.serviceArguments?.backend_protocol,
		},
		secondaryIPs: initialData?.secondaryIPs || [],
		allowedSources: initialData?.allowedSources || [],
		endpoints: initialData?.endpoints || [],
	});

	const [errors, setErrors] = React.useState<Record<string, string>>({});

	// Get params for validation (still use useFormWithParams for param definitions)
	const {params} = useFormWithParams<IServiceConfiguration>('IServiceConfiguration');

	// Validation function
	const validateForm = React.useCallback(() => {
		const newErrors: Record<string, string> = {};

		if (!formData.serviceArguments?.externalIP?.trim()) {
			newErrors.externalIP = t('External IP is required');
		}

		if (!formData.serviceArguments?.name?.trim()) {
			newErrors.name = t('Service Name is required');
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
	const handleChange = (field: keyof IServiceConfiguration) => (value: any) => {
		setFormData(prev => ({
			...prev,
			[field]: value,
		}));
	};

	// Don't render until params are loaded to avoid issues
	if (!params) {
		return null;
	}

	return (
		<Stack width="100%" maxHeight="400px" spacing={2}>
			<Typography variant="h6">
				{isEdit ? t('Edit Load Balancer Rule') : t('Add Load Balancer Rule')}
			</Typography>

			<Stack width="100%" height="100%" padding="15px 5px" spacing={2} sx={{overflowY: 'auto'}}>
			   <BasicSettingsForm 
			   	value={formData?.serviceArguments ?? {}} 
			   	onChange={handleChange('serviceArguments')} 
			   	params={params?.serviceArguments} 
			   	isEdit={isEdit}
			   />
			   <AdvancedSettingsForm value={formData?.serviceArguments ?? {}} onChange={handleChange('serviceArguments')} params={params?.serviceArguments} />			   
			   <SecondaryIPListInputForm values={formData?.secondaryIPs ?? []} onChange={handleChange('secondaryIPs')} description={params?.secondaryIPs?.description} />
			   <AllowedSourcesListInputForm values={formData?.allowedSources ?? []} onChange={handleChange('allowedSources')} description={params?.allowedSources?.description} />
			   <EndpointListForm 
					values={formData?.endpoints ?? []} 
					onChange={handleChange('endpoints')} 
					params={params?.endpoints}
					serviceArguments={formData?.serviceArguments}
					onServiceArgumentsChange={handleChange('serviceArguments')}
					serviceArgumentsParams={params?.serviceArguments}
			   />
			   {/* <HealthCheckForm value={formData?.serviceArguments ?? {}} onChange={handleChange('serviceArguments')} params={params?.serviceArguments} /> */}
			   {/* Health check fields moved to EndpointListForm */}
			</Stack>
		</Stack>
	);
}