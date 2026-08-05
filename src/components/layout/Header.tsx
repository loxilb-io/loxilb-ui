//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import PersonIcon from '@mui/icons-material/Person';
import StorageIcon from '@mui/icons-material/Storage';
import {Box, IconButton, Tooltip, Typography} from '@mui/material';
import Logo from 'assets/logo/loxi.svg';
import {is_logged_in, move_home} from 'common';
import {t} from 'i18next';
import {Link} from 'react-router-dom';
import package_info from '../../../package.json';
import LanguageIcon from './LanguageIcon';
import Profile from './Profile';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
function InstanceIcon() {
	const return_message = t(`Return to Screen to 'Instances'`);

	return (
		<Tooltip title={return_message} placement="top" arrow>
			<span>
				<IconButton component={Link} to="/instance">
					<StorageIcon sx={{color: 'white'}} fontSize="small" />
				</IconButton>
			</span>
		</Tooltip>
	);
}

function UserIcon() {
	const user_status_message = t('User Management');

	return (
		<Tooltip title={user_status_message} placement="top" arrow>
			<span>
				<IconButton component={Link} to="/user">
					<PersonIcon sx={{color: 'white'}} fontSize="small" />
				</IconButton>
			</span>
		</Tooltip>
	);
}

export default function Header() {
	const version = package_info.version;

	const is_enabled = is_logged_in();

	return (
		<Box id="header" width="100%" height="48px" display="flex" alignItems="center" justifyContent="space-between" bgcolor="primary.main" padding="0 16px">
			<Box id="logo" display="flex" alignItems="center" gap="12px">
				<Box width="64px" component="img" src={Logo} alt="logo" onClick={() => move_home()} sx={{cursor: 'pointer'}} />

				<Typography variant="caption" sx={{color: 'rgba(255, 255, 255, 0.65)'}}>
					{`v.${version}`}
				</Typography>
			</Box>

			{is_enabled && (
				<Box id="header-menu" display="flex" gap="20px" alignItems="center">
					<InstanceIcon />
					<UserIcon />
					<LanguageIcon />
					<Profile />
				</Box>
			)}
		</Box>
	);
}
