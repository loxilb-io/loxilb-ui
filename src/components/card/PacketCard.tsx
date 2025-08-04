//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import SimpleLineGraph from 'components/element/SimpleLineGraph';
import {t} from 'i18next';
import {ITimelineDataSet} from 'types/global';
import {IProcessedTraffic} from 'types/metrics';
import CardBase from './CardBase';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function PacketCard(props: {data_set: ITimelineDataSet<IProcessedTraffic>}) {
	const {data_set} = props;
	const {label, values} = data_set;

	const traffic_data = {
		label: t('Packets'),
		values: values.map(values => ({
			timestamp: values.timestamp,
			data: values.data.processed_sctp_bytes ?? 0,
		})),
	};

	return (
		<CardBase title={label ?? 'Packet Overview'}>
			<SimpleLineGraph data={traffic_data} />
		</CardBase>
	);
}
