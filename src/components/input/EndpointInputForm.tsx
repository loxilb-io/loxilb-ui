//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Divider} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IEndpointInput} from 'types/endpoint';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function EndpointInputForm(props: {onChange: (data: IEndpointInput) => void}) {
	const {onChange} = props;

	const {form, params, handleChange} = useFormWithParams<IEndpointInput>('IEndpointInput', onChange);

	if (!form) return null;
	return (
		<NewBox item_name={t('Endpoint')}>
			<ParamBox label={t('Host Name')} value={form.hostName} onChange={handleChange('hostName')} param_desc={params?.hostName} />

			<HorizontalStack>
				<ParamBox label={t('Name')} value={form.name} onChange={handleChange('name')} param_desc={params?.name} />
				<ParamBox label={t('Inactive Retries')} value={form.inactiveReTries} onChange={handleChange('inactiveReTries')} param_desc={params?.inactiveReTries} />
			</HorizontalStack>

			<Divider />

			<HorizontalStack>
				<ParamBox label={t('Probe Type')} value={form.probeType} onChange={handleChange('probeType')} param_desc={params?.probeType} />
				<ParamBox label={t('Probe Duration')} value={form.probeDuration} onChange={handleChange('probeDuration')} param_desc={params?.probeDuration} />
				<ParamBox label={t('Probe Port')} value={form.probePort} onChange={handleChange('probePort')} param_desc={{...params?.probePort, type: 'port'}} />
			</HorizontalStack>

			<HorizontalStack>
				<ParamBox label={t('Probe Request')} value={form.probeReq} onChange={handleChange('probeReq')} param_desc={params?.probeReq} />
				<ParamBox label={t('Probe Response')} value={form.probeResp} onChange={handleChange('probeResp')} param_desc={params?.probeResp} />
			</HorizontalStack>
		</NewBox>
	);
}
