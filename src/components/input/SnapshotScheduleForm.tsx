//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {FormControlLabel, Stack, Switch} from '@mui/material';
import ParamBox from 'components/element/ParamBox';
import NewBox from 'components/layout/NewBox';
import {t} from 'i18next';
import React from 'react';
import {
	SCHEDULE_INTERVAL_HOURS_MAX,
	SCHEDULE_INTERVAL_HOURS_MIN,
	SCHEDULE_RETAIN_MAX,
	SCHEDULE_RETAIN_MIN,
} from 'types/snapshot';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export interface IScheduleEntry {
	enabled: boolean;
	interval_hours: number;
	retain_count: number;
}

interface SnapshotScheduleFormProps {
	initial?: Partial<IScheduleEntry>;
	onChange: (data: IScheduleEntry & {isValid: boolean}) => void;
}

const inRange = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max;

export default function SnapshotScheduleForm(props: SnapshotScheduleFormProps) {
	const {onChange} = props;

	const [form, setForm] = React.useState<IScheduleEntry>({
		enabled: props.initial?.enabled ?? false,
		interval_hours: props.initial?.interval_hours ?? 24,
		retain_count: props.initial?.retain_count ?? 10,
	});

	const intervalBad = !inRange(form.interval_hours, SCHEDULE_INTERVAL_HOURS_MIN, SCHEDULE_INTERVAL_HOURS_MAX);
	const retainBad = !inRange(form.retain_count, SCHEDULE_RETAIN_MIN, SCHEDULE_RETAIN_MAX);
	const validateForm = (data: IScheduleEntry): boolean =>
		inRange(data.interval_hours, SCHEDULE_INTERVAL_HOURS_MIN, SCHEDULE_INTERVAL_HOURS_MAX) &&
		inRange(data.retain_count, SCHEDULE_RETAIN_MIN, SCHEDULE_RETAIN_MAX);

	const update = (patch: Partial<IScheduleEntry>) => {
		const newForm = {...form, ...patch};
		setForm(newForm);
		onChange({...newForm, isValid: validateForm(newForm)});
	};

	React.useEffect(() => {
		onChange({...form, isValid: validateForm(form)});
	}, []);

	return (
		<NewBox item_name={t('Scheduled Snapshots')}>
			<Stack spacing={3}>
				<FormControlLabel
					control={<Switch checked={form.enabled} onChange={e => update({enabled: e.target.checked})} />}
					label={t('Enable scheduled snapshots')}
				/>
				<ParamBox
					label={t('Interval (hours)')}
					value={form.interval_hours}
					onChange={(v: any) => update({interval_hours: Number(v)})}
					error={intervalBad}
					helperText={intervalBad ? t('Must be an integer between {{min}} and {{max}}.', {min: SCHEDULE_INTERVAL_HOURS_MIN, max: SCHEDULE_INTERVAL_HOURS_MAX}) : undefined}
					param_desc={{type: 'integer', description: 'How often the OAM scheduler takes a snapshot (1–168 hours).', required: true}}
				/>
				<ParamBox
					label={t('Retain count')}
					value={form.retain_count}
					onChange={(v: any) => update({retain_count: Number(v)})}
					error={retainBad}
					helperText={retainBad ? t('Must be an integer between {{min}} and {{max}}.', {min: SCHEDULE_RETAIN_MIN, max: SCHEDULE_RETAIN_MAX}) : undefined}
					param_desc={{type: 'integer', description: 'Keep the newest N unpinned snapshots; pinned and pre-upgrade snapshots are exempt from retention.', required: true}}
				/>
			</Stack>
		</NewBox>
	);
}
