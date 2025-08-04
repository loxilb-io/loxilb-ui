//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import NotificationsIcon from '@mui/icons-material/Notifications';
import {Badge, Box} from '@mui/material';
import AlertList from 'components/modal/AlertList';
import {useAlertManager} from 'hooks/alertHook';
import {useState} from 'react';

//---------------------------------------------------------
// Components
//---------------------------------------------------------
export default function AlertsIcon() {
	const {has_new_alert} = useAlertManager();

	const [anchor_element_alert, set_anchor_element_alert] = useState<null | HTMLElement>(null);

	const toggle_menu_alert = (event: any) => {
		if (anchor_element_alert) set_anchor_element_alert(null);
		else set_anchor_element_alert(event?.currentTarget);
	};

	return (
		<Box id="alert" onClick={toggle_menu_alert} sx={{cursor: 'pointer'}}>
			<AlertList anchorEl={anchor_element_alert} handleClose={() => set_anchor_element_alert(null)} />

			<Badge color="error" variant={has_new_alert ? 'dot' : 'standard'}>
				<NotificationsIcon sx={{color: 'white'}} fontSize="small" />
			</Badge>
		</Box>
	);
}
