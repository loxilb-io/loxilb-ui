//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {t} from 'i18next';
import {useCallback} from 'react';
import {IUlclArgument} from 'types/session_ulcl';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function UlclArgumentInputForm(props: {value: IUlclArgument; onChange: (data: IUlclArgument) => void; params?: any}) {
	const {value, onChange, params} = props;

	const handleChange = useCallback((field: keyof IUlclArgument) => (newValue: any) => onChange({...value, [field]: newValue}), [value, onChange]);

	return (
		<HorizontalStack>
			<ParamBox label={t('QFI')} value={value.qfi} param_desc={params?.qfi} onChange={handleChange('qfi')} />
			<ParamBox label={t('ULCL IP')} value={value.ulclIP} param_desc={{...params?.ulclIP, type: 'ipaddress'}} onChange={handleChange('ulclIP')} />
		</HorizontalStack>
	);
}
