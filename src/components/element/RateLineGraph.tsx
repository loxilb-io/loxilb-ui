//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {CurveType, LineChart} from '@mui/x-charts';
import {formatRateForAxis, formatNumberForAxis} from 'common';
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

	// Real time scale, not a positional index. An index axis spaces every sample
	// evenly, so a stalled or sparse poll drew a 9-minute gap the same width as a
	// 2-second one and repeated the same tick label ("-9m") ten times over. A time
	// scale renders gaps truthfully and lets the chart pick its own tick density,
	// which also keeps wide charts from stacking a label every 2 seconds.
	const latestTimestamp = recentRates.length > 0 ? recentRates[recentRates.length - 1].timestamp : Date.now();
	const x_axis = recentRates.map(rate => new Date(rate.timestamp));
	const x_axis_value_formatter = (value: Date) => {
		// Labels stay relative ("-30s", "-5m", "Now") — on a live rate graph the
		// distance from now is the useful reading, not the wall-clock time.
		const secondsAgo = Math.round((latestTimestamp - value.getTime()) / 1000);
		if (secondsAgo <= 0) return 'Now';
		if (secondsAgo < 60) return `-${secondsAgo}s`;
		// Keep the leftover seconds: rounding to whole minutes made two adjacent
		// ticks (-66s and -61s) both read "-1m".
		const minutes = Math.floor(secondsAgo / 60);
		const seconds = secondsAgo % 60;
		return seconds ? `-${minutes}m${seconds}s` : `-${minutes}m`;
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
			xAxis={[{data: x_axis, scaleType: 'time', valueFormatter: x_axis_value_formatter, tickLabelStyle: axis_label_style}]}
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
