//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Fragment, useEffect} from 'react';
import {useLocation} from 'react-router';

//---------------------------------------------------------
// API Functions
//---------------------------------------------------------
export default function ScrollToTop() {
	const {pathname} = useLocation();

	useEffect(() => window.scrollTo(0, 0), [pathname]);

	return <Fragment />;
}
