//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import SimpleLineGraph from 'components/element/SimpleLineGraph';
import {t} from 'i18next';
import {ITimeSeriesPoint} from 'types/global';
import {IProcessedTraffic} from 'types/metrics';
import CardBase from './CardBase';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function TrafficCard(props: {title: string; points: ITimeSeriesPoint<IProcessedTraffic>[]; data_key: string}) {
	const {title, points, data_key} = props;

	const traffic_data = {
		label: t('Traffic (bps)'),
		values: points.map(point => {
			const key = data_key as keyof IProcessedTraffic;
			const value = point.data[key] ?? 0;

			return {
				timestamp: point.timestamp,
				data: value,
			};
		}),
	};

	return (
		<CardBase title={title}>
			<SimpleLineGraph data={traffic_data} />
		</CardBase>
	);
}
