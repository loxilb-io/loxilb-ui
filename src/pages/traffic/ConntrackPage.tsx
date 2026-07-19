//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack, Typography, FormControl, InputLabel, Select, MenuItem, TextField, Button, Chip} from '@mui/material';
import {formatRate} from 'common';
import RateLineGraph from 'components/element/RateLineGraph';
import RateTooltip from 'components/element/RateTooltip';
import SingleTextBox from 'components/element/SingleTextBox';
import HorizontalStack from 'components/layout/HorizontalStack';
import LowerSection from 'components/layout/LowerSection';
import SubTitlePannel from 'components/layout/SubTitlePannel';
import ConntrackTable from 'components/table/traffic/ConntrackTable';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useConntrackSeries} from 'hooks/query/metricsTimeSeriesHook';
import {useConntrack} from 'hooks/query/queryHooks';
import {t} from 'i18next';
import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {ICtAttribute, ICtData} from 'types/conn_track';
import {ITimeSeriesPoint, ITimelineDataSet} from 'types/global';
import {IInstance} from 'types/oam';

//---------------------------------------------------------
// Sub Component
//---------------------------------------------------------
function ConntrackPanel(props: {instance: IInstance | null; data: ICtAttribute}) {
	const {instance, data} = props;
	const now = Date.now();
	const timeseries: ITimeSeriesPoint<ICtData>[] = useConntrackSeries(instance);

	// Helper function to match connections based on five key attributes
	const matchesConnection = (attr: ICtAttribute, target: ICtAttribute) => {
		const matches = attr.destinationIP === target.destinationIP &&
			   attr.sourceIP === target.sourceIP &&
			   attr.destinationPort === target.destinationPort &&
			   attr.sourcePort === target.sourcePort &&
			   attr.protocol === target.protocol;
		
		return matches;
	};

	// Calculate rates from cumulative data (like DeltaTrafficCard)
	const calculateDeltaRates = (cumulativePoints: ITimeSeriesPoint<number>[]) => {
		if (cumulativePoints.length < 2) return [];
		
		// Use recent points only for better visualization
		const recentPoints = cumulativePoints.slice(-30); // Last 30 points
		
		return recentPoints.slice(1).map((point, index) => {
			const prevPoint = recentPoints[index]; // index already offset by slice(1)
			const deltaValue = (point.data ?? 0) - (prevPoint.data ?? 0);
			const deltaTime = (point.timestamp - prevPoint.timestamp) / 1000; // Convert ms to seconds
			const rate = deltaTime > 0 ? deltaValue / deltaTime : 0;

			return {
				timestamp: point.timestamp,
				data: Math.max(rate, 0), // Ensure non-negative values
			};
		});
	};

	// Extract cumulative byte data for the specific connection
	const cumulativeBytes = timeseries?.map(point => {
		const attr = point.data.ctAttr.find(attr => matchesConnection(attr, data));
		return {
			timestamp: point.timestamp,
			data: attr?.bytes ?? 0,
		};
	}) ?? [
		{
			timestamp: now,
			data: data?.bytes ?? 0,
		},
	];

	const traffic_data: ITimelineDataSet<number> = {
		label: 'Traffic',
		values: calculateDeltaRates(cumulativeBytes),
	};

	// Extract cumulative packet data for the specific connection
	const cumulativePackets = timeseries?.map(point => {
		const attr = point.data.ctAttr.find(attr => matchesConnection(attr, data));
		return {
			timestamp: point.timestamp,
			data: attr?.packets ?? 0,
		};
	}) ?? [
		{
			timestamp: now,
			data: data?.packets ?? 0,
		},
	];

	const packets_data: ITimelineDataSet<number> = {
		label: 'Packets',
		values: calculateDeltaRates(cumulativePackets),
	};

	// Calculate current rates (latest values)
	const currentTrafficRate = traffic_data.values.length > 0 ? traffic_data.values[traffic_data.values.length - 1].data*8 : 0;
	const currentPacketRate = packets_data.values.length > 0 ? packets_data.values[packets_data.values.length - 1].data : 0;

	return (
		<SubTitlePannel title={`${data.sourceIP}_${data.sourcePort} → ${data.destinationIP}_${data.destinationPort}`} sub_title={t('Details')}>
			<SingleTextBox label={t('Conntrack Act')} value={data.conntrackAct} />
			<HorizontalStack align="flex-start">
				<Stack spacing={2}>
					<SingleTextBox label={t('Source')} value={`${data.sourceIP}:${data.sourcePort}`} />
					<SingleTextBox label={t('Destination')} value={`${data.destinationIP}:${data.destinationPort}`} />
					<SingleTextBox label={t('Current Bytes')} value={`${(data.bytes ?? 0).toLocaleString()} bytes`} />
					<SingleTextBox label={t('Current Packets')} value={`${(data.packets ?? 0).toLocaleString()} packets`} />
				</Stack>

				{traffic_data && (
					<Stack alignItems="center">
						{/* Current Rate Display - Same style as DeltaTrafficCard */}
						<Box display="flex" justifyContent="space-between" alignItems="center" width="100%" mb={1}>
							<Typography variant="caption" color="textSecondary">
								{t('Current Rate')}
							</Typography>
							<RateTooltip rate={currentTrafficRate} unit={'bps'} title={t('Traffic Rate')}>
								<Typography variant="body2" fontWeight="bold" color="primary" sx={{cursor: 'help'}}>
									{formatRate(currentTrafficRate, 'bps')}
								</Typography>
							</RateTooltip>
						</Box>
						<RateLineGraph data={traffic_data} unit={'bps'} />
						<Typography variant="caption" color="textSecondary">
							{t('Traffic (bps)')}
						</Typography>
					</Stack>
				)}

				{packets_data && (
					<Stack alignItems="center">
						{/* Current Rate Display - Same style as DeltaTrafficCard */}
						<Box display="flex" justifyContent="space-between" alignItems="center" width="100%" mb={1}>
							<Typography variant="caption" color="textSecondary">
								{t('Current Rate')}
							</Typography>
							<RateTooltip rate={currentPacketRate} unit={'pps'} title={t('Packet Rate')}>
								<Typography variant="body2" fontWeight="bold" color="primary" sx={{cursor: 'help'}}>
									{formatRate(currentPacketRate, 'pps')}
								</Typography>
							</RateTooltip>
						</Box>
						<RateLineGraph data={packets_data} unit={'pps'} />
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

	const {data: ct_info, isError, refetch} = useConntrack(inst);

	// Filter states
	const [servNameFilter, setServNameFilter] = useState<string>('');
	const [sourceIPFilter, setSourceIPFilter] = useState<string>('');
	const [sourcePortFilter, setSourcePortFilter] = useState<string>('');
	const [destinationIPFilter, setDestinationIPFilter] = useState<string>('');
	const [destinationPortFilter, setDestinationPortFilter] = useState<string>('');

   const [selected_rows, set_selected_rows] = useState<number[]>([]);
   // Track selected servName for synchronization
   const [selected_servName, set_selected_servName] = useState<string | null>(null);
   // Apply filters and clear filters functions
   const applyFilters = useCallback(() => {
	   // Filters will be applied in the filteredCtAttr useMemo
   }, [servNameFilter, sourceIPFilter, sourcePortFilter, destinationIPFilter, destinationPortFilter]);

   const clearFilters = useCallback(() => {
	   setServNameFilter('');
	   setSourceIPFilter('');
	   setSourcePortFilter('');
	   setDestinationIPFilter('');
	   setDestinationPortFilter('');
   }, []);

   // Active filter count
   const activeFilterCount = [servNameFilter, sourceIPFilter, sourcePortFilter, destinationIPFilter, destinationPortFilter].filter(f => f).length;

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

   // Filter and sort ctAttr
   const filteredCtAttr = useMemo(() => {
	   if (!ct_info?.ctAttr) return [];
	   
	   let filtered = ct_info.ctAttr;
	   
	   // Apply filters
	   if (servNameFilter) {
		   filtered = filtered.filter(item => 
			   item.servName?.toLowerCase().includes(servNameFilter.toLowerCase())
		   );
	   }
	   if (sourceIPFilter) {
		   filtered = filtered.filter(item => 
			   item.sourceIP?.toLowerCase().includes(sourceIPFilter.toLowerCase())
		   );
	   }
	   if (sourcePortFilter) {
		   filtered = filtered.filter(item => 
			   item.sourcePort?.toString().includes(sourcePortFilter)
		   );
	   }
	   if (destinationIPFilter) {
		   filtered = filtered.filter(item => 
			   item.destinationIP?.toLowerCase().includes(destinationIPFilter.toLowerCase())
		   );
	   }
	   if (destinationPortFilter) {
		   filtered = filtered.filter(item => 
			   item.destinationPort?.toString().includes(destinationPortFilter)
		   );
	   }
	   
	   // Sort the filtered results
	   return filtered.sort((a, b) => getHashKey(a) - getHashKey(b));
   }, [ct_info?.ctAttr, servNameFilter, sourceIPFilter, sourcePortFilter, destinationIPFilter, destinationPortFilter]);

   const sortedCtAttr = filteredCtAttr;
   // Always map selected_rows (original index) to filtered/sorted index
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
		   {/* Filter Controls */}
		   <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, mb: 2 }}>
			   <Stack spacing={2}>
				   <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
					   <Stack direction="row" spacing={2} alignItems="center">
						   <TextField
							   size="small"
							   label={t('Service Name')}
							   value={servNameFilter}
							   onChange={(e) => setServNameFilter(e.target.value)}
							   sx={{ minWidth: 150 }}
						   />

						   <TextField
							   size="small"
							   label={t('Source IP')}
							   value={sourceIPFilter}
							   onChange={(e) => setSourceIPFilter(e.target.value)}
							   sx={{ minWidth: 150 }}
						   />

						   <TextField
							   size="small"
							   label={t('Source Port')}
							   value={sourcePortFilter}
							   onChange={(e) => setSourcePortFilter(e.target.value)}
							   sx={{ minWidth: 120 }}
						   />

						   <TextField
							   size="small"
							   label={t('Destination IP')}
							   value={destinationIPFilter}
							   onChange={(e) => setDestinationIPFilter(e.target.value)}
							   sx={{ minWidth: 150 }}
						   />

						   <TextField
							   size="small"
							   label={t('Destination Port')}
							   value={destinationPortFilter}
							   onChange={(e) => setDestinationPortFilter(e.target.value)}
							   sx={{ minWidth: 120 }}
						   />

						   {activeFilterCount > 0 && (
							   <Button variant="outlined" onClick={clearFilters}>
								   {t('Clear All')} ({activeFilterCount})
							   </Button>
						   )}
					   </Stack>
				   </Stack>

				   {/* Active Filters Display */}
				   {activeFilterCount > 0 && (
					   <Stack direction="row" spacing={1} flexWrap="wrap">
						   {servNameFilter && (
							   <Chip
								   label={`${t('Service Name')}: ${servNameFilter}`}
								   onDelete={() => setServNameFilter('')}
								   size="small"
							   />
						   )}
						   {sourceIPFilter && (
							   <Chip
								   label={`${t('Source IP')}: ${sourceIPFilter}`}
								   onDelete={() => setSourceIPFilter('')}
								   size="small"
							   />
						   )}
						   {sourcePortFilter && (
							   <Chip
								   label={`${t('Source Port')}: ${sourcePortFilter}`}
								   onDelete={() => setSourcePortFilter('')}
								   size="small"
							   />
						   )}
						   {destinationIPFilter && (
							   <Chip
								   label={`${t('Destination IP')}: ${destinationIPFilter}`}
								   onDelete={() => setDestinationIPFilter('')}
								   size="small"
							   />
						   )}
						   {destinationPortFilter && (
							   <Chip
								   label={`${t('Destination Port')}: ${destinationPortFilter}`}
								   onDelete={() => setDestinationPortFilter('')}
								   size="small"
							   />
						   )}
					   </Stack>
				   )}
			   </Stack>
		   </Box>

		   <ConntrackTable
			   data={{ctAttr: sortedCtAttr}}
			   selected_rows={selected_index !== -1 ? [selected_index] : []}
			   onRefresh={refetch}
			   error={isError}
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
				   <ConntrackPanel instance={inst} data={selected_attr} />
			   </LowerSection>
		   )}
	   </Fragment>
   );
}
