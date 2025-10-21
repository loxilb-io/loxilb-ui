//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {t} from 'i18next';
import {useCallback} from 'react';
import {IEnumItem} from 'types/global';
import {IPolicyInfo} from 'types/qos';

const types: IEnumItem[] = [
	{id: 0, name: 'TrTCM', send_value: 0},
	{id: 1, name: 'SrTCM', send_value: 1},
];
//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function PolicyInfoInputForm(props: {value: IPolicyInfo; onChange: any; params?: any}) {
	const {value, onChange, params} = props;

	const handleChange = useCallback((field: keyof IPolicyInfo) => (newValue: any) => onChange({...value, [field]: newValue}), [value, onChange]);

	return (
		<Stack spacing={2}>
			<HorizontalStack>
			   <ParamBox label={t('Type')} value={value?.type ?? ''} onChange={handleChange('type')} param_desc={{...params?.type, enum: types}} />
			   <ParamBox label={t('Color Aware')} value={value?.colorAware ?? ''} onChange={handleChange('colorAware')} param_desc={params?.colorAware} />
			</HorizontalStack>

			<HorizontalStack>
			   <ParamBox label={t('Committed Info Rate(bps)')} value={value?.committedInfoRate ?? ''} onChange={handleChange('committedInfoRate')} param_desc={params?.committedInfoRate} />
			   <ParamBox label={t('Peak Info Rate(bps)')} value={value?.peakInfoRate ?? ''} onChange={handleChange('peakInfoRate')} param_desc={params?.peakInfoRate} />
			</HorizontalStack>

			<HorizontalStack>
			   <ParamBox label={t('Committed Block Size')} value={value?.committedBlkSize ?? ''} onChange={handleChange('committedBlkSize')} param_desc={params?.committedBlkSize} />
			   <ParamBox label={t('Excess Block Size')} value={value?.excessBlkSize ?? ''} onChange={handleChange('excessBlkSize')} param_desc={params?.excessBlkSize} />
			</HorizontalStack>
		</Stack>
	);
}
