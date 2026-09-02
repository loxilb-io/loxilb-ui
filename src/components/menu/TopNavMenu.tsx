//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Breadcrumbs, Typography} from '@mui/material';
import {get_menu_name_from_path, get_menu_root, get_root_url} from 'common';
import FlavorBadge from 'components/element/FlavorBadge';
import SimpleButton from 'components/element/SimpleButton';
import useLocalStorageState from 'hooks/localStorageHook';
import {DEFAULT_SIDE_MENU_OPEN, PREFERENCE_KEYS, isBooleanPreference} from 'preferences';
import {useInstanceFromURL} from 'hooks/instanceHook';
import {useInstanceName} from 'hooks/query/instanceHook';
import {Link} from 'react-router-dom';
import {MENU_LIST} from 'types/menu';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function TopNavMenu() {
	const [_, set_is_open] = useLocalStorageState(PREFERENCE_KEYS.sideMenuOpen, DEFAULT_SIDE_MENU_OPEN, isBooleanPreference);
	const instance_name = useInstanceName();
	const instance = useInstanceFromURL();

	const url = window.location.pathname;
	const root_url = get_root_url() + '/instance/';

	const depth_1_name = get_menu_name_from_path(MENU_LIST, url, root_url, 1);
	const depth_2_name = get_menu_name_from_path(MENU_LIST, url, root_url, 2);

	return (
		<Box width="100%" display="flex" alignItems="center" justifyContent="flex-start" bgcolor="background.paper" borderBottom="1px solid" borderColor="divider" padding="4px 16px">
			<SimpleButton type="menu" onClick={() => set_is_open(prev => !prev)} />

			<Box id="navigation" paddingLeft="16px">
				<Breadcrumbs>
					{instance_name && (
						<Box display="flex" alignItems="center" gap="6px">
							<Typography variant="body2" color="primary">
								{instance_name}
							</Typography>
							<FlavorBadge instance={instance} />
						</Box>
					)}

					{depth_1_name && (
						<Link to={get_menu_root(depth_1_name) + `?name=${instance_name}`}>
							<Typography variant="body2" color="primary">
								{depth_1_name}
							</Typography>
						</Link>
					)}

					{depth_2_name && (
						<Link to={get_menu_root(depth_2_name) + `?name=${instance_name}`}>
							<Typography variant="body2" color="primary">
								{depth_2_name}
							</Typography>
						</Link>
					)}
				</Breadcrumbs>
			</Box>
		</Box>
	);
}
