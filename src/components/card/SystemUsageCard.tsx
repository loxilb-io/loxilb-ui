//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack, Typography} from '@mui/material';
import PieChartWithTitle from 'components/element/PieChartWithTitle';
import HorizontalStack from 'components/layout/HorizontalStack';
import {useQuery} from '@tanstack/react-query';
import {query_get_live_metrics} from 'connector/instance/metrics';
import {useStatus} from 'hooks/query/statusHook';
import {t} from 'i18next';
import {useMemo} from 'react';
import {IInstance} from 'types/oam';
import {ITypedLiveMetricsResponse} from 'types/metrics';
import {IPieChartData} from 'types/global';
import CardBase from './CardBase';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SystemUsageCard(props: {instance: IInstance | null}) {
	const {instance} = props;

	// Get live metrics with polling (same as ConnectionFlowCard)
	const {data: rawLiveMetrics, isLoading} = useQuery({
		queryKey: ['system-usage-realtime', instance?.id],
		queryFn: async () => {
			if (!instance) throw new Error('Instance is not defined');
			return await query_get_live_metrics(instance, 2);
		},
		enabled: !!instance,
		refetchInterval: 10000, // 10-second polling
		refetchIntervalInBackground: false,
		staleTime: 5000,
	});
	const liveMetrics = rawLiveMetrics as ITypedLiveMetricsResponse | undefined;

	// Helper function to convert single percentage to pie chart data
	const createUsagePieData = (usage: number | undefined, label: string): IPieChartData[] => {
		const usedValue = Math.min(Math.max(usage || 0, 0), 100);
		const availableValue = 100 - usedValue;
		
		return [
			{
				id: `${label.toLowerCase()}-used`,
				value: usedValue,
				label: t('Used')
			},
			{
				id: `${label.toLowerCase()}-available`, 
				value: availableValue,
				label: t('Available')
			}
		].filter(item => item.value > 0);
	};

	// Convert system metrics to pie chart data
	const chartData = useMemo(() => {
		if (!liveMetrics?.critical) {
			return {
				cpu_usage: [],
				mem_usage: [],
				disk_usage: []
			};
		}

		return {
			cpu_usage: createUsagePieData(liveMetrics.critical.loxilb_system_cpu_utilization_percent, 'CPU'),
			mem_usage: createUsagePieData(liveMetrics.critical.loxilb_system_memory_utilization_percent, 'Memory'),
			disk_usage: createUsagePieData(liveMetrics.critical.loxilb_system_disk_utilization_percent, 'Disk')
		};
	}, [liveMetrics]);

	const {cpu_usage, mem_usage, disk_usage} = chartData;

	// Get system info separately using useStatus hook
	const {processAttr, systemInfo, filesystemAttr} = useStatus(instance);

	// Loading state
	if (isLoading) {
		return (
			<CardBase title={t('System Usage')}>
				<Box display="flex" justifyContent="center" p={3}>
					<Typography variant="body2" color="textSecondary">Loading...</Typography>
				</Box>
			</CardBase>
		);
	}

	const renderTagBox = (label: string, value?: string) => {
		return (
			<Stack minWidth="120px" gap="10px">
				<Typography variant="subtitle2" sx={{userSelect: 'text'}}>
					{label}
				</Typography>

				<Typography variant="caption" color="text.secondary" sx={{userSelect: 'text'}}>
					{value ?? t('Available')}
				</Typography>
			</Stack>
		);
	};

	return (
		<CardBase title={t('System Usage')}>
			<Stack height="100%" justifyContent="space-between">
				<Box display="flex" marginTop="20px">
					<PieChartWithTitle title={t('CPU Usage')} data={cpu_usage} />
					<PieChartWithTitle title={t('Memory Usage')} data={mem_usage} />
					<PieChartWithTitle title={t('Disk Usage')} data={disk_usage} />
				</Box>

				<Stack justifyContent="space-between" gap="40px">
					<Box width="100%" display="flex" justifyContent="center">
						<Typography variant="subtitle2" color="text.secondary">
							{t('System Information')}
						</Typography>
					</Box>

					<HorizontalStack>
						<Stack gap="30px">
							{renderTagBox(t('Host Name'), systemInfo?.hostName)}
							{renderTagBox(t('Machine ID'), systemInfo?.machineID)}
						</Stack>

						<Stack gap="30px">
							{renderTagBox(t('Boot ID'), systemInfo?.bootID)}
							{renderTagBox(t('Kernel'), systemInfo?.kernel)}
						</Stack>

						<Stack gap="30px">
							{renderTagBox(t('Uptime'), systemInfo?.uptime)}
							{renderTagBox(t('Architecture'), systemInfo?.architecture)}
						</Stack>

						<Stack>{renderTagBox(t('OS'), systemInfo?.OS)}</Stack>
					</HorizontalStack>
				</Stack>
			</Stack>
		</CardBase>
	);
}
