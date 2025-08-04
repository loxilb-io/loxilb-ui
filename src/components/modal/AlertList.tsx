//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Menu, MenuItem, Stack, Typography} from '@mui/material';
import AlertCard from 'components/card/AlertCard';
import {useAlertManager} from 'hooks/alertHook';
import {t} from 'i18next';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function AlertList(props: {anchorEl: HTMLElement | null; handleClose: () => void}) {
	const {anchorEl, handleClose} = props;

	const {alerts, delete_alerts, resolve_alert} = useAlertManager();

	return (
		<Menu anchorEl={anchorEl} open={!!anchorEl} onClose={handleClose} disableEnforceFocus disableAutoFocusItem>
			<Box id="name-box" padding="8px 16px 16px 16px" borderBottom={1} borderColor="grey.300" position="sticky" top={0}>
				<Typography variant="h6">{t('Alerts')}</Typography>
			</Box>

			<Box
				paddingTop="8px"
				sx={{
					maxHeight: 'calc(500px - 60px)',
					overflow: 'auto',
					'& .MuiMenuItem-root:hover': {backgroundColor: 'transparent'},
					'& .MuiMenuItem-root': {padding: '8px'},
					'& .MuiTouchRipple-root': {display: 'none'},
				}}
			>
				{alerts.map(alert => (
					<MenuItem key={alert.id} sx={{cursor: 'default'}}>
						<Stack direction="row" alignItems="center" justifyContent="space-between" width="100%">
							<AlertCard data={alert} handleResolve={resolve_alert} handleDelete={delete_alerts} />
						</Stack>
					</MenuItem>
				))}

				{alerts.length === 0 && (
					<Box padding="16px" textAlign="center">
						<Typography variant="body2" color="text.secondary">
							{t('No alerts available')}
						</Typography>
					</Box>
				)}
			</Box>
		</Menu>
	);
}
