//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack, Typography} from '@mui/material';
import PieChartWithTitle from 'components/element/PieChartWithTitle';
import HorizontalStack from 'components/layout/HorizontalStack';
import {extractTopCpuUsageData, extractTopDiskUsageData, extractTopMemoryUsageData} from 'connector/extracts';
import {useStatus} from 'hooks/query/statusHook';
import {t} from 'i18next';
import {IInstance} from 'types/oam';
import CardBase from './CardBase';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SystemUsageCard(props: {instance: IInstance | null}) {
	const {instance} = props;

	const {processAttr, systemInfo, filesystemAttr} = useStatus(instance); // ISystemInfo

	const cpu_usage = extractTopCpuUsageData(processAttr);
	const mem_usage = extractTopMemoryUsageData(processAttr);
	const disk_usage = extractTopDiskUsageData(filesystemAttr);

	const renderTagBox = (label: string, value?: string) => {
		return (
			<Stack minWidth="120px" gap="10px">
				<Typography variant="subtitle2" sx={{userSelect: 'text'}}>
					{label}
				</Typography>

				<Typography variant="caption" color="text.secondary" sx={{userSelect: 'text'}}>
					{value ?? t('N/A')}
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
