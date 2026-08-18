//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Tooltip, Typography} from '@mui/material';
import {formatRate} from 'common';
import {ReactNode} from 'react';

//---------------------------------------------------------
// Rate Tooltip Component
//---------------------------------------------------------
// One description per unit — the old bps-or-else split described the error
// rate as "Packets per second".
const UNIT_DESCRIPTION: Record<'bps' | 'pps' | 'eps' | 'fps', string> = {
	bps: 'Bits per second',
	pps: 'Packets per second',
	eps: 'Errors per second',
	fps: 'Flows per second',
};

export default function RateTooltip(props: {
	rate: number;
	unit: 'bps' | 'pps' | 'eps' | 'fps';
	children: ReactNode;
	title?: string;
}) {
	const {rate, unit, children, title} = props;

	const tooltipContent = (
		<Box>
			{title && (
				<Typography variant="subtitle2" fontWeight="bold" mb={0.5}>
					{title}
				</Typography>
			)}
			<Typography variant="body2">
				{formatRate(rate, unit)}
			</Typography>
			<Typography variant="caption" color="textSecondary">
				{UNIT_DESCRIPTION[unit]}
			</Typography>
		</Box>
	);

	return (
		<Tooltip title={tooltipContent} placement="top">
			<Box component="span">{children}</Box>
		</Tooltip>
	);
}
