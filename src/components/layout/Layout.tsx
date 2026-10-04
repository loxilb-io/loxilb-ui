//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box} from '@mui/material';
import {Outlet} from 'react-router-dom';
import Footer from './Footer';
import Header from './Header';
import InsetArea from './InsetArea';
import {PageHeading} from './RouteTitle';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function Layout(props: {hide_header?: boolean}) {
	const {hide_header} = props;

	return (
		<InsetArea>
			<Box id="layout" width="100%" height="100%" display="flex" flexDirection="column" alignItems="center">
				{!hide_header && <Header />}

				<Box id="outlet" component="main" width="100%" flexGrow={1}>
					{/* First inside <main>, so the page's name is the first thing a
					    screen reader meets after the landmarks — and before the
					    navigation, whose entries are deliberately not headings. */}
					<PageHeading />
					<Outlet />
				</Box>

				<Footer variant={hide_header ? 'dark' : 'light'} />
			</Box>
		</InsetArea>
	);
}
