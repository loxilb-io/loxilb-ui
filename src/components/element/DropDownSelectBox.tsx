//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {FormControl, InputLabel, MenuItem, Select, SelectChangeEvent} from '@mui/material';
import {t} from 'i18next';
import {useEffect, useId, useState} from 'react';
import {IEnumItem} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function DropDownSelectBox(props: {label: string; item_list: IEnumItem[]; value: any; onChange: (value: any) => void; disabled?: boolean}) {
	const {label, item_list, value, disabled, onChange} = props;

	const [cur_idx, set_cur_idx] = useState<number>(0);

	useEffect(() => {
		const foundIndex = item_list.findIndex(item => item.send_value === value);
		if (foundIndex !== -1) {
			set_cur_idx(foundIndex);
		} else {
			// If no match found, try to find 'none' item, otherwise default to index 0
			const noneIndex = item_list.findIndex(item => item.name.toLowerCase() === 'none');
			const defaultIndex = noneIndex !== -1 ? noneIndex : 0;
			set_cur_idx(defaultIndex);
			// Only call onChange if value is empty/undefined to avoid infinite loops
			if (value === undefined || value === '' || value === null) {
				onChange(item_list[defaultIndex].send_value);
			}
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	}, [value, item_list]);

	const handleChange = (event: SelectChangeEvent<number>) => {
		const item_index = event.target.value as number;
		set_cur_idx(item_index);

		const send_value = item_list[item_index]?.send_value;
		onChange(send_value);
	};

	const is_disabled = disabled || item_list.length === 0;

	// InputLabel must be wired to the Select via labelId — without it the
	// combobox has NO accessible name (screen readers announce nothing).
	const labelId = useId();

	return (
		<FormControl fullWidth size="small" disabled={is_disabled}>
			<InputLabel id={labelId}>{label}</InputLabel>

			{item_list.length > 0 ? (
				<Select labelId={labelId} label={label} value={cur_idx} onChange={handleChange} fullWidth disabled={is_disabled}>
					{item_list.map((item, index) => (
						<MenuItem key={index} value={index}>
							{item.name}
						</MenuItem>
					))}
				</Select>
			) : (
				<Select labelId={labelId} label={label} value="0" disabled>
					<MenuItem value="0">{t('No items available')}</MenuItem>
				</Select>
			)}
		</FormControl>
	);
}
