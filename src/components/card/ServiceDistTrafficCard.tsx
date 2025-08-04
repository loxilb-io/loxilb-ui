//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box} from '@mui/material';
import {get_size_str} from 'common';
import PieChartWithTitle from 'components/element/PieChartWithTitle';
import {useMetrics} from 'hooks/query/metricsHook';
import {t} from 'i18next';
import {useMemo} from 'react';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function ServiceDistTrafficCard(props: {instance: IInstance | null}) {
	const {instance} = props;

	const {serviceDistTraffic} = useMetrics(instance);

	const chart_data = useMemo(() => {
		const truncateLabel = (text: string, maxLength: number = 20) => {
			return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
		};

		const entries = Object.entries(serviceDistTraffic).map(([key, entry], index) => ({
			id: index,
			value: entry.ratio * 100, // ratio를 백분율로 변환
			label: `${truncateLabel(key)}(${get_size_str(entry.value)})`,
		}));

		const total_used = entries.reduce((sum, item) => sum + item.value, 0);
		const unused_value = Math.max(0, 100 - total_used);

		return [
			...entries.filter(entry => entry.value > 0),
			...(unused_value > 0
				? [
						{
							id: 'unused',
							value: unused_value,
							label: t('Unused'),
						},
				  ]
				: []),
		];
	}, [serviceDistTraffic]);

	return (
		<CardBase title={t('Service Distribution Traffic')}>
			<Box width="100%" display="flex" alignItems="flex-start" justifyContent="space-between">
				<PieChartWithTitle data={chart_data} />
			</Box>
		</CardBase>
	);
}
