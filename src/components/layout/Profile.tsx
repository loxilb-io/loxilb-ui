//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import {Box, Typography} from '@mui/material';
import ProfileMenu from 'components/modal/ProfileMenu';
import {useMyInfo} from 'hooks/query/oamHooks';
import {useState} from 'react';

//---------------------------------------------------------
// Components
//---------------------------------------------------------
export default function Profile() {
	const my_info = useMyInfo();

	const user_name = my_info?.username || 'Guest';
	const user_id = (my_info?.id || 0).toString();
	const user_license = my_info?.email || '';

	const toggle_menu = (event: any) => {
		if (anchor_element) set_anchor_element(null);
		else set_anchor_element(event?.currentTarget);
	};

	const [anchor_element, set_anchor_element] = useState<null | HTMLElement>(null);

	return (
		<Box id="profile" display="flex" alignItems="center" gap="10px" onClick={toggle_menu} sx={{cursor: 'pointer'}}>
			<ProfileMenu anchorEl={anchor_element} handleClose={() => set_anchor_element(null)} user_name={user_name} user_id={user_id} user_license={user_license} />

			<AccountCircleIcon sx={{color: 'white'}} fontSize="small" />

			<Typography variant="subtitle2" color="white">
				{user_name}
			</Typography>

			<ArrowDropDownIcon sx={{color: 'white'}} fontSize="small" />
		</Box>
	);
}
