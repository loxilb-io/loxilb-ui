//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {CurveType, LineChart} from '@mui/x-charts';
import {extract_data_by_timestamp, getUnitFromSeries, formatRateForAxis} from 'common';
import {chart_color} from 'theme';
import {ITimelineDataSet} from 'types/global';

//---------------------------------------------------------
// Functional Component - Specialized for Rate Data (bps/pps)
//---------------------------------------------------------
export default function RateLineGraph(props: {
	data: ITimelineDataSet;
	unit: 'bps' | 'pps';
	width?: number;
	height?: number;
}) {
	const {data, unit, width = 360, height = 220} = props;

	const data_count = 10;

	const time_unit = getUnitFromSeries<number>(data.values);
	const x_axis = Array.from({length: data_count}, (_, i) => i);
	const x_axis_value_formatter = (value: number) => {
		if (value >= data_count) return 'Now';
		else {
			const reversedIndex = data_count - 1 - value;
			return `-${reversedIndex * time_unit.unit_value}${time_unit.unit}`;
		}
	};

	const y_values = extract_data_by_timestamp<number>(data.values, time_unit.seconds, data_count);
	const series = [
		{
			curve: 'step' as CurveType,
			data: y_values,
			showMark: false,
			color: chart_color[0],
			yAxisKey: 'left',
		},
	];

	// Custom Y-axis formatter for rate data
	const y_axis_value_formatter = (value: number) => {
		return formatRateForAxis(value, unit);
	};

	const max_y = Math.max(...y_values, 0);
	const rounded_max = Math.max(Math.ceil(max_y * 1.1), 100);

	return (
		<LineChart
			skipAnimation
			width={width}
			height={height}
			margin={{top: 10, bottom: 30, left: 40, right: 40}}
			series={series}
			slotProps={{legend: {hidden: true}}}
			xAxis={[{data: x_axis, valueFormatter: x_axis_value_formatter}]}
			yAxis={[
				{
					id: 'left',
					scaleType: 'linear',
					position: 'left',
					min: 0,
					max: rounded_max,
					labelStyle: {
						fill: chart_color[0],
						fontSize: 10,
					},
					valueFormatter: y_axis_value_formatter,
				},
			]}
			leftAxis="left"
		/>
	);
}
