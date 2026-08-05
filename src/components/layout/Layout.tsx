//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box} from '@mui/material';
import {Outlet} from 'react-router-dom';
import Footer from './Footer';
import Header from './Header';
import InsetArea from './InsetArea';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function Layout(props: {hide_header?: boolean}) {
	const {hide_header} = props;

	return (
		<InsetArea>
			<Box id="layout" width="100%" height="100%" display="flex" flexDirection="column" alignItems="center">
				{!hide_header && <Header />}

				<Box id="outlet" width="100%" flexGrow={1}>
					<Outlet />
				</Box>

				<Footer variant={hide_header ? 'dark' : 'light'} />
			</Box>
		</InsetArea>
	);
}
