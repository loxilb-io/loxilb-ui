//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack, Typography} from '@mui/material';
import PieChartWithTitle from 'components/element/PieChartWithTitle';
import HorizontalStack from 'components/layout/HorizontalStack';
import {useLiveMetrics} from 'hooks/query/metricsHook';
import {useStatus} from 'hooks/query/statusHook';
import {t} from 'i18next';
import {useMemo} from 'react';
import {IInstance} from 'types/oam';
import {IPieChartData} from 'types/global';
import CardBase from './CardBase';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SystemUsageCard(props: {instance: IInstance | null}) {
	const {instance} = props;

	// Get live metrics with polling (same as ConnectionFlowCard)
	const {metrics: liveMetrics, isLoading} = useLiveMetrics(instance, {keyPrefix: 'system-usage-realtime', refetchInterval: 10000});

	// Helper function to convert single percentage to pie chart data.
	// Returns null — not a zeroed pie — when the backend does not report the
	// metric at all. Upstream loxilb exports no system utilization series, and
	// `usage || 0` used to turn that absence into a confident "0% used / 100%
	// available" pie: a claim about the system we have no evidence for.
	const createUsagePieData = (usage: number | undefined, label: string): IPieChartData[] | null => {
		if (usage === undefined || !Number.isFinite(usage)) return null;

		const usedValue = Math.min(Math.max(usage, 0), 100);
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
				cpu_usage: null,
				mem_usage: null,
				disk_usage: null
			};
		}

		return {
			cpu_usage: createUsagePieData(liveMetrics.critical.loxilb_system_cpu_utilization_percent, 'CPU'),
			mem_usage: createUsagePieData(liveMetrics.critical.loxilb_system_memory_utilization_percent, 'Memory'),
			disk_usage: createUsagePieData(liveMetrics.critical.loxilb_system_disk_utilization_percent, 'Disk')
		};
	}, [liveMetrics]);

	const {cpu_usage, mem_usage, disk_usage} = chartData;

	// A pie when the metric is reported, an explicit "not reported" placeholder
	// when it isn't. Same footprint either way so the card layout doesn't shift.
	const renderUsage = (title: string, data: IPieChartData[] | null) => {
		if (data) return <PieChartWithTitle title={title} data={data} />;

		return (
			<Box flexGrow={1} gap={2} display="flex" flexDirection="column" alignItems="center">
				<Typography variant="subtitle2" color="text.secondary">
					{title}
				</Typography>
				<Box width={230} height={200} display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap={1}>
					<Typography variant="h6" color="text.disabled">
						{t('N/A')}
					</Typography>
					<Typography variant="caption" color="text.secondary" textAlign="center">
						{t('Not reported by this instance')}
					</Typography>
				</Box>
			</Box>
		);
	};

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
					{renderUsage(t('CPU Usage'), cpu_usage)}
					{renderUsage(t('Memory Usage'), mem_usage)}
					{renderUsage(t('Disk Usage'), disk_usage)}
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
