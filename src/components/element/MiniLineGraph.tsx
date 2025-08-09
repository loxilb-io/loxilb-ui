//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Typography} from '@mui/material';
import {LineChart} from '@mui/x-charts';
import {chart_color} from 'theme';
import {ITimelineDataSet} from 'types/global';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function MiniLineGraph(props: {data: ITimelineDataSet; height?: number}) {
	const {data, height = 60} = props;

	if (!data.values || data.values.length === 0) {
		return (
			<Box height={height} display="flex" alignItems="center" justifyContent="center">
				<Typography variant="caption" color="textSecondary">
					No data
				</Typography>
			</Box>
		);
	}

	const y_values = data.values.map(item => item.data);
	const x_axis = Array.from({length: data.values.length}, (_, i) => i);

	const series = [
		{
			curve: 'step' as const,
			data: y_values,
			showMark: false,
			color: chart_color[0],
			yAxisKey: 'left',
		},
	];

	const max_y = Math.max(...y_values, 0);
	const min_y = Math.min(...y_values, 0);
	const range = max_y - min_y;
	const padding = range * 0.1;

	return (
		<LineChart
			skipAnimation
			width={120}
			height={height}
			margin={{top: 5, bottom: 5, left: 5, right: 5}}
			series={series}
			slotProps={{legend: {hidden: true}}}
			xAxis={[{
				data: x_axis,
				disableTicks: true,
				disableLine: true,
			}]}
			yAxis={[
				{
					id: 'left',
					scaleType: 'linear',
					position: 'left',
					min: Math.max(min_y - padding, 0),
					max: max_y + padding,
					disableTicks: true,
					disableLine: true,
				},
			]}
			leftAxis="left"
		/>
	);
}
