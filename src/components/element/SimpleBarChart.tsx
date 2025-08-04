//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Typography} from '@mui/material';
import {BarChart} from '@mui/x-charts';
import {t} from 'i18next';
import {chart_color} from 'theme';
import {ITimelineDataSet} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SimpleBarChart(props: {data: ITimelineDataSet[]}) {
	const {data} = props;

	const data_count = data.length;

	const x_axis = Array.from({length: data_count}, (_, i) => i);
	const x_axis_value_formatter = (value: number) => {
		return data[value].label || `Data ${value + 1}`;
	};

	const get_last_values = (data: ITimelineDataSet[], index: number) => {
		return data.map(dataset => {
			const last_value = dataset.values[dataset.values.length - 1];
			if (last_value) {
				return last_value.data;
			} else {
				return 0; // Default value if no data is available
			}
		});
	};

	const y_values_1 = get_last_values(data, 0);
	const series = [
		{
			data: y_values_1,
			color: chart_color[0],
			stack: 'total',
		},
	];

	const y_axis_value_formatter = (value: number) => {
		if (value === 0) return '0';
		if (value < 1_000) return value.toFixed(0);
		if (value < 1_000_000) return (value / 1_000).toFixed(0) + 'K';
		if (value < 1_000_000_000) return (value / 1_000_000).toFixed(0) + 'M';
		if (value < 1_000_000_000_000) return (value / 1_000_000_000).toFixed(0) + 'B';
		else return (value / 1_000_000_000_000).toFixed(0) + 'T';
	};

	const max_y = Math.max(...y_values_1);
	const rounded_max = Math.max(Math.ceil(max_y * 1.1), 10); // Ensure a minimum of 1000 for the max value

	return data.length > 0 ? (
		<BarChart
			skipAnimation
			width={360}
			height={220}
			margin={{top: 10, bottom: 30, left: 40, right: 40}}
			series={series}
			slotProps={{legend: {hidden: true}}}
			xAxis={[{data: x_axis, valueFormatter: x_axis_value_formatter, scaleType: 'band'}]}
			yAxis={[
				{
					scaleType: 'linear',
					valueFormatter: y_axis_value_formatter,
					min: 0,
					max: rounded_max,
				},
			]}
		/>
	) : (
		<Box display="flex" justifyContent="center" alignItems="center" height="100%">
			<Typography variant="body2">{t('No request data available.')}</Typography>
		</Box>
	);
}
