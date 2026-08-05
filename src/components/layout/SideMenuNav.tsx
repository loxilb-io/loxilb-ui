//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, styled} from '@mui/material';
import SideMenu, {SIDE_MENU_RAIL_WIDTH, SIDE_MENU_WIDTH} from 'components/menu/SideMenu';
import TopNavMenu from 'components/menu/TopNavMenu';
import useLocalStorageState from 'hooks/localStorageHook';
import {ReactNode} from 'react';
import {useLocation} from 'react-router-dom';
import ScrollableBox from './ScrollableBox';

//---------------------------------------------------------
// Styled Components
//---------------------------------------------------------
// Collapsed no longer means hidden: the drawer shrinks to a 64px icon rail
// (SIDE_MENU_RAIL_WIDTH), so navigation is always one click away.
const Main = styled(Box, {shouldForwardProp: prop => prop !== 'open'})<{open?: boolean}>(({theme, open}) => ({
	height: '100%',

	transition: theme.transitions.create(['margin', 'width'], {
		easing: theme.transitions.easing.sharp,
		duration: theme.transitions.duration.leavingScreen,
	}),

	marginLeft: `${SIDE_MENU_RAIL_WIDTH}px`,
	width: `calc(100% - ${SIDE_MENU_RAIL_WIDTH}px)`,
	...(open && {
		transition: theme.transitions.create(['margin', 'width'], {
			easing: theme.transitions.easing.easeOut,
			duration: theme.transitions.duration.enteringScreen,
		}),
		marginLeft: `${SIDE_MENU_WIDTH}px`,
		width: `calc(100% - ${SIDE_MENU_WIDTH}px)`,
	}),
}));

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SideMenuNav(props: {children?: ReactNode}) {
	const {children} = props;

	const [is_open, _] = useLocalStorageState('is_open_side_menu', true);
	const cur_location = useLocation();
	const bgcolor = cur_location.pathname.includes('dashboard') ? 'background.default' : 'white';

	return (
		<Box width="100%" height="100%" display="flex" flexDirection="column">
			<TopNavMenu />

			<Box position="relative" display="flex" width="100%" flexGrow={1}>
				<SideMenu open={is_open} />

				<Main open={is_open}>
					<ScrollableBox bgcolor={bgcolor}>{children}</ScrollableBox>
				</Main>
			</Box>
		</Box>
	);
}
