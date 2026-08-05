//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import BarChartIcon from '@mui/icons-material/BarChart';
import {Box, Divider, Drawer, IconButton, List, ListSubheader, Tooltip, Typography} from '@mui/material';
import {get_url_from_2_depth_name, get_url_from_3_depth_name} from 'common';
import SlideMenuItem from 'components/menu/SlideMenuItem';
import {useInstanceName} from 'hooks/query/instanceHook';
import {useRole} from 'hooks/query/oamHooks';
import {useTranslation} from 'react-i18next';
import {Link, useNavigate} from 'react-router-dom';
import {IMenuItem, MENU_LIST} from 'types/menu';

export const SIDE_MENU_WIDTH = 300;
export const SIDE_MENU_RAIL_WIDTH = 64;

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SideMenu(props: {open: boolean}) {
	const {open} = props;
	const {t} = useTranslation();

	const inst_name = useInstanceName();
	const instance_url = `/instance/dashboard?name=${inst_name}`;
	const navigate = useNavigate();

	// RBAC: hide menu entries restricted to other roles. Items
	// without a roles list are visible to everyone.
	const {role} = useRole();
	const visible = (item: IMenuItem) => !item.roles || (role !== null && item.roles.includes(role));
	const menu_items = MENU_LIST.filter(visible).map(item => (item.items ? {...item, items: item.items.filter(visible)} : item));

	// Rail icons deep-link to the group's first visible page (one click from
	// the Traffic icon to LB Rule), mirroring what expanding + clicking the
	// first entry would do.
	const rail_url = (item: IMenuItem): string => {
		if (!item.items || item.items.length === 0) return '/instance/' + item.path;
		const first = item.items[0];
		if (first.items && first.items.length > 0) return get_url_from_3_depth_name(MENU_LIST, first.items[0].name);
		return get_url_from_2_depth_name(MENU_LIST, first.name);
	};

	const width = open ? SIDE_MENU_WIDTH : SIDE_MENU_RAIL_WIDTH;

	return (
		<Drawer
			open
			variant="persistent"
			sx={{
				height: '100%',
				'& .MuiDrawer-paper': {
					position: 'absolute',
					width: `${width}px`,
					height: '100%',
					overflowX: 'hidden',
					transition: theme => theme.transitions.create('width', {duration: theme.transitions.duration.shorter}),
				},
			}}
		>
			{open ? (
				<List
					subheader={
						<ListSubheader>
							<Link to={instance_url} style={{textDecoration: 'none'}}>
								<Box display="flex" alignItems="center" justifyContent="space-between" padding="14px 0" borderBottom="1px solid" borderColor="divider">
									<Typography variant="h6" color="text.primary" noWrap>
										{inst_name}
									</Typography>

									<BarChartIcon sx={{color: 'text.secondary'}} fontSize="small" />
								</Box>
							</Link>
						</ListSubheader>
					}
				>
					{menu_items.map((item, index) => (
						<SlideMenuItem key={index} instance_name={inst_name} name={item.name} item={item} path={[item.name]} depth={0} />
					))}
				</List>
			) : (
				<Box display="flex" flexDirection="column" alignItems="center" paddingTop="8px" gap="4px">
					<Tooltip title={t('Dashboard')} placement="right" arrow>
						<IconButton component={Link} to={instance_url}>
							<BarChartIcon />
						</IconButton>
					</Tooltip>

					<Divider flexItem sx={{margin: '4px 12px'}} />

					{menu_items.map((item, index) => {
						const Icon = item.icon;
						if (!Icon) return null;
						return (
							<Tooltip key={index} title={t(item.name)} placement="right" arrow>
								<IconButton onClick={() => navigate(`${rail_url(item)}?name=${inst_name}`, {replace: true})}>
									<Icon fontSize="small" />
								</IconButton>
							</Tooltip>
						);
					})}
				</Box>
			)}
		</Drawer>
	);
}
