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

	// Braces matter: an implicit return hands window.scrollTo's return value to
	// React as a "cleanup function" — anything non-undefined (e.g. a patched
	// scrollTo from a polyfill/extension) crashes unmount with
	// "destroy is not a function".
	useEffect(() => {
		window.scrollTo(0, 0);
	}, [pathname]);

	return <Fragment />;
}
