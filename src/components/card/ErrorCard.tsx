//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import SimpleBarChart from 'components/element/SimpleBarChart';
import {useErrorSeries} from 'hooks/query/metricsTimeSeriesHook';
import {t} from 'i18next';
import {useMemo} from 'react';
import {ITimelineDataSet, ITimeSeriesPoint} from 'types/global';
import {IErrorCount} from 'types/metrics';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function ErrorCard(props: {instance: IInstance | null}) {
	const {instance} = props;

	const errorSeries: ITimeSeriesPoint<IErrorCount>[] = useErrorSeries(instance);

	const error_data_by_service: ITimelineDataSet[] = useMemo(() => {
		if (errorSeries.length === 0) return [];

		const serviceMap = new Map<string, {timestamp: number; value: number}[]>();

		errorSeries.forEach(point => {
			const ts = point.timestamp;
			point.data.total_errors_per_service.forEach(serviceErr => {
				const key = serviceErr.name || 'unknown';
				if (!serviceMap.has(key)) serviceMap.set(key, []);

				serviceMap.get(key)!.push({timestamp: ts, value: serviceErr.value});
			});
		});

		return Array.from(serviceMap.entries()).map(([label, records]) => ({
			label,
			values: records.map(r => ({
				timestamp: r.timestamp,
				data: typeof r.value === 'number' ? r.value : 0,
			})),
		}));
	}, [errorSeries]);

	return (
		<CardBase title={t('Total Errors')}>
			<SimpleBarChart data={error_data_by_service} />
		</CardBase>
	);
}
