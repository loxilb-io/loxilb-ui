//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Tooltip, Typography} from '@mui/material';
import {formatRate} from 'common';
import {ReactNode} from 'react';

//---------------------------------------------------------
// Rate Tooltip Component
//---------------------------------------------------------
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
				{unit === 'bps' ? 'Bits per second' : 'Packets per second'}
			</Typography>
		</Box>
	);

	return (
		<Tooltip title={tooltipContent} placement="top">
			<Box component="span">{children}</Box>
		</Tooltip>
	);
}
