//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Typography} from '@mui/material';
import {pieArcLabelClasses, PieChart, PieValueType} from '@mui/x-charts';
import {t} from 'i18next';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function PieChartWithTitle(props: {title?: string; data: PieValueType[]}) {
	const {title, data} = props;

	const pie_param = {
		width: 230,
		height: 200,
		margin: {right: 5},
		slotProps: {legend: {hidden: true}},
	};

	const totalValue = data.reduce((sum, item) => sum + item.value, 0);

	const processedData = [...data];
	if (totalValue < 100) {
		const remainingValue = 100 - totalValue;
		processedData.push({
			id: data.length,
			label: t(`Unused`),
			value: remainingValue,
		});
	}

	// const colors = [...chart_color.slice(0, processedData.length - 1), '#E0E0E0'];

	return (
		<Box flexGrow={1} gap={2} display="flex" flexDirection="column" alignItems="center">
			{title && (
				<Typography variant="subtitle2" color="text.secondary">
					{title}
				</Typography>
			)}

			<PieChart
				{...pie_param}
				series={[
					{
						data: processedData,
						arcLabel: item => item.label?.split(' - ')[0] ?? '',
						arcLabelMinAngle: 35,
						highlightScope: {fade: 'global', highlight: 'item'},
						faded: {innerRadius: 30, additionalRadius: -30, color: 'gray'},
						valueFormatter: value => `${value.value.toFixed(1)}%`,
					},
				]}
				sx={{
					[`& .${pieArcLabelClasses.root}`]: {
						fontSize: '0.8rem',
					},
				}}
			/>
		</Box>
	);
}
