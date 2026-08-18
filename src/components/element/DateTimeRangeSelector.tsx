//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useEffect, useState} from 'react';

import {LocalizationProvider} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {DateTimePicker} from '@mui/x-date-pickers/DateTimePicker';

import RemoveIcon from '@mui/icons-material/Remove';
import {Box} from '@mui/material';
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
export default function DateTimeRangeSelector(props: {
	startLabel: string;
	endLabel: string;
	start_datetime: string; // ISO string format
	end_datetime: string;
	set_start_datetime_str: Function;
	set_end_datetime_str: Function;
}) {
	const {startLabel, endLabel, start_datetime, end_datetime, set_start_datetime_str, set_end_datetime_str} = props;

	// An empty prop means "no bound", and the picker must render empty to say so.
	// This used to fall back to now-1day/now, which showed a range the caller was
	// not applying — the defaults lived only in this component's local state and
	// were never handed back through set_*_datetime_str (those fire on change
	// only), so the table filtered on an empty range while the UI advertised a
	// one-day window.
	const parseDateTime = (isoString: string) => {
		if (!isoString) return null;
		const parsed = dayjs(isoString);
		return parsed.isValid() ? parsed : null;
	};

	const [start_datetime_js, set_start_datetime_js] = useState<dayjs.Dayjs | null>(parseDateTime(start_datetime));
	const [end_datetime_js, set_end_datetime_js] = useState<dayjs.Dayjs | null>(parseDateTime(end_datetime));

	// props가 변경될 때 상태 업데이트 (빈 값으로 되돌리는 경우 포함)
	useEffect(() => {
		set_start_datetime_js(parseDateTime(start_datetime));
	}, [start_datetime]);

	useEffect(() => {
		set_end_datetime_js(parseDateTime(end_datetime));
	}, [end_datetime]);

	return (
		<LocalizationProvider dateAdapter={AdapterDayjs}>
			<Box display="flex" gap="10px" alignItems="center">
				<DateTimePicker
					name="start_datetime"
					label={startLabel}
					value={start_datetime_js}
					slotProps={{field: {clearable: true}}}
					onChange={newValue => {
						// A cleared picker reports null. Propagating it as an empty string is
						// what makes a bound removable: the old guard swallowed null, so once
						// a range was set there was no way back to "no bound" short of a reload.
						if (!newValue) {
							set_start_datetime_str('');
							set_start_datetime_js(null);
							return;
						}
						if (newValue.isValid()) {
							set_start_datetime_str(newValue.toDate().toISOString());
							set_start_datetime_js(newValue);
						}
					}}
					maxDateTime={end_datetime_js || undefined}
				/>
				<RemoveIcon />
				<DateTimePicker
					name="end_datetime"
					label={endLabel}
					value={end_datetime_js}
					slotProps={{field: {clearable: true}}}
					onChange={newValue => {
						if (!newValue) {
							set_end_datetime_str('');
							set_end_datetime_js(null);
							return;
						}
						if (newValue.isValid()) {
							set_end_datetime_str(newValue.toDate().toISOString());
							set_end_datetime_js(newValue);
						}
					}}
					minDateTime={start_datetime_js || undefined}
				/>
			</Box>
		</LocalizationProvider>
	);
}
