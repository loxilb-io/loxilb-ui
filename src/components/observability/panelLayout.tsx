//---------------------------------------------------------
// Shared panel chrome for observability surfaces
//---------------------------------------------------------
// Moved out of pages/observability/common.tsx when J3 put an observability
// panel on a configuration page: a component must not have to import from
// pages/ to draw a panel. common.tsx re-exports both, so page code is
// unchanged.

import {Box, Paper, Typography} from '@mui/material';
import {ReactNode} from 'react';

export function PanelPaper({title, children}: {title: string; children: ReactNode}) {
	return (
		<Paper elevation={0} sx={{border: '1px solid', borderColor: 'divider', p: 2, height: '100%'}}>
			<Typography variant="subtitle1" sx={{mb: 1.5, fontWeight: 600}}>
				{title}
			</Typography>
			{/* Wide content (tables) scrolls inside the panel; the page body
			    itself must never scroll horizontally on narrow viewports.
			    tabIndex: once it scrolls it must stay keyboard-reachable
			    (read-only tables have no focusable content of their own). */}
			<Box tabIndex={0} sx={{overflowX: 'auto'}}>{children}</Box>
		</Paper>
	);
}

export function StatRow({label, value}: {label: ReactNode; value: ReactNode}) {
	return (
		<Box display="flex" justifyContent="space-between" alignItems="baseline" sx={{py: 0.5}}>
			<Typography variant="body2" color="text.secondary">
				{label}
			</Typography>
			<Typography variant="body1" sx={{fontVariantNumeric: 'tabular-nums'}}>
				{value}
			</Typography>
		</Box>
	);
}
