//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Outlet} from 'react-router-dom';
import BGImage from './BGImage';
import SideMenuNav from './SideMenuNav';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function NavLayout() {
	return (
		<SideMenuNav>
			<Outlet />
			<BGImage />
		</SideMenuNav>
	);
}
