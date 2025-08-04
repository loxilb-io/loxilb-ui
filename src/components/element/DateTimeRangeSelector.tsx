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

	// 초기값 계산 함수
	const getInitialDateTime = (isoString: string, fallback: dayjs.Dayjs) => {
		if (isoString) {
			const parsed = dayjs(isoString);
			return parsed.isValid() ? parsed : fallback;
		}
		return fallback;
	};

	const currentTime = dayjs();
	const defaultStart = currentTime.subtract(1, 'day');
	const defaultEnd = currentTime;

	const [start_datetime_js, set_start_datetime_js] = useState<dayjs.Dayjs | null>(getInitialDateTime(start_datetime, defaultStart));
	const [end_datetime_js, set_end_datetime_js] = useState<dayjs.Dayjs | null>(getInitialDateTime(end_datetime, defaultEnd));

	// props가 변경될 때 상태 업데이트
	useEffect(() => {
		if (start_datetime) {
			const parsed = dayjs(start_datetime);
			if (parsed.isValid()) {
				set_start_datetime_js(parsed);
			}
		}
	}, [start_datetime]);

	useEffect(() => {
		if (end_datetime) {
			const parsed = dayjs(end_datetime);
			if (parsed.isValid()) {
				set_end_datetime_js(parsed);
			}
		}
	}, [end_datetime]);

	return (
		<LocalizationProvider dateAdapter={AdapterDayjs}>
			<Box display="flex" gap="10px" alignItems="center">
				<DateTimePicker
					name="start_datetime"
					label={startLabel}
					value={start_datetime_js}
					onChange={newValue => {
						if (newValue && newValue.isValid()) {
							const new_datetime = newValue.toDate();
							set_start_datetime_str(new_datetime.toISOString());
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
					onChange={newValue => {
						if (newValue && newValue.isValid()) {
							const new_datetime = newValue.toDate();
							set_end_datetime_str(new_datetime.toISOString());
							set_end_datetime_js(newValue);
						}
					}}
					minDateTime={start_datetime_js || undefined}
				/>
			</Box>
		</LocalizationProvider>
	);
}
