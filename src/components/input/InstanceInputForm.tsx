//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, Typography} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IInstanceInput} from 'types/oam';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function InstanceInputForm(props: {onChange: (data: IInstanceInput) => void}) {
	const {onChange} = props;

	const {form, params, handleChange} = useFormWithParams<IInstanceInput>('IInstanceInput', onChange);

	if (!form) return null;
	return (
		<Stack spacing={2}>
			<Typography variant="body1" color="text.secondary">
				{t('Please enter the instance information')}
			</Typography>

			<ParamBox label={t('Name')} value={form.name} onChange={handleChange('name')} param_desc={params?.name} />

			<HorizontalStack>
				<ParamBox label={t('Container Image')} value={form.cimage} onChange={handleChange('cimage')} param_desc={params?.cimage} />
				<ParamBox label={t('Tag')} value={form.ctag} onChange={handleChange('ctag')} param_desc={params?.ctag} />
			</HorizontalStack>

			<HorizontalStack>
				<ParamBox label={t('Host')} value={form.host} onChange={handleChange('host')} param_desc={params?.host} />
				<ParamBox label={t('Port')} value={form.port} onChange={handleChange('port')} param_desc={{...params?.port, type: 'port'}} />
			</HorizontalStack>

			<ParamBox label={t('Version')} value={form.version} onChange={handleChange('version')} param_desc={params?.version} />
			<ParamBox label={t('Description')} value={form.description} onChange={handleChange('description')} param_desc={params?.description} multiline minRows={3} />
		</Stack>
	);
}
