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
			{/* disableInteractive + leaveDelay=0: MUI v5 tooltips are interactive by
			    default, so without these the header's hover tooltip keeps pointer-events
			    and lingers, intercepting the click on the next section's summary. Mirrors
			    the ParamBox tooltip so section headers stay clickable. */}
			<Tooltip title={tooltip || ''} arrow placement="top" leaveDelay={0} disableInteractive>
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
