//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useState} from 'react';

import {LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {DateTimePicker} from '@mui/x-date-pickers/DateTimePicker';

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
export default function DateTimeSelector(props: {label: string; set_datetime_str: Function}) {
	const {label, set_datetime_str} = props;

	const [datetime_js, set_datetime_js] = useState<dayjs.Dayjs | null>(dayjs());

	return (
		<LocalizationProvider dateAdapter={AdapterDayjs}>
			<DateTimePicker
				name="datetime"
				label={label}
				value={datetime_js}
				onChange={newValue => {
					if (newValue && newValue.isValid()) {
						const new_datetime = newValue.toDate();
						set_datetime_str(new_datetime.toISOString());
						set_datetime_js(newValue);
					}
				}}
			/>
		</LocalizationProvider>
	);
}
