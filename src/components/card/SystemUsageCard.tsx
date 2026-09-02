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
import {derive_cpu_usage, derive_disk_usage, derive_memory_usage, IDerivedUsage} from 'utils/systemUsage';
import CardBase from './CardBase';
import MetricScrapeState from './MetricScrapeState';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SystemUsageCard(props: {instance: IInstance | null}) {
	const {instance} = props;

	// Get live metrics with polling (same as ConnectionFlowCard)
	const {metrics: liveMetrics, isLoading, failure: scrapeFailure, refetch: refetchMetrics} = useLiveMetrics(instance, {keyPrefix: 'system-usage-realtime', refetchInterval: 10000});

	// Get system info separately using useStatus hook
	const {processAttr, systemInfo, filesystemAttr} = useStatus(instance);

	// Helper function to convert single percentage to pie chart data.
	// Returns null — not a zeroed pie — when nothing reports the figure at all.
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

	// Two possible sources per figure, in preference order:
	//   1. the `loxilb_system_*_utilization_percent` Prometheus gauge, which
	//      measures the whole system directly — but which upstream loxilb does
	//      not publish at all;
	//   2. the /status/* endpoints (top, df) that both backends serve and this
	//      card already fetches for the System Information block.
	// Falling back to (2) is what puts real numbers on a loxilb dashboard. The
	// pie is captioned with whichever source produced it, because a `top`-derived
	// figure is a sum over the processes that got listed, not a system-wide
	// measurement — see utils/systemUsage.ts.
	const usage = useMemo(() => {
		const fromMetric = (value: number | undefined): IDerivedUsage | undefined =>
			value === undefined || !Number.isFinite(value) ? undefined : {percent: value, source: 'metrics'};

		const metrics = liveMetrics?.critical;
		return {
			cpu: fromMetric(metrics?.loxilb_system_cpu_utilization_percent) ?? derive_cpu_usage(processAttr),
			memory: fromMetric(metrics?.loxilb_system_memory_utilization_percent) ?? derive_memory_usage(processAttr),
			disk: fromMetric(metrics?.loxilb_system_disk_utilization_percent) ?? derive_disk_usage(filesystemAttr),
		};
	}, [liveMetrics, processAttr, filesystemAttr]);

	// A pie when something reports the figure, an explicit "not reported"
	// placeholder when nothing does. Same footprint either way so the card
	// layout doesn't shift.
	const renderUsage = (title: string, derived: IDerivedUsage | undefined) => {
		const data = createUsagePieData(derived?.percent, title);

		if (data) {
			return (
				<Box flexGrow={1} display="flex" flexDirection="column" alignItems="center">
					<PieChartWithTitle title={title} data={data} />
					{derived && derived.source !== 'metrics' && (
						<Typography variant="caption" color="text.secondary" textAlign="center">
							{derived.source === 'df'
								? t('From df ({{mount}})', {mount: derived.detail ?? '/'})
								: t('From top ({{processes}} processes)', {processes: derived.detail ?? '0'})}
						</Typography>
					)}
				</Box>
			);
		}

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

	// Loading state
	// A refused or disabled scrape is not this instance declining to publish a
	// metric — say which it was, instead of falling through to "not reported".
	if (scrapeFailure) return <MetricScrapeState title={t('System Usage')} failure={scrapeFailure} onRetry={refetchMetrics} />;

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
					{renderUsage(t('CPU Usage'), usage.cpu)}
					{renderUsage(t('Memory Usage'), usage.memory)}
					{renderUsage(t('Disk Usage'), usage.disk)}
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
