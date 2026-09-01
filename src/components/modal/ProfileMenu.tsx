//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import {Box, Divider, Menu, MenuItem, Stack, Typography} from '@mui/material';
import {terminateSession} from 'session/session';
import {request_logout} from 'connector/oam/oam';
import {usePopUp} from 'hooks/popupHook';
import {t} from 'i18next';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function ProfileMenu(props: {user_name: string; user_id: string; user_email: string; anchorEl: HTMLElement | null; handleClose: () => void}) {
	const {user_name, user_id, user_email, anchorEl, handleClose} = props;
	const {openPopUp} = usePopUp();

	const handleSignOut = () => {
		openPopUp(t('Sign out'), t('Are you sure you want to sign out?'), t('Yes'), t('Cancel'), async () => {
			// Invalidate server-side first (best-effort), then clear local state.
			await request_logout();
			// One teardown for every way a session can end (UI-P6-4). Removing
			// just `access_token` left the persisted React Query cache — LB
			// rules, endpoints, API-key metadata, user lists — readable in
			// localStorage by whoever used the terminal next (ES-22).
			await terminateSession('logout');
		});
	};

	return (
		<Menu anchorEl={anchorEl} open={!!anchorEl} onClose={handleClose} disableEnforceFocus disableAutoFocusItem MenuListProps={{'aria-labelledby': 'basic-button'}}>
			<Box display="flex" alignItems="center" gap="20px" padding="8px 16px" minWidth="180px">
				<AccountCircleIcon fontSize="large" sx={{color: 'action.active'}} />

				<Stack>
					<Typography variant="body1">{user_name}</Typography>
					<Typography variant="body2">{user_email}</Typography>
					<Typography variant="body2" color="text.secondary">
						{t('ID {{user_id}}', {user_id})}
					</Typography>
				</Stack>
			</Box>

			<Divider />

			<MenuItem onClick={handleSignOut}>
				<LogoutIcon sx={{color: 'grey.700'}} />
				<Typography variant="body1" marginLeft="8px">
					{t('Sign out')}
				</Typography>
			</MenuItem>
		</Menu>
	);
}
