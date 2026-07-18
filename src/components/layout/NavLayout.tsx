//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Outlet, useLocation} from 'react-router-dom';
import BGImage from './BGImage';
import RouteErrorBoundary from './RouteErrorBoundary';
import SideMenuNav from './SideMenuNav';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function NavLayout() {
	const location = useLocation();
	return (
		<SideMenuNav>
			{/* A page throw must not unmount the header / side-nav; contain it here
			    and reset the boundary whenever the route changes. */}
			<RouteErrorBoundary resetKey={location.pathname}>
				<Outlet />
			</RouteErrorBoundary>
			<BGImage />
		</SideMenuNav>
	);
}
