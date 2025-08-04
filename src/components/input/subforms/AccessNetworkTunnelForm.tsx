//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, Typography} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {t} from 'i18next';
import {useCallback} from 'react';
import {IAccessNetworkTunnel} from 'types/session';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function AccessNetworkTunnelForm(props: {value: IAccessNetworkTunnel; onChange: any; params?: any}) {
	const {value, onChange, params} = props;

	const handleChange = useCallback((field: keyof IAccessNetworkTunnel) => (newValue: any) => onChange({...value, [field]: newValue}), [value, onChange]);

	return (
		<Stack spacing={2}>
			<Typography variant="caption" color="textSecondary" paddingLeft="4px">
				{t('Access Network Tunnel')}
			</Typography>

			<HorizontalStack>
				<ParamBox label={t('Telecom ID')} value={value.TeID} onChange={handleChange('TeID')} param_desc={params?.TeID} />
				<ParamBox label={t('Tunnel IP')} value={value.tunnelIP} onChange={handleChange('tunnelIP')} param_desc={{...params?.tunnelIP, type: 'ipaddress'}} />
			</HorizontalStack>
		</Stack>
	);
}
