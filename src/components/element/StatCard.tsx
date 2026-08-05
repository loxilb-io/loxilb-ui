//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Stack, Typography} from '@mui/material';
import AnimatedValue from './AnimatedValue';
import TooltipMark from './TooltipMark';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
// KPI stat tile for overview strips (replaces the disabled-TextField
// lookalikes): muted label on top, big tabular number below, on a bordered
// card surface. `color` tints the value only — the card stays neutral so a
// strip of tiles reads calmly and the colored value is the eye-catcher.
export default function StatCard(props: {label: string; value: string | number; tooltip?: string; color?: 'success' | 'error' | 'warning'}) {
	const {label, value, tooltip, color} = props;

	return (
		<Box minWidth="150px" padding="10px 16px" border="1px solid" borderColor="divider" borderRadius="10px" bgcolor="background.paper">
			<Stack gap="2px">
				<Box display="flex" alignItems="center" gap="5px">
					<Typography variant="caption" color="text.secondary" noWrap>
						{label}
					</Typography>
					{tooltip && <TooltipMark content={tooltip} />}
				</Box>

				<AnimatedValue variant="h5" color={color ? `${color}.main` : 'text.primary'} sx={{fontVariantNumeric: 'tabular-nums'}} noWrap value={String(value)} />
			</Stack>
		</Box>
	);
}
