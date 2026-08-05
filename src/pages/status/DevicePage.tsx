//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Stack} from '@mui/material';
import SingleTextBox from 'components/element/SingleTextBox';
import ValueBunch from 'components/element/ValueBunch';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useDeviceStatus} from 'hooks/query/deviceHooks';
import {t} from 'i18next';
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
		bootTime: '',
	};

	return (
		<Stack spacing={3}>
			<ValueBunch name={t('Device Details')}>
				{/* Machine ID / Boot ID are 32-char hashes and UUIDs — they need the
				    wide column to stay on one line. */}
				<SingleTextBox label={t('Machine ID')} value={device_info.machineID} width="wide" />
				<SingleTextBox label={t('Host Name')} value={device_info.hostName} width="wide" />
				<SingleTextBox label={t('Boot ID')} value={device_info.bootID} width="wide" />
			</ValueBunch>

			<ValueBunch name={t('System Information')}>
				<SingleTextBox label={t('OS')} value={device_info.OS} width="wide" />
				<SingleTextBox label={t('Kernel')} value={device_info.kernel} width="wide" />
				<SingleTextBox label={t('Architecture')} value={device_info.architecture} width="wide" />
			</ValueBunch>

			<ValueBunch name={t('Device Status')}>
				<SingleTextBox label={t('Boot Up')} value={device_info.bootTime} width="wide" />
				<SingleTextBox label={t('Uptime')} value={device_info.uptime} width="wide" />
			</ValueBunch>
		</Stack>
	);
}
