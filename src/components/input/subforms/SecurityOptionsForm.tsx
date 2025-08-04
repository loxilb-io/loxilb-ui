//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import securities from 'assets/json/securities.json';
import AccordionBox from 'components/element/AccordionBox';
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {t} from 'i18next';
import {useCallback} from 'react';
import {IEnumItem} from 'types/global';
import {IServiceArguments} from 'types/load_balancer';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function SecurityOptionsForm(props: {value: IServiceArguments; onChange: any; params?: any}) {
	const {value, onChange, params} = props;

	const security_list: IEnumItem[] = securities;

	const handleChange = useCallback((field: keyof IServiceArguments) => (newValue: any) => onChange({...value, [field]: newValue}), [value, onChange]);

	return (
		<AccordionBox title={t('Behavioral & Security Options')}>
			<Stack spacing={2}>
				<Stack spacing={1} direction="row" alignItems="center">
					<ParamBox label={t('BGP')} value={value.bgp} onChange={handleChange('bgp')} param_desc={params?.bgp} />
					<ParamBox label={t('SNAT')} value={value.snat} onChange={handleChange('snat')} param_desc={params?.snat} />
					<ParamBox label={t('Managed')} value={value.managed} onChange={handleChange('managed')} param_desc={params?.managed} />
				</Stack>

				<Stack spacing={1} direction="row" alignItems="center">
					<ParamBox label={t('Egress')} value={value.egress} onChange={handleChange('egress')} param_desc={params?.egress} />
					<ParamBox label={t('Proxy Protocol v2')} value={value.proxyprotocolv2} onChange={handleChange('proxyprotocolv2')} param_desc={params?.proxyprotocolv2} />
				</Stack>

				<HorizontalStack>
					<ParamBox label={t('Security')} value={value.security} onChange={handleChange('security')} param_desc={{...params?.security, enum: security_list}} />
					<ParamBox label={t('Block')} value={value.block} onChange={handleChange('block')} param_desc={params?.block} />
				</HorizontalStack>
			</Stack>
		</AccordionBox>
	);
}
