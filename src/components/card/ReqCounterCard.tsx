//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import SimpleBarChart from 'components/element/SimpleBarChart';
import {useMetrics} from 'hooks/query/metricsHook';
import {t} from 'i18next';
import {useMemo} from 'react';
import {ITimelineDataSet} from 'types/global';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function ReqCounterCard(props: {instance: IInstance | null}) {
	const {instance} = props;

	const {reqCounter} = useMetrics(instance); // IRequestCount

	const reqcounter_per_service: ITimelineDataSet[] = useMemo(() => {
		if (!reqCounter) return [];

		if (!reqCounter.total_requests_per_service) {
			if (reqCounter.total_requests) {
				return [
					{
						label: 'total',
						values: [{timestamp: Date.now(), data: reqCounter.total_requests}],
					},
				];
			} else return [];
		}

		if (reqCounter.total_requests_per_service.length === 0) return [];
		else {
			return reqCounter.total_requests_per_service.map(service => ({
				label: service.name || 'unknown',
				values: [{timestamp: Date.now(), data: service.value}],
			}));
		}
	}, [reqCounter.total_requests_per_service]);

	return (
		<CardBase title={t('Request Count / Client')}>
			<SimpleBarChart data={reqcounter_per_service} />
		</CardBase>
	);
}
