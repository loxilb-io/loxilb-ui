//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Link, Typography} from '@mui/material';
import Logo from 'assets/logo/netlox.svg';
import {t} from 'i18next';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
// Two variants: 'dark' keeps the branded bar (login page, on its black
// backdrop); 'light' is a slim single line so the app chrome has only one
// dark band — the header.
export default function Footer(props: {variant?: 'light' | 'dark'}) {
	const {variant = 'light'} = props;

	const copyright = t('© NETLOX');
	const text_color = variant === 'dark' ? 'white' : 'text.secondary';

	return (
		<Box
			id="footer"
			width="100%"
			height="32px"
			display="flex"
			alignItems="center"
			justifyContent="space-between"
			padding="0 16px"
			{...(variant === 'dark'
				? {bgcolor: 'black'}
				: {bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider'})}
		>
			{variant === 'dark' ? (
				<Link href="https://netlox.io" target="_blank" rel="noopener noreferrer" underline="none">
					<Box component="img" src={Logo} height="14px" />
				</Link>
			) : (
				<Box />
			)}

			<Box display="flex" gap="20px">
				<Link href="https://netlox.io" target="_blank" rel="noopener noreferrer" underline="none">
					<Typography variant="caption" color={text_color}>
						{copyright}
					</Typography>
				</Link>

				<Link href="https://netlox.io" target="_blank" rel="noopener noreferrer" underline="none">
					<Typography variant="caption" color={text_color}>
						{'Privacy'}
					</Typography>
				</Link>

				<Link href="https://netlox.io" target="_blank" rel="noopener noreferrer" underline="none">
					<Typography variant="caption" color={text_color}>
						{'Terms'}
					</Typography>
				</Link>
			</Box>
		</Box>
	);
}
