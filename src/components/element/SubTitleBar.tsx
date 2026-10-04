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
			{/* ⚠️ The LEVEL is h2 while the LOOK stays h6. A section title sits
			    directly beneath the page's single h1, so h6 would skip four
			    levels and trip `heading-order`. Keep `variant` for size and
			    `component` for meaning; they are not the same decision. */}
			<Typography variant="h6" component="h2">{t(title)}</Typography>

			{sub_title && (
				/* A qualifier on the same title, not a second section — so it
				   is not a heading at all. */
				<Typography variant="h6" component="span" color="text.secondary">
					{t(sub_title)}
				</Typography>
			)}
		</Box>
	);
}
