//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack, Typography} from '@mui/material';
import {ReactNode} from 'react';
import {Link} from 'react-router-dom';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function CardBase(props: {children: ReactNode; title: string; jump?: {url: string; name: string}}) {
	const {title, children, jump} = props;

	return (
		<Stack width="100%" height="100%" padding="20px">
			<Box display="flex" width="100%" justifyContent="space-between" alignItems="center">
				<Typography variant="subtitle1" color="textSecondary">
					{title}
				</Typography>

				{jump && (
					<Link to={jump.url} style={{textDecoration: 'none'}} className="no-drag">
						<Typography variant="caption" color="info">
							{jump.name}
						</Typography>
					</Link>
				)}
			</Box>

			<Box className="no-drag" flexGrow={1} marginTop="20px">
				{children}
			</Box>
		</Stack>
	);
}
