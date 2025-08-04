//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack} from '@mui/material';
import BG from 'assets/image/instance_bg.svg';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useDeviceStatus} from 'hooks/query/deviceHooks';
import {t} from 'i18next';
import {useMemo} from 'react';
import {ISystemInfo} from 'types/device';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function DevicePage() {
	const inst = useInstanceFromURL();

	const {data} = useDeviceStatus(inst);
	const device_info: ISystemInfo = data ?? {
		machineID: '',
		hostName: '',
		bootID: '',
		OS: '',
		kernel: '',
		architecture: '',
		uptime: '0d 0h 0m',
	};

	const boot_up = useMemo(() => {
		const uptime_str = device_info.uptime?.trim(); // "2938518.46 5852110.16"
		if (!uptime_str) return '';

		const parts = uptime_str.split(' ');
		const uptime_seconds = parseFloat(parts[0]);

		if (isNaN(uptime_seconds)) return '';

		const bootTime = new Date(Date.now() - uptime_seconds * 1000).toLocaleString();
		return bootTime;
	}, [device_info.uptime]);

	return (
		<Stack spacing={3}>
			<ValueBunch name={t('Device Details')}>
				<SingleTextBox label={t('Machine ID')} value={device_info.machineID} />
				<SingleTextBox label={t('Host Name')} value={device_info.hostName} />
				<SingleTextBox label={t('Boot ID')} value={device_info.bootID} />
			</ValueBunch>

			<ValueBunch name={t('System Information')}>
				<SingleTextBox label={t('OS')} value={device_info.OS} />
				<SingleTextBox label={t('Kernel')} value={device_info.kernel} />
				<SingleTextBox label={t('Architecture')} value={device_info.architecture} />
			</ValueBunch>

			<ValueBunch name={t('Device Status')}>
				<SingleTextBox label={t('Boot Up')} value={boot_up} />
				<SingleTextBox label={t('Uptime')} value={device_info.uptime} />
			</ValueBunch>

			<Box position="absolute" right="32px" bottom="16px" component="img" src={BG} zIndex={1} width="250px" />
		</Stack>
	);
}
