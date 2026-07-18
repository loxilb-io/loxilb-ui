//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import {t} from 'i18next';
import {useCallback, useRef} from 'react';
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

	// Accumulate field updates in a ref so several onChange calls landing in the
	// same React batch — e.g. the Type dropdown's mount-time auto-default (TrTCM)
	// firing while the user fills the rate fields — merge instead of clobbering
	// one another through a stale `value` snapshot (F19 sibling: without this the
	// displayed TrTCM default was dropped from the POST payload). The ref only
	// accumulates emitted values; the schema-default reset can transiently blank
	// a field's `value`, and folding that back in here would re-clobber the ref
	// (the ParamBox re-announces its default, so the ref self-heals regardless).
	const mergedRef = useRef<IPolicyInfo>(value ?? ({} as IPolicyInfo));

	const handleChange = useCallback(
		(field: keyof IPolicyInfo) => (newValue: any) => {
			mergedRef.current = {...mergedRef.current, [field]: newValue};
			onChange({...mergedRef.current});
		},
		[onChange],
	);

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
