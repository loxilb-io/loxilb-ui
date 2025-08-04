import {Stack} from '@mui/material';
import modes from 'assets/json/modes.json';
import opers from 'assets/json/opers.json';
import sels from 'assets/json/sels.json';
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
export default function AdvancedSettingsForm(props: {value: IServiceArguments; onChange: any; params?: any}) {
	const {value, onChange, params} = props;

	const sel_list: IEnumItem[] = sels;
	const oper_list: IEnumItem[] = opers;
	const mode_list: IEnumItem[] = modes;

	const handleChange = useCallback(
		(field: keyof IServiceArguments) => (newValue: any) => {
			onChange({...value, [field]: newValue});
		},
		[value, onChange],
	);

	return (
		<AccordionBox title={t('Advanced Settings')}>
			<Stack spacing={2}>
				<HorizontalStack>
					<ParamBox label={t('SEL')} value={value.sel} onChange={handleChange('sel')} param_desc={{...params?.sel, enum: sel_list}} />
					<ParamBox label={t('Oper')} value={value.oper} onChange={handleChange('oper')} param_desc={{...params?.oper, enum: oper_list}} />
				</HorizontalStack>

				<HorizontalStack>
					<ParamBox label={t('Mode')} value={value.mode} onChange={handleChange('mode')} param_desc={{...params?.mode, enum: mode_list}} />
					<ParamBox label={t('Inactive Timeout')} value={value.inactiveTimeOut} onChange={handleChange('inactiveTimeOut')} param_desc={params?.inactiveTimeOut} />
				</HorizontalStack>
			</Stack>
		</AccordionBox>
	);
}
