//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import BarChartIcon from '@mui/icons-material/BarChart';
import {Box, Drawer, List, ListSubheader, Typography} from '@mui/material';
import SlideMenuItem from 'components/menu/SlideMenuItem';
import {useInstanceName} from 'hooks/query/instanceHook';
import {Link} from 'react-router-dom';
import {MENU_LIST} from 'types/menu';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SideMenu(props: {open: boolean}) {
	const {open} = props;

	const inst_name = useInstanceName();
	const instance_url = `/instance/dashboard?name=${inst_name}`;

	return (
		<Drawer open={open} variant="persistent" sx={{height: '100%', '& .MuiDrawer-paper': {position: 'absolute', width: '300px', height: '100%'}}}>
			<List
				subheader={
					<ListSubheader>
						<Link to={instance_url} style={{textDecoration: 'none'}}>
							<Box display="flex" alignItems="center" gap="10px">
								<Typography variant="h6" padding="16px 0px" color="black">
									{inst_name}
								</Typography>

								<BarChartIcon sx={{color: '#707070'}} />
							</Box>
						</Link>
					</ListSubheader>
				}
			>
				{MENU_LIST.map((item, index) => (
					<SlideMenuItem key={index} instance_name={inst_name} name={item.name} item={item} path={[item.name]} depth={0} />
				))}
			</List>
		</Drawer>
	);
}
