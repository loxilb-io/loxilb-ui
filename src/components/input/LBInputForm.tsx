//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, Typography} from '@mui/material';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IServiceConfiguration} from 'types/load_balancer';
import {AllowedSourcesListInputForm, SecondaryIPListInputForm} from './IPListInputForm';
import AdvancedSettingsForm from './subforms/AdvancedSettingsForm';
import BasicSettingsForm from './subforms/BasicSettingsForm';
import EndpointListForm from './subforms/EndpointListForm';
import HealthCheckForm from './subforms/HealthCheckForm';
import SecurityOptionsForm from './subforms/SecurityOptionsForm';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function LBInputForm(props: {onChange: (data: IServiceConfiguration) => void}) {
	const {onChange} = props;

	const {form, params, handleChange} = useFormWithParams<IServiceConfiguration>('IServiceConfiguration', onChange);

	if (!form) return null;
	return (
		<Stack width="100%" maxHeight="400px" spacing={2}>
			<Typography variant="h6">{t('Add Load Balancer Rule')}</Typography>

			<Stack width="100%" height="100%" padding="15px 5px" spacing={2} sx={{overflowY: 'auto'}}>
				<BasicSettingsForm value={form.serviceArguments} onChange={handleChange('serviceArguments')} params={params?.serviceArguments} />
				<HealthCheckForm value={form.serviceArguments} onChange={handleChange('serviceArguments')} params={params?.serviceArguments} />
				<SecurityOptionsForm value={form.serviceArguments} onChange={handleChange('serviceArguments')} params={params?.serviceArguments} />
				<AdvancedSettingsForm value={form.serviceArguments} onChange={handleChange('serviceArguments')} params={params?.serviceArguments} />
				<SecondaryIPListInputForm values={form.secondaryIPs} onChange={handleChange('secondaryIPs')} description={params?.secondaryIPs?.description} />
				<AllowedSourcesListInputForm values={form.allowedSources} onChange={handleChange('allowedSources')} description={params?.allowedSources?.description} />
				<EndpointListForm values={form.endpoints} onChange={handleChange('endpoints')} params={params?.endpoints} />
			</Stack>
		</Stack>
	);
}
