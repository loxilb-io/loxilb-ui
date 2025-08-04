import {FormControl, InputLabel, MenuItem, Select, SelectChangeEvent} from '@mui/material';
import {useState} from 'react';

export default function DropDownMenu(props: {label: string; item_list: string[]; onMenuChange: (index: number) => void}) {
	const {label, item_list, onMenuChange} = props;

	const [cur_index, set_cur_index] = useState<number>(0);

	const handleChange = (event: SelectChangeEvent<number>) => {
		const value = event.target.value as number;
		set_cur_index(value);
		onMenuChange(value);
	};

	return (
		<FormControl fullWidth size="small">
			<InputLabel>{label}</InputLabel>

			{item_list?.length > 0 ? (
				<Select label={label} value={cur_index} onChange={handleChange} fullWidth>
					{item_list.map((item, index) => (
						<MenuItem key={index} value={index}>
							{item}
						</MenuItem>
					))}
				</Select>
			) : (
				<Select label={label} value="0" disabled>
					<MenuItem value="0">{'No items available'}</MenuItem>
				</Select>
			)}
		</FormControl>
	);
}
