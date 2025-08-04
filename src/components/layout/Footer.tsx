//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Link, Typography} from '@mui/material';
import Logo from 'assets/logo/netlox.svg';
import {t} from 'i18next';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function Footer(props: {bgcolor: string}) {
	const {bgcolor} = props;

	const copyright = t('© NETLOX');

	return (
		<Box id="footer" width="100%" display="flex" alignItems="center" justifyContent="space-between" bgcolor={bgcolor || 'primary.main'} padding="6px 16px">
			<Link href="https://netlox.io" target="_blank" rel="noopener noreferrer" underline="none">
				<Box component="img" src={Logo} />
			</Link>

			<Box display="flex" gap="20px">
				<Link href="https://netlox.io" target="_blank" rel="noopener noreferrer" underline="none">
					<Typography variant="caption" color="white">
						{copyright}
					</Typography>
				</Link>

				<Link href="https://netlox.io" target="_blank" rel="noopener noreferrer" underline="none">
					<Typography variant="caption" color="white">
						{'Privacy'}
					</Typography>
				</Link>

				<Link href="https://netlox.io" target="_blank" rel="noopener noreferrer" underline="none">
					<Typography variant="caption" color="white">
						{'Terms'}
					</Typography>
				</Link>
			</Box>
		</Box>
	);
}
