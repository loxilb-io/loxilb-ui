//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {FormControl, InputLabel, MenuItem, Select, SelectChangeEvent} from '@mui/material';
import {t} from 'i18next';
import {useEffect, useId, useMemo, useState} from 'react';
import {IEnumItem} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function DropDownSelectBox(props: {label: string; item_list: IEnumItem[]; value: any; onChange: (value: any) => void; disabled?: boolean}) {
	const {label, item_list, value, disabled, onChange} = props;

	const [cur_idx, set_cur_idx] = useState<number>(0);

	const isEmptyValue = value === undefined || value === '' || value === null;

	//---------------------------------------------------------
	// A value the list does not contain must still be SHOWN
	//---------------------------------------------------------
	// ⚠️⚠️ Otherwise this control displays a DIFFERENT value than the form
	// holds. The `onChange` below is deliberately fired only for an empty
	// value (firing it for a mismatch would loop), so on a mismatch nothing
	// corrected the form — it kept the operator's value while the combobox
	// read whatever sat at index 0. The operator then submits what they see
	// and gets something else. Silent misrepresentation, never a crash, which
	// is why it survived: no test and no error ever mentions it.
	//
	// It is reachable without anyone doing anything odd. `ParamBox` picks the
	// control from `param_desc.enum`: absent (metadata still in flight, or its
	// request dropped) it renders a free-text box; once the enum arrives it
	// renders THIS. So a value typed before the list loaded is a value the
	// list does not contain — and the mirror Port field does exactly that.
	//
	// Appending the held value is the same answer `topologyOptions` already
	// gives for the one field that had been fixed individually: withdrawing an
	// option something is standing on is only honest when nothing is standing
	// on it. This generalises that rule to every enum in the app.
	const display_list: IEnumItem[] = useMemo(() => {
		if (isEmptyValue) return item_list;
		if (item_list.some(item => item.send_value === value)) return item_list;
		return [...item_list, {id: -1, name: String(value), send_value: value as string | number}];
	}, [isEmptyValue, item_list, value]);

	useEffect(() => {
		const foundIndex = display_list.findIndex(item => item.send_value === value);
		if (foundIndex !== -1) {
			set_cur_idx(foundIndex);
		} else {
			// Only reachable for an EMPTY value now: anything else is carried by
			// display_list above. Empty still takes the list's own default.
			const noneIndex = item_list.findIndex(item => item.name.toLowerCase() === 'none');
			const defaultIndex = noneIndex !== -1 ? noneIndex : 0;
			set_cur_idx(defaultIndex);
			// Only call onChange if value is empty/undefined to avoid infinite loops
			if (isEmptyValue && item_list.length > 0) {
				onChange(item_list[defaultIndex].send_value);
			}
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps -- deps intentionally frozen: widening this list changes refetch/render behavior; verify at runtime before changing
	}, [value, display_list]);

	const handleChange = (event: SelectChangeEvent<number>) => {
		const item_index = event.target.value as number;
		set_cur_idx(item_index);

		const send_value = display_list[item_index]?.send_value;
		onChange(send_value);
	};

	const is_disabled = disabled || item_list.length === 0;

	// InputLabel must be wired to the Select via labelId — without it the
	// combobox has NO accessible name (screen readers announce nothing).
	const labelId = useId();

	return (
		<FormControl fullWidth size="small" disabled={is_disabled}>
			<InputLabel id={labelId}>{label}</InputLabel>

			{display_list.length > 0 ? (
				<Select labelId={labelId} label={label} value={cur_idx} onChange={handleChange} fullWidth disabled={is_disabled}>
					{display_list.map((item, index) => (
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
