//---------------------------------------------------------
// One dashboard figure that knows "zero" from "we were not told".
//---------------------------------------------------------
// Every card used to read its metrics as `metrics.critical.<key> || 0`, which
// collapses the two. That is not a cosmetic difference on this product: the
// backends deliberately OMIT a family they cannot sample rather than export a
// literal 0, precisely so a consumer can tell them apart. Rendering it as `0`
// throws away the one signal they went to the trouble of sending, and states
// something false — "no healthy endpoints" reads identically to "endpoint
// health is not being collected".
//
// SystemUsageCard set the precedent with its N/A pie; this is that behaviour
// factored out so the numeric cards agree with it.
import {Box, Tooltip, Typography} from '@mui/material';
import {TypographyProps} from '@mui/material/Typography';
import {t} from 'i18next';

//---------------------------------------------------------
// Component Props
//---------------------------------------------------------
interface MetricFigureProps {
	/**
	 * `undefined` means the instance does not report this figure. It is NOT
	 * interchangeable with 0 — pass the raw metric through, never `?? 0`.
	 */
	value: number | undefined;
	/** Caption under the number, e.g. "Active Flows". */
	label: string;
	variant?: TypographyProps['variant'];
	/** Applied only when there is a real value; N/A is always muted. */
	color?: string;
	/** Appended to the formatted number, e.g. '%'. */
	suffix?: string;
}

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export default function MetricFigure(props: MetricFigureProps) {
	const {value, label, variant = 'h4', color = 'text.primary', suffix = ''} = props;
	const reported = value !== undefined && Number.isFinite(value);

	// The explanation rides on a tooltip rather than a second caption line: in a
	// three-across breakdown, repeating the sentence under every figure buries
	// the numbers. Cards that can lose *every* figure at once say it in one
	// place instead — see the unavailable banner in the cards themselves.
	const figure = (
		<Typography variant={variant} fontWeight="bold" color={reported ? color : 'text.disabled'}>
			{reported ? `${value.toLocaleString()}${suffix}` : t('N/A')}
		</Typography>
	);

	return (
		<Box textAlign="center">
			{reported ? figure : <Tooltip title={t('Not reported by this instance')}>{figure}</Tooltip>}
			<Typography variant="caption" color="textSecondary" display="block">
				{label}
			</Typography>
		</Box>
	);
}
