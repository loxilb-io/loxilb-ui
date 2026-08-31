//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import {Box, Button, capitalize, Divider, FormControl, FormControlLabel, Radio, RadioGroup, Stack, Typography} from '@mui/material';
import 'components/animation/Loader.css';
import ValueBunch from 'components/element/ValueBunch';
import {request_post_log_level} from 'connector/instance/status';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {usePopUp} from 'hooks/popupHook';
import {useLogLevel} from 'hooks/query/statusHook';
import {t} from 'i18next';
import {useState, useEffect} from 'react';
import {LevelType, LevelTypeList} from 'types/log';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- parked feature code kept for re-enablement; remove the disable when it is wired back up or deleted
function FirmwareAvailablePannel(props: {handleUpdate: () => void}) {
	const {handleUpdate} = props;

	const version = '1.0.0';
	const desc = t('A new firmware version is available for your load balancer.\nUpdating the latest version ensures improved performance, security patches and new features.');
	const update_desc: string[] = [t('Bug fixes and security improvements'), t('Performance enhancements'), t('New features')];

	return (
		<Stack id="firmware" spacing={2}>
			<Typography variant="h6">{t('Firmware Update')}</Typography>

			<Stack>
				<ValueBunch>
					<Typography variant="subtitle2">{t('Avaliable Version')}</Typography>

					<Typography variant="subtitle2" color="textSecondary">
						{version}
					</Typography>
				</ValueBunch>

				<Typography variant="body2" whiteSpace="pre-wrap">
					{desc}
				</Typography>
			</Stack>

			<Typography variant="subtitle2">{t(`What's New:`)}</Typography>

			<Stack>
				{update_desc.map((desc, index) => (
					<Typography key={index} variant="body2">
						{`· ${desc}`}
					</Typography>
				))}
			</Stack>

			<Box>
				<Button variant="contained" color="secondary" onClick={handleUpdate}>
					{t('Update')}
				</Button>
			</Box>
		</Stack>
	);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- parked feature code kept for re-enablement; remove the disable when it is wired back up or deleted
function FirmwareUpdatingPannel() {
	return (
		<Stack width="100%" height="100%">
			<Typography variant="h6">{t('Firmware Update')}</Typography>

			<Stack width="100%" height="100%" justifyContent="center" alignItems="center" spacing={2}>
				<Box height="60px">
					<span className="loader" />
				</Box>

				<Typography variant="body2" width="100%" textAlign="center" color="text.secondary">
					{t('Updating...')}
				</Typography>

				<Button variant="contained" color="primary">
					{t('Cancel')}
				</Button>
			</Stack>
		</Stack>
	);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- parked feature code kept for re-enablement; remove the disable when it is wired back up or deleted
function FirmwareResultPannel(props: {is_success: boolean}) {
	const {is_success} = props;

	const success_msg = t('The firmware update has been successfully installed.\nYour load balancer will be restarted shortly.\nPlease wait for the system to fully reboot.');
	const failure_msg = t('There was an error during the firmware update.\nPlease try the update again.');

	return (
		<Stack width="100%" height="100%">
			<Typography variant="h6">{t('Firmware Update')}</Typography>

			<Stack width="100%" height="100%" justifyContent="center" alignItems="center" spacing={2}>
				<Stack alignItems="center">
					{is_success ? <CheckCircleIcon color={is_success ? 'success' : 'error'} sx={{fontSize: 24}} /> : <ErrorIcon color="error" sx={{fontSize: 24}} />}
					<Typography variant="h6" color={is_success ? 'success' : 'error'}>
						{is_success ? t('Update Successful') : t('Update Failed')}
					</Typography>
				</Stack>

				<Typography variant="body2" width="400px" textAlign="center" whiteSpace="pre-wrap">
					{is_success ? success_msg : failure_msg}
				</Typography>

				{!is_success && (
					<Box>
						<Button variant="contained" color="secondary">
							{t('Retry')}
						</Button>
					</Box>
				)}
			</Stack>
		</Stack>
	);
}

function LogLevelSelector() {
	const inst = useInstanceFromURL();
	const {openPopUp} = usePopUp();
	const {data: logLevelData} = useLogLevel(inst);
	
	// Initialize with fetched log level or default to 'warning'
	const [selected_level, set_selected_level] = useState<LevelType>('warning');
	
	// Update selected_level when data is fetched
	useEffect(() => {
		if (logLevelData?.logLevel) {
			set_selected_level(logLevelData.logLevel as LevelType);
		}
	}, [logLevelData]);

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (!inst) return;

		const new_value = event.target.value as LevelType;

		openPopUp(t('Log Level Change'), t('Do you want to change the log level to {{level}}?', {level: new_value}), t('Change'), t('Cancel'), async () => {
			const res = await request_post_log_level(inst, new_value);
			if (res.status === 'success') {
				set_selected_level(new_value);
				openPopUp(t('Success'), t('Log level changed successfully.'), t('OK'));
			} else openPopUp(t('Error'), t('Failed to change log level: {{error}}', {error: res.error}), t('OK'));
		});
	};

	return (
		<Stack id="log-level" spacing={2}>
			<Typography variant="h6">{t('Log Level')}</Typography>

			<FormControl>
				<RadioGroup row aria-labelledby="row-radio-buttons-group-label" name="row-radio-buttons-group" value={selected_level} onChange={handleChange}>
					{LevelTypeList.map(level => (
						<FormControlLabel key={level} value={level} control={<Radio color="secondary" size="small" />} label={capitalize(level)} />
					))}
				</RadioGroup>
			</FormControl>
		</Stack>
	);
}

export default function InstanceSettingPage() {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- parked feature code kept for re-enablement; remove the disable when it is wired back up or deleted
	const [is_success, set_is_success] = useState(true);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- parked feature code kept for re-enablement; remove the disable when it is wired back up or deleted
	const [is_updated, set_is_updated] = useState(false);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- parked feature code kept for re-enablement; remove the disable when it is wired back up or deleted
	const [is_updating, set_is_updating] = useState(false);
	const {openPopUp} = usePopUp();

	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- parked feature code kept for re-enablement; remove the disable when it is wired back up or deleted
	const handleUpdate = () => {
		const message = t(
			'You are about to update the firmware of your load balancer. The update may take a few minutes and will require a system reboot. Do you want to proceed?',
		);

		openPopUp(t('Confirm Firmware Update'), message, t('Proceed'), t('Cancel'), () => {
			set_is_updating(true);
			setTimeout(() => set_is_updated(true), 5000);
		});
	};

	return (
		<Stack spacing={2} height="100%">
			<LogLevelSelector />

			<Divider />
{/* 
			{!is_updated && !is_updating && <FirmwareAvailablePannel handleUpdate={handleUpdate} />}
			{!is_updated && is_updating && <FirmwareUpdatingPannel />}
			{is_updated && <FirmwareResultPannel is_success={is_success} />} */}
		</Stack>
	);
}
