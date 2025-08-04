//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useState} from 'react';

import {LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {DatePicker} from '@mui/x-date-pickers/DatePicker';

import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import localeData from 'dayjs/plugin/localeData';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import i18n from 'locales/i18n';

dayjs.extend(localeData);
dayjs.extend(localizedFormat);
dayjs.locale(i18n.language);

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function DateSelector(props: {label: string; set_date_str: Function}) {
	const {label, set_date_str} = props;

	const [date_js, set_date_js] = useState<dayjs.Dayjs | null>(dayjs());

	return (
		<LocalizationProvider dateAdapter={AdapterDayjs}>
			<DatePicker
				name="date"
				label={label}
				value={date_js}
				onChange={newValue => {
					if (newValue && newValue.isValid()) {
						const new_date = newValue.toDate();
						set_date_str(new_date.toISOString());
						set_date_js(newValue);
					}
				}}
			/>
		</LocalizationProvider>
	);
}
