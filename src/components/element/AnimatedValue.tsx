//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {Box, Typography, TypographyProps} from '@mui/material';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
// Live metric value that fades gently when its rendered text changes.
// The outer Typography stays mounted (so tooltips/listeners attached by a
// parent survive updates); only the inner span remounts — keyed on the
// display string, so an unchanged reading triggers no animation at all.
// Callers keep layout stable via tabular-nums; this only eases opacity.
export default function AnimatedValue(props: TypographyProps & {value: string}) {
	const {value, ...rest} = props;

	return (
		<Typography {...rest}>
			<Box
				component="span"
				key={value}
				sx={{
					'@keyframes value-fade-in': {
						from: {opacity: 0.35},
						to: {opacity: 1},
					},
					display: 'inline-block',
					animation: 'value-fade-in 240ms ease-out',
				}}
			>
				{value}
			</Box>
		</Typography>
	);
}
