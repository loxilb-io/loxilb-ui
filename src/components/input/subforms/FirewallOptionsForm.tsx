//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Typography} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {t} from 'i18next';
import {useCallback} from 'react';
import {IOptions} from 'types/firewall';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function FirewallOptionsForm(props: {value: IOptions; onChange: (data: IOptions) => void; params?: any}) {
	const {value, onChange, params} = props;

	const handleChange = useCallback((field: keyof IOptions) => (newValue: any) => onChange({...value, [field]: newValue}), [value, onChange]);

	return (
		<Box display="flex" flexDirection="column" gap={2} width="100%">
			<Typography variant="subtitle1" color="textSecondary">
				{t('Rule Behavior')}
			</Typography>

			<HorizontalStack>
				<ParamBox label={t('Allow')} value={value.allow} onChange={handleChange('allow')} param_desc={{...params?.allow, type: 'boolean'}} />
				<ParamBox label={t('Drop')} value={value.drop} onChange={handleChange('drop')} param_desc={{...params?.drop, type: 'boolean'}} />
				<ParamBox label={t('Trap')} value={value.trap} onChange={handleChange('trap')} param_desc={{...params?.trap, type: 'boolean'}} />
				<ParamBox label={t('Record')} value={value.record} onChange={handleChange('record')} param_desc={{...params?.record, type: 'boolean'}} />
			</HorizontalStack>

			<Typography variant="subtitle1" color="textSecondary">
				{t('Redirection / SNAT')}
			</Typography>

			<HorizontalStack>
				<ParamBox label={t('Redirect')} value={value.redirect} onChange={handleChange('redirect')} param_desc={{...params?.redirect, type: 'boolean'}} />
				<ParamBox label={t('Do SNAT')} value={value.doSnat} onChange={handleChange('doSnat')} param_desc={{...params?.doSnat, type: 'boolean'}} />
				<ParamBox
					label={t('Port Name')}
					value={value.redirectPortName}
					onChange={handleChange('redirectPortName')}
					param_desc={{...params?.redirectPortName, type: 'string'}}
				/>
			</HorizontalStack>

			<HorizontalStack>
				<ParamBox label={t('To IP')} value={value.toIP} onChange={handleChange('toIP')} param_desc={{...params?.toIP, type: 'ipaddress'}} />
				<ParamBox label={t('To Port')} value={value.toPort} onChange={handleChange('toPort')} param_desc={{...params?.toPort, type: 'port'}} />
			</HorizontalStack>

			<HorizontalStack>
				<ParamBox label={t('fwMark')} value={value.fwMark} onChange={handleChange('fwMark')} param_desc={params?.fwMark} />
				<ParamBox label={t('Counter')} value={value.counter} onChange={handleChange('counter')} param_desc={params?.counter} />
				<ParamBox label={t('On Default')} value={value.onDefault} onChange={handleChange('onDefault')} param_desc={{...params?.onDefault, type: 'boolean'}} />
			</HorizontalStack>
		</Box>
	);
}
