//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack, Typography} from '@mui/material';
import SimpleLineGraph from 'components/element/SimpleLineGraph';
import SingleTextBox from 'components/element/SingleTextBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import ConntrackTable from 'components/table/traffic/ConntrackTable';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useConntrackSeries} from 'hooks/query/metricsTimeSeriesHook';
import {useConntrack} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useEffect, useState} from 'react';
import {ICtAttribute, ICtData} from 'types/conn_track';
import {ITimeSeriesPoint, ITimelineDataSet} from 'types/global';
import {IInstance} from 'types/oam';

//---------------------------------------------------------
// Sub Component
//---------------------------------------------------------
function ConntrackPanel(props: {instance: IInstance | null; name: string; data: ICtAttribute}) {
	const {instance, name, data} = props;

	const now = Date.now();

	const timeseries: ITimeSeriesPoint<ICtData>[] = useConntrackSeries(instance);

	const traffic_data: ITimelineDataSet<number> = {
		label: 'Traffic',
		values: timeseries?.map(point => {
			const attr = point.data.ctAttr.find(attr => attr.servName === name);
			return {
				timestamp: point.timestamp,
				data: attr?.bytes ?? 0,
			};
		}) ?? [
			{
				timestamp: now,
				data: data?.bytes ?? 0,
			},
		],
	};

	const packets_data: ITimelineDataSet<number> = {
		label: 'Packets',
		values: timeseries?.map(point => {
			const attr = point.data.ctAttr.find(attr => attr.servName === name);
			return {
				timestamp: point.timestamp,
				data: attr?.packets ?? 0,
			};
		}) ?? [
			{
				timestamp: now,
				data: data?.packets ?? 0,
			},
		],
	};

	return (
		<SubTitlePannel title={name} sub_title={t('Details')}>
			<SingleTextBox label={t('Conntrack Act')} value={data.conntrackAct} />
			<HorizontalStack align="flex-start">
				<Stack spacing={2}>
					<SingleTextBox label={t('Source')} value={`${data.sourceIP}:${data.sourcePort}`} />
					<SingleTextBox label={t('Destination')} value={`${data.destinationIP}:${data.destinationPort}`} />
				</Stack>

				{traffic_data && (
					<Stack alignItems="center">
						<SimpleLineGraph data={traffic_data} />
						<Typography variant="caption" color="textSecondary">
							{t('Traffic (bps)')}
						</Typography>
					</Stack>
				)}

				{packets_data && (
					<Stack alignItems="center">
						<SimpleLineGraph data={packets_data} />
						<Typography variant="caption" color="textSecondary">
							{t('Packets (pps)')}
						</Typography>
					</Stack>
				)}
			</HorizontalStack>
		</SubTitlePannel>
	);
}

//---------------------------------------------------------
// Main Component
//---------------------------------------------------------
export default function ConntrackPage() {
	const inst = useInstanceFromURL();

	const {data: ct_info, refetch} = useConntrack(inst);

	const [selected_rows, set_selected_rows] = useState<number[]>([]);
	const selected_attr = selected_rows.length === 1 ? ct_info?.ctAttr[selected_rows[0]] : undefined;

	useEffect(() => {
		if (inst) refetch();
	}, [inst, refetch]);

	return (
		<Fragment>
			<ConntrackTable data={ct_info ?? {ctAttr: []}} selected_rows={selected_rows} onChangeSelectedRows={set_selected_rows} />

			{selected_attr && (
				<LowerSection>
					<ConntrackPanel instance={inst} name={selected_attr.servName} data={selected_attr} />
				</LowerSection>
			)}
		</Fragment>
	);
}
