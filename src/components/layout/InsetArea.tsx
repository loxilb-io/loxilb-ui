//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box} from '@mui/material';
import {is_mobile_device, prevent_scroll} from 'common';
import {ReactNode} from 'react';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function InsetArea(props: {fill_top?: boolean; children: ReactNode}) {
	const {fill_top, children} = props;

	const inset_top = fill_top ? 0 : 'env(safe-area-inset-top)';

	return (
		<Box id="inset-area" width="100%" height={is_mobile_device() ? window.innerHeight : '100vh'} display="flex" flexDirection="column" alignItems="center" paddingTop={inset_top} sx={prevent_scroll}>
			{children}
		</Box>
	);
}
