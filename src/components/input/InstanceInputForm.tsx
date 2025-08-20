//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, Typography} from '@mui/material';
import React from 'react';
import ParamBox from 'components/element/ParamBox';
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
		version: initialValues?.version || '',
		description: initialValues?.description || ''
	});

	// Validate required fields
	const isValid = React.useMemo(() => {
		return !!(form.name?.toString().trim() && 
		         form.cimage?.toString().trim() && 
		         form.ctag?.toString().trim() && 
		         form.host?.toString().trim() && 
		         form.port?.toString().trim() && 
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
		</Stack>
	);
}