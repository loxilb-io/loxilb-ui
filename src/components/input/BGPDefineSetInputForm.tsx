//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Add} from '@mui/icons-material';
import {Button, Stack} from '@mui/material';
import AccordionBox from 'components/element/AccordionBox';
import ParamBox from 'components/element/ParamBox';
import SimpleButton from 'components/element/SimpleButton';
import HorizontalStack from 'components/layout/HorizontalStack';
import NewBox from 'components/layout/NewBox';
import useFormWithParams from 'hooks/inputFormHook';
import {t} from 'i18next';
import {useCallback, useEffect} from 'react';
import {IBGPDefinedSetInput} from 'types/bgp_defined_set';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function BGPDefinedSetInputForm(props: {onChange: (data: IBGPDefinedSetInput) => void}) {
	const {onChange} = props;

	const {form, params, handleChange} = useFormWithParams<IBGPDefinedSetInput>('IBGPDefinedSetInput', onChange);

	// Set default value for definedType to 'prefix' when form is loaded
	useEffect(() => {
		if (form && !form.definedType) handleChange('definedType')('prefix');
	}, [form, handleChange]);

	const addPrefixItem = useCallback(() => {
		if (!form || !form.prefixList) return;
		handleChange('prefixList')([...(form.prefixList || []), {ipPrefix: '', masklengthRange: ''}]);
	}, [form, handleChange]);

	const updatePrefixItem = useCallback(
		(index: number, field: 'ipPrefix' | 'masklengthRange', value: string) => {
			if (!form || !form.prefixList) return;
			const updated = [...(form.prefixList || [])];
			updated[index][field] = value;
			handleChange('prefixList')(updated);
		},
		[form, handleChange],
	);

	const deletePrefixItem = useCallback(
		(index: number) => {
			if (!form || !form.prefixList) return;
			const updated = [...(form.prefixList || [])];
			updated.splice(index, 1);
			handleChange('prefixList')(updated);
		},
		[form, handleChange],
	);

	if (!form) return null;

	const disableAdd = (form.prefixList?.length || 0) > 0 && !form.prefixList?.at(-1)?.ipPrefix?.trim() && !form.prefixList?.at(-1)?.masklengthRange?.trim();
	return (
		<NewBox item_name={t('BGP Defined Set')}>
			<HorizontalStack>
				<ParamBox label={t('Defined Set Name')} value={form.name} onChange={handleChange('name')} param_desc={params?.name} />
				<ParamBox label={t('Defined Set Type')} value={form.definedType} onChange={handleChange('definedType')} param_desc={params?.definedset_type} />
			</HorizontalStack>

			<ParamBox label={t('List')} value={form.List} onChange={handleChange('List')} param_desc={params?.List} />

			<AccordionBox title={t('Prefix List')} disabled={form.definedType !== 'prefix'}>
				<Stack spacing={2}>
					{(form.prefixList || []).map((item, idx) => (
						<HorizontalStack key={idx}>
							<ParamBox
								label={t('IP Prefix')}
								value={item.ipPrefix}
								onChange={(val: string) => updatePrefixItem(idx, 'ipPrefix', val)}
								param_desc={{...(params?.prefixList?.items as any)?.ipPrefix, type: 'ipaddress'}}
							/>
							<ParamBox
								label={t('Mask Length Range')}
								value={item.masklengthRange}
								onChange={(val: string) => updatePrefixItem(idx, 'masklengthRange', val)}
								param_desc={(params?.prefixList?.items as any)?.masklengthRange || {type: 'string'}}
							/>

							<SimpleButton type="delete" onClick={() => deletePrefixItem(idx)} />
						</HorizontalStack>
					))}

					<Button variant="outlined" startIcon={<Add />} size="small" sx={{width: 'fit-content'}} onClick={addPrefixItem} disabled={disableAdd}>
						{t('Add')}
					</Button>
				</Stack>
			</AccordionBox>
		</NewBox>
	);
}
