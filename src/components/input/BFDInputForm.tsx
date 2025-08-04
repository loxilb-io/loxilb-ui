//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {IBfdInput} from 'types/bfd';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BFDInputForm(props: {onChange: (data: IBfdInput) => void}) {
	const {onChange} = props;

	const {form, params, handleChange} = useFormWithParams<IBfdInput>('IBfdInput', onChange);

	if (!form) return null;
	return (
		<NewBox item_name={t('BFD Configuration')}>
			<ParamBox label={t('Instance')} value={form.instance} onChange={handleChange('instance')} param_desc={params?.instance} />
			<ParamBox label={t('Remote IP')} value={form.remoteIp} onChange={handleChange('remoteIp')} param_desc={{...params?.remoteIp, type: 'ipaddress'}} />
			<ParamBox label={t('Source IP')} value={form.sourceIp} onChange={handleChange('sourceIp')} param_desc={{...params?.sourceIp, type: 'ipaddress'}} />
			<HorizontalStack>
				<ParamBox label={t('Interval (μs)')} value={form.interval} onChange={handleChange('interval')} param_desc={params?.interval} />
				<ParamBox label={t('Retry Count')} value={form.retryCount} onChange={handleChange('retryCount')} param_desc={params?.retryCount} />
			</HorizontalStack>
		</NewBox>
	);
}
