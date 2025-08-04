//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import SimpleBarChart from 'components/element/SimpleBarChart';
import {useFwDropSeries} from 'hooks/query/metricsTimeSeriesHook';
import {t} from 'i18next';
import {useMemo} from 'react';
import {ITimelineDataSet} from 'types/global';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function DropCountCard(props: {instance: IInstance | null}) {
	const {instance} = props;

	const fwDropSeries = useFwDropSeries(instance);

	const fw_drop_data: ITimelineDataSet[] = useMemo(() => {
		if (fwDropSeries.length === 0) return [];

		const ruleMap = new Map<string, {timestamp: number; value: number}[]>();
		const totalMap: {timestamp: number; value: number}[] = [];

		fwDropSeries.forEach(point => {
			const timestamp = point.timestamp;
			let total = 0;

			point.data.total_fw_drops_per_rule.forEach(rule => {
				const ruleName = rule.fw_rule || 'unknown';
				if (!ruleMap.has(ruleName)) {
					ruleMap.set(ruleName, []);
				}
				ruleMap.get(ruleName)!.push({timestamp, value: rule.value});
				total += rule.value;
			});

			totalMap.push({timestamp, value: total});
		});

		const result: ITimelineDataSet[] = Array.from(ruleMap.entries()).map(([ruleName, records]) => ({
			label: ruleName,
			values: records.map(r => ({
				timestamp: r.timestamp,
				data: r.value,
			})),
		}));

		if (result.length === 0 && totalMap.length > 0) {
			result.push({
				label: 'total',
				values: totalMap.map(r => ({
					timestamp: r.timestamp,
					data: r.value,
				})),
			});
		}

		return result;
	}, [fwDropSeries]);

	return (
		<CardBase title={t('Total Drop Count by Firewall')}>
			<SimpleBarChart data={fw_drop_data} />
		</CardBase>
	);
}
