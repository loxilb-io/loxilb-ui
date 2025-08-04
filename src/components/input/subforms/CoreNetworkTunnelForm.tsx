//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, Typography} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {t} from 'i18next';
import {useCallback} from 'react';
import {ICoreNetworkTunnel} from 'types/session';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function CoreNetworkTunnelForm(props: {value: ICoreNetworkTunnel; onChange: any; params?: any}) {
	const {value, onChange, params} = props;

	const handleChange = useCallback((field: keyof ICoreNetworkTunnel) => (data: any) => onChange({...value, [field]: data}), [onChange, value]);

	return (
		<Stack spacing={2}>
			<Typography variant="caption" color="textSecondary" paddingLeft="4px">
				{t('Core Network Tunnel')}
			</Typography>

			<HorizontalStack>
				<ParamBox label={t('Telecom ID')} value={value.teID} onChange={handleChange('teID')} param_desc={params?.teID} />
				<ParamBox label={t('Tunnel IP')} value={value.tunnelIP} onChange={handleChange('tunnelIP')} param_desc={{...params?.tunnelIP, type: 'ipaddress'}} />
			</HorizontalStack>
		</Stack>
	);
}
