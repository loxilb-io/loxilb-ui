//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {Accordion, AccordionDetails, AccordionSummary, Tooltip, Typography} from '@mui/material';
import {ReactNode} from 'react';

//---------------------------------------------------------
// Component
//---------------------------------------------------------
export default function AccordionBox(props: {title: string; tooltip?: string; disabled?: boolean; children: ReactNode}) {
	const {title, tooltip, disabled, children} = props;

	return (
		<Accordion disabled={disabled} variant="outlined">
			<Tooltip title={tooltip || ''}>
				<AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="panel4-content" id="panel4-header">
					<Typography variant="subtitle2" color="textSecondary">
						{title}
					</Typography>
				</AccordionSummary>
			</Tooltip>

			<AccordionDetails>{children}</AccordionDetails>
		</Accordion>
	);
}
