//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, styled} from '@mui/material';
import SideMenu from 'components/menu/SideMenu';
import TopNavMenu from 'components/menu/TopNavMenu';
import useLocalStorageState from 'hooks/localStorageHook';
import {ReactNode} from 'react';
import {useLocation} from 'react-router-dom';
import ScrollableBox from './ScrollableBox';

//---------------------------------------------------------
// Styled Components
//---------------------------------------------------------
const Main = styled(Box, {shouldForwardProp: prop => prop !== 'open'})<{open?: boolean}>(({theme, open}) => ({
	width: '100%',
	height: '100%',

	transition: theme.transitions.create(['margin', 'width'], {
		easing: theme.transitions.easing.sharp,
		duration: theme.transitions.duration.leavingScreen,
	}),

	marginLeft: 0,
	...(open && {
		transition: theme.transitions.create(['margin', 'width'], {
			easing: theme.transitions.easing.easeOut,
			duration: theme.transitions.duration.enteringScreen,
		}),
		marginLeft: '300px',
		width: 'calc(100% - 300px)',
	}),
}));

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SideMenuNav(props: {children?: ReactNode}) {
	const {children} = props;

	const [is_open, _] = useLocalStorageState('is_open_side_menu', true);
	const cur_location = useLocation();
	const bgcolor = cur_location.pathname.includes('dashboard') ? 'grey.100' : 'white';

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
