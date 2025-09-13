//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import PersonIcon from '@mui/icons-material/Person';
import StorageIcon from '@mui/icons-material/Storage';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import {Box, IconButton, Tooltip, Typography} from '@mui/material';
import Logo from 'assets/logo/loxi.svg';
import {is_logged_in, move_home} from 'common';
import {t} from 'i18next';
import {Link} from 'react-router-dom';
import package_info from '../../../package.json';
import AlertsIcon from './AlertsIcon';
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

function ConfigIcon() {
	const config_status_message = t('Config Management');

	return (
		<Tooltip title={config_status_message} placement="top" arrow>
			<span>
				<IconButton component={Link} to="/config-management">
					<ImportExportIcon sx={{color: 'white'}} fontSize="small" />
				</IconButton>
			</span>
		</Tooltip>
	);
}

export default function Header() {
	const version = package_info.version;

	const is_enabled = is_logged_in();
	const VerticalDivider = () => <Box width="1px" height="20px" bgcolor="grey.700" />;

	return (
		<Box id="header" width="100%" display="flex" alignItems="center" justifyContent="space-between" bgcolor="primary.main" padding="6px 16px">
			<Box id="logo" display="flex" alignItems="center" gap="16px">
				<Box width="78px" component="img" src={Logo} alt="logo" onClick={() => move_home()} sx={{cursor: 'pointer'}} />

				<Box>
					<Typography variant="caption" color="white">
						{`v.${version}`}
					</Typography>
				</Box>
			</Box>

			{is_enabled && (
				<Box id="header-menu" display="flex" gap="16px" alignItems="center">
					<InstanceIcon />
					<VerticalDivider />

					<UserIcon />
					<VerticalDivider />

					<ConfigIcon />
					<VerticalDivider />
					
					{/*<AlertsIcon />
					<VerticalDivider /> */}

					<LanguageIcon />
					<VerticalDivider />

					<Profile />
				</Box>
			)}
		</Box>
	);
}
