//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {CurveType, LineChart} from '@mui/x-charts';
import {extract_data_by_timestamp, getUnitFromSeries} from 'common';
import {chart_color} from 'theme';
import {ITimelineDataSet} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function MiniGraph(props: {data: ITimelineDataSet}) {
	const {data} = props;

	const data_count = 10;

	const unit = getUnitFromSeries<number>(data.values);
	const x_axis = Array.from({length: data_count}, (_, i) => i);
	const x_axis_value_formatter = (value: number) => {
		if (value >= data_count) return 'Now';
		else {
			const reversedIndex = data_count - 1 - value;
			return `-${reversedIndex * unit.unit_value}${unit.unit}`;
		}
	};

	const y_values_1 = extract_data_by_timestamp<number>(data.values, unit.seconds, data_count);
	const series = [
		{
			curve: 'step' as CurveType,
			data: y_values_1,
			showMark: false,
			color: chart_color[0],
			yAxisKey: 'left',
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

	const max_y = Math.max(...y_values_1, 0);
	const rounded_max = Math.max(Math.ceil(max_y * 1.1), 100);

	return (
		<LineChart
			skipAnimation
			width={100}
			height={50}
			margin={{top: 0, bottom: 0, left: 0, right: 0}}
			series={series}
			slotProps={{legend: {hidden: true}}}
			xAxis={[{data: x_axis, valueFormatter: x_axis_value_formatter, disableLine: true, disableTicks: true, tickLabelStyle: {display: 'none'}}]}
			yAxis={[
				{
					id: 'left',
					scaleType: 'linear',
					position: 'left',
					min: 0,
					max: rounded_max,
					valueFormatter: y_axis_value_formatter,
					disableLine: true,
					disableTicks: true,
					tickLabelStyle: {display: 'none'},
				},
			]}
			leftAxis="left"
		/>
	);
}
