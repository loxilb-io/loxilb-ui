//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {CurveType, LineChart} from '@mui/x-charts';
import {extract_data_by_timestamp, getUnitFromSeries, formatRateForAxis, formatNumberForAxis} from 'common';
import {chart_color} from 'theme';
import {ITimelineDataSet} from 'types/global';

//---------------------------------------------------------
// Functional Component - Specialized for Rate Data (bps/pps)
//---------------------------------------------------------
export default function RateLineGraph(props: {
	data: ITimelineDataSet;
	unit: 'bps' | 'pps' | 'count' | 'eps' | 'fps';
	// Omitted width → the chart observes and fills its parent, so cards
	// resized by the dashboard grid (or wide viewports) get full-width
	// graphs instead of a fixed 360px column.
	width?: number;
	height?: number;
}) {
	const {data, unit, width, height = 220} = props;

	// Use all calculated delta rates directly without resampling
	const recentRates = data.values; // Use all calculated rates
	const data_count = recentRates.length;	
		
	// Create X-axis labels from actual timestamps relative to the latest data
	const latestTimestamp = recentRates.length > 0 ? recentRates[recentRates.length - 1].timestamp : Date.now();
	const x_axis = Array.from({length: data_count}, (_, i) => i);
	const x_axis_value_formatter = (value: number) => {
		if (value >= data_count - 1) return 'Now';
		const ratePoint = recentRates[value];
		if (!ratePoint) return '';
		
		// Calculate time difference from the latest data point, not current time
		const secondsAgo = Math.round((latestTimestamp - ratePoint.timestamp) / 1000);
		if (secondsAgo >= 60) return `-${Math.round(secondsAgo / 60)}m`;
		return `-${secondsAgo}s`;
	};

	// Use calculated delta rates directly as Y-values
	const y_values = recentRates.map(rate => Math.max(rate.data, 0));
	const series = [
		{
			curve: 'step' as CurveType,
			data: y_values,
			showMark: false,
			color: chart_color[0],
			yAxisKey: 'left',
			// Soft area fill under the line (sparkline idiom) — opacity is
			// kept low via sx below so the line stays the signal.
			area: true,
		},
	];

	// Custom Y-axis formatter for rate/count data
	const y_axis_value_formatter = (value: number) => {
		if (unit === 'count') {
			return formatNumberForAxis(value);
		}
		return formatRateForAxis(value, unit);
	};

	const max_y = Math.max(...y_values, 0);
	// Fix: Don't force minimum of 100 for count data
	const rounded_max = (unit === 'count' || unit === 'pps')
		? Math.max(Math.ceil(max_y * 1.1), max_y + 1) // For counts/pps: just slightly above max
		: Math.max(Math.ceil(max_y * 1.1), 100);      // For bps: keep 100 minimum	

	// Axis chrome stays neutral gray — color belongs to the data line, not
	// the scaffolding around it.
	const axis_label_style = {fill: '#5A6B7D', fontSize: 10};

	return (
		<LineChart
			skipAnimation
			width={width}
			height={height}
			margin={{top: 10, bottom: 50, left: 30, right: 20}}
			series={series}
			slotProps={{legend: {hidden: true}}}
			sx={{'& .MuiAreaElement-root': {fillOpacity: 0.12}}}
			xAxis={[{data: x_axis, valueFormatter: x_axis_value_formatter, tickLabelStyle: axis_label_style}]}
			yAxis={[
				{
					id: 'left',
					scaleType: 'linear',
					position: 'left',
					min: 0,
					max: rounded_max,
					labelStyle: axis_label_style,
					tickLabelStyle: axis_label_style,
					valueFormatter: y_axis_value_formatter,
				},
			]}
			leftAxis="left"
		/>
	);
}
