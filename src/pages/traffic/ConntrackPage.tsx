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
   // Track selected servName for synchronization
   const [selected_servName, set_selected_servName] = useState<string | null>(null);
   // Helper: get hash key (same as ConntrackTable)
   const getHashKey = (item: any) => {
	   const str = `${item.sourcePort || ''}_${item.destinationIP || ''}_${item.destinationPort || ''}_${item.protocol || ''}_${item.conntrackState || ''}_${item.conntrackAct || ''}`;
	   let hash = 0;
	   for (let i = 0; i < str.length; i++) {
		   hash = ((hash << 5) - hash) + str.charCodeAt(i);
		   hash |= 0;
	   }
	   return hash >>> 0;
   };
   // Sorted ctAttr (same as ConntrackTable)
   const sortedCtAttr = ct_info?.ctAttr ? [...ct_info.ctAttr].sort((a, b) => getHashKey(a) - getHashKey(b)) : [];
   // Always map selected_rows (original index) to sorted index
   let selected_index = -1;
   if (selected_rows.length === 1 && ct_info?.ctAttr) {
	   const original = ct_info.ctAttr[selected_rows[0]];
	   selected_index = sortedCtAttr.findIndex(attr => getHashKey(attr) === getHashKey(original));
   } else if (selected_servName) {
	   selected_index = sortedCtAttr.findIndex(attr => attr.servName === selected_servName);
   }
   const selected_attr = selected_index !== -1 ? sortedCtAttr[selected_index] : undefined;

   useEffect(() => {
	   if (inst) refetch();
   }, [inst, refetch]);
   // Synchronize selected row index after sorting
   useEffect(() => {
	   if (!ct_info || !ct_info.ctAttr || ct_info.ctAttr.length === 0) return;
	   if (selected_rows.length === 1) {
		   const servName = ct_info.ctAttr[selected_rows[0]].servName;
		   set_selected_servName(servName);
	   } else if (selected_servName !== null) {
		   set_selected_servName(null);
	   }
   }, [ct_info, selected_rows, selected_servName]);

   return (
	   <Fragment>
		   <ConntrackTable
			   data={{ctAttr: sortedCtAttr}}
			   selected_rows={selected_index !== -1 ? [selected_index] : []}
			   onChangeSelectedRows={(indices: number[]) => {
				   // Map sorted indices back to original indices
				   if (indices.length === 1 && ct_info?.ctAttr) {
					   const sortedItem = sortedCtAttr[indices[0]];
					   const originalIndex = ct_info.ctAttr.findIndex(attr => getHashKey(attr) === getHashKey(sortedItem));
					   set_selected_rows(originalIndex !== -1 ? [originalIndex] : []);
				   } else {
					   set_selected_rows([]);
				   }
			   }}
		   />
		   {selected_attr && (
			   <LowerSection>
				   <ConntrackPanel instance={inst} name={selected_attr.servName} data={selected_attr} />
			   </LowerSection>
		   )}
	   </Fragment>
   );
}
