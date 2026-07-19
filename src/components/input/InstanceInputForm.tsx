//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, Typography} from '@mui/material';
import React from 'react';
import ParamBox from 'components/element/ParamBox';
import DropDownSelectBox from 'components/element/DropDownSelectBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {t} from 'i18next';
import {IInstanceInput} from 'types/oam';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function InstanceInputForm(props: {
	onChange: (data: IInstanceInput & {isValid: boolean}) => void;
	initialValues?: Partial<IInstanceInput>;
}) {
	const {onChange, initialValues} = props;
	
	// Initialize form with initial values or defaults
	const [form, setForm] = React.useState<IInstanceInput>({
		name: initialValues?.name || '',
		cimage: initialValues?.cimage || 'ghcr.io/loxilb-io/loxilb',
		ctag: initialValues?.ctag || 'latest',
		host: initialValues?.host || '',
		port: initialValues?.port || '8091',
		protocol: initialValues?.protocol || 'https',
		version: initialValues?.version || 'v1',
		description: initialValues?.description || '',
		is_active: initialValues?.is_active ?? true, 
	});

	// Validate required fields — and the port must be a real 1–65535 value, so
	// an out-of-range port (matching PortBox's own rejection) disables submit.
	const isValid = React.useMemo(() => {
		const portNum = Number(form.port);
		const portValid = form.port?.toString().trim() !== '' && Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535;
		return !!(form.name?.toString().trim() &&
		         form.cimage?.toString().trim() &&
		         form.ctag?.toString().trim() &&
		         form.host?.toString().trim() &&
		         portValid &&
		         form.protocol?.toString().trim() &&
		         form.version?.toString().trim());
	}, [form]);

	// Notify parent when form or validation changes
	React.useEffect(() => {
		onChange({...form, isValid});
	}, [form, isValid, onChange]);

	const handleChange = (field: keyof IInstanceInput) => (value: string | number) => {
		// Ensure all values are stored as strings to match IInstanceInput interface
		setForm(prev => ({...prev, [field]: String(value || '')}));
	};

	const handleBooleanChange = (field: keyof IInstanceInput) => (value: boolean) => {
		setForm(prev => ({...prev, [field]: value}));
	};

	return (
		<Stack spacing={2}>
			<Typography variant="body1" color="text.secondary">
				{t('Please enter the instance information')}
			</Typography>

		   <ParamBox 
		   	label={t('Name')} 
		   	value={form.name} 
		   	onChange={handleChange('name')} 
		   	param_desc={{type: 'string', required: true}} 
		   />

		   <HorizontalStack>
			   <ParamBox 
			   	label={t('Container Image')} 
			   	value={form.cimage} 
			   	onChange={handleChange('cimage')} 
			   	param_desc={{type: 'string', required: true}} 
			   />
			   <ParamBox 
			   	label={t('Tag')} 
			   	value={form.ctag} 
			   	onChange={handleChange('ctag')} 
			   	param_desc={{type: 'string', required: true}} 
			   />
		   </HorizontalStack>

		   <HorizontalStack>
		   <ParamBox 
		   	label={t('Host')} 
		   	value={form.host} 
		   	onChange={handleChange('host')} 
		   	param_desc={{type: 'string', required: true}} 
		   />
		   <ParamBox 
		   	label={t('Port')} 
		   	value={form.port} 
		   	onChange={handleChange('port')} 
		   	param_desc={{type: 'port', required: true}} 
		   />
		   <DropDownSelectBox 
		   	label={t('Protocol')} 
		   	value={form.protocol} 
		   	onChange={handleChange('protocol')} 
		   	item_list={[
		   		{id: 1, name: 'HTTP', send_value: 'http'},
		   		{id: 2, name: 'HTTPS', send_value: 'https'}
		   	]}
		   />
	   </HorizontalStack>

		   <ParamBox 
		   	label={t('Version')} 
		   	value={form.version} 
		   	onChange={handleChange('version')} 
		   	param_desc={{type: 'string', required: true}} 
		   />
		   <ParamBox 
		   	label={t('Description')} 
		   	value={form.description} 
		   	onChange={handleChange('description')} 
		   	param_desc={{type: 'string', required: false}} 
		   	multiline 
		   	minRows={3} 
		   />
		   <ParamBox 
		   	label={t('Active')} 
		   	value={form.is_active} 
		   	onChange={handleBooleanChange('is_active')} 
		   	param_desc={{type: 'boolean', required: false}} 
		   />
		</Stack>
	);
}