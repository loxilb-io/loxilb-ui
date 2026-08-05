//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {ArrowDropDown, ArrowDropUp} from '@mui/icons-material';
import {Collapse, List, ListItemButton, ListItemIcon, ListItemText} from '@mui/material';
import {get_menu_name_from_path, get_root_url, get_url_from_2_depth_name, get_url_from_3_depth_name} from 'common';
import useMenuState from 'hooks/menuHook';
import {useTranslation} from 'react-i18next';
import {Fragment, useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import {IMenuItem, MENU_LIST} from 'types/menu';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SlideMenuItem(props: {name: string; item: Omit<IMenuItem, 'name'>; path: string[]; depth: number; instance_name: string}) {
const {name: top_name, item, path, depth, instance_name} = props;
const { t } = useTranslation();

	const url = window.location.pathname;
	const root_url = get_root_url() + '/instance/';

	const navigate = useNavigate();
	const {closeAllMenuState, toggleMenuState, getMenuState} = useMenuState();

	const handleClick = () => {
		if (item.items) toggleMenuState(path);
		else {
			let url;
			switch (depth) {
				case 1:
					url = get_url_from_2_depth_name(MENU_LIST, top_name);
					break;
				case 2:
					url = get_url_from_3_depth_name(MENU_LIST, top_name);
					break;
				default:
					url = '/instance/' + item.path;
					break;
			}

			if (!item.items && depth === 0) closeAllMenuState();

			const jump_url = `${url}?name=${instance_name}`;
			navigate(jump_url, {replace: true});
		}
	};

	const is_selected = (name: string) => {
		const depth_2_name = get_menu_name_from_path(MENU_LIST, url, root_url, 2);
		const depth_3_name = get_menu_name_from_path(MENU_LIST, url, root_url, 3);

		if (depth === 1) return depth_2_name === name;
		else if (depth === 2) return depth_3_name === name;
		else return false;
	};

	useEffect(() => {
		const depth_2_name = get_menu_name_from_path(MENU_LIST, url, root_url, 2);
		const depth_3_name = get_menu_name_from_path(MENU_LIST, url, root_url, 3);

		if ((depth === 0 || depth === 1) && item.items) {
			const shouldExpand = item.items.some(child => child.name === depth_2_name || child.name === depth_3_name);
			if (shouldExpand) {
				const combined_path_array = [top_name, depth_2_name, depth_3_name].filter(Boolean);
				toggleMenuState(combined_path_array, true);
			}
		}
	}, []);

	return (
		<Fragment>
			<ListItemButton
				onClick={handleClick}
				sx={{
					pl: depth * 2 + 2,
					// Active route: brand-orange indicator (inset shadow so the text
					// doesn't shift) + a light tint of the same hue.
					...(is_selected(top_name)
						? {
								backgroundColor: 'rgba(210, 123, 36, 0.08)',
								boxShadow: theme => `inset 3px 0 0 ${theme.palette.secondary.main}`,
								'& .MuiListItemText-primary': {fontWeight: 600, color: 'primary.main'},
						  }
						: {}),
				}}
			>
				{item.icon && (
					<ListItemIcon>
						<item.icon />
					</ListItemIcon>
				)}

			   <ListItemText primary={t(top_name)} slotProps={{primary: {variant: depth === 0 ? 'subtitle1' : 'subtitle2'}}} />

				{item.items && item.items.length > 0 && (getMenuState(path) ? <ArrowDropDown /> : <ArrowDropUp />)}
			</ListItemButton>

		   {item.items && item.items.length > 0 && (
			   <Collapse in={getMenuState(path)} timeout="auto" unmountOnExit>
				   <List component="div" disablePadding>
					   {item.items.map((child, index) => (
						   <SlideMenuItem key={index} name={child.name} item={child} path={[...path, child.name]} depth={depth + 1} instance_name={instance_name} />
					   ))}
				   </List>
			   </Collapse>
		   )}
		</Fragment>
	);
}
