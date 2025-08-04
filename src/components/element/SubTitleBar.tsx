//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Typography} from '@mui/material';
import {t} from 'i18next';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function SubTitleBar(props: {title: string; sub_title?: string}) {
	const {title, sub_title} = props;

	return (
		<Box display="flex" gap="10px">
			<Typography variant="h6">{t(title)}</Typography>

			{sub_title && (
				<Typography variant="h6" color="text.secondary">
					{t(sub_title)}
				</Typography>
			)}
		</Box>
	);
}
