//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import BedtimeIcon from '@mui/icons-material/Bedtime';
import CircleIcon from '@mui/icons-material/Circle';
import CoronavirusIcon from '@mui/icons-material/Coronavirus';
import HotelIcon from '@mui/icons-material/Hotel';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {Box, capitalize, Chip, Typography} from '@mui/material';
import {get_root_url, is_active_status} from 'common';
import {t} from 'i18next';
import {FONT_MONO} from 'theme';
import SimpleButton from './SimpleButton';
import TooltipMark from './TooltipMark';

//---------------------------------------------------------
// Functional Component
//---------------------------------------------------------
export const UsageCell = (params: any) => {
	const amount = params.value.amount;
	const percent = params.value.percent; // includes % sign

	const percent_number = Number(percent.replace('%', ''));
	const cur_color = percent_number > 80 ? 'error' : percent_number > 50 ? 'warning' : 'success';

	return (
		<Box width="100%" height="100%" display="flex" alignItems="center" justifyContent="flex-start" gap="5px">
			<CircleIcon color={cur_color} sx={{fontSize: '16px'}} />
			<Typography variant="body2" color={cur_color}>
				{`${amount} (${percent})`}
			</Typography>
		</Box>
	);
};

export const StatusCell = (params: any) => {
	const status_map = {
		D: {label: 'Uninterruptible Sleep', icon: HotelIcon, color: 'warning.main'},
		S: {label: 'Sleeping', icon: BedtimeIcon, color: 'info.main'},
		R: {label: 'Running', icon: PlayArrowIcon, color: 'success.main'},
		T: {label: 'Stopped', icon: PauseIcon, color: 'error.main'},
		Z: {label: 'Zombie', icon: CoronavirusIcon, color: 'grey.500'},
	};

	return (
		<Box height="100%" display="flex" gap="5px" alignItems="center">
			<Box display="flex" justifyContent="center" alignItems="center">
				{params.value === 'D' && <HotelIcon sx={{color: 'warning.main', height: '20px'}} />}
				{params.value === 'S' && <BedtimeIcon sx={{color: 'info.main', height: '16px'}} />}
				{params.value === 'R' && <PlayArrowIcon sx={{color: 'success.main', height: '22px'}} />}
				{params.value === 'T' && <PauseIcon sx={{color: 'error.main', height: '20px'}} />}
				{params.value === 'Z' && <CoronavirusIcon sx={{color: 'grey.500', height: '16px'}} />}
			</Box>
			<Typography variant="caption">{t(status_map[params.value as keyof typeof status_map]?.label)}</Typography>
		</Box>
	);
};

// Single semantic mapping for state values, shared by every state column:
// healthy → green, in-transition → amber, deliberately off → gray, and only
// genuine failure → red. Before this, CONNECTING rendered as red — a tunnel
// coming up looked identical to a broken one.
const TRANSITIONAL_STATES = ['connecting', 'pending', 'init', 'rekeying', 'negotiating', 'installing', 'routed', 'starting'];
const NEUTRAL_STATES = ['disabled', 'off', 'none', 'unknown', 'n/a', 'inactive'];

export function state_color(value: any): 'success' | 'warning' | 'error' | 'disabled' {
	if (is_active_status(value)) return 'success';
	if (typeof value === 'string') {
		const lower = value.toLowerCase();
		if (TRANSITIONAL_STATES.some(s => lower.includes(s))) return 'warning';
		if (NEUTRAL_STATES.includes(lower)) return 'disabled';
	}
	return 'error';
}

export const StateCell = (params: any) => {
	const cur_color = state_color(params.value);
	const state_msg = typeof params.value === 'string' ? params.value.toUpperCase() : t(params.value ? 'OK' : 'Error');

	return (
		<Box height="100%" display="flex" alignItems="center" gap="5px">
			<CircleIcon color={cur_color} sx={{fontSize: '16px'}} />
			<Typography variant="body2" color={cur_color === 'disabled' ? 'text.secondary' : cur_color}>
				{state_msg}
			</Typography>
		</Box>
	);
};

export const SyncCell = (params: any) => {
	const cur_color = params.value === 0 ? 'success' : 'error';
	const state_msg = params.value === 0 ? t('OK') : t('Error{{code}}', {code: `(${params.value})`});

	return (
		<Box height="100%" display="flex" alignItems="center" gap="5px">
			<CircleIcon color={cur_color} sx={{fontSize: '16px'}} />
			<Typography variant="body2" color={cur_color}>
				{state_msg}
			</Typography>
		</Box>
	);
};

export const BooleanCell = (params: any) => {
	const cur_color = is_active_status(params.value) ? 'success' : 'disabled';
	const state_msg = typeof params.value === 'string' ? capitalize(t(params.value).toLowerCase()) : t(params.value ? 'True' : 'False');

	return (
		<Box height="100%" display="flex" alignItems="center" gap="5px">
			<CircleIcon color={cur_color} sx={{fontSize: '16px'}} />
			<Typography variant="body2" color={cur_color}>
				{state_msg}
			</Typography>
		</Box>
	);
};

export const StateCellSmall = (params: any) => {
	const cur_color = is_active_status(params.value) ? 'success' : 'error';
	const state_msg = typeof params.value === 'string' ? capitalize(t(params.value).toLowerCase()) : t(params.value ? 'OK' : 'Error');

	return (
		<Box height="100%" display="flex" alignItems="center" gap="5px">
			<CircleIcon color={cur_color} sx={{fontSize: '12px'}} />
			<Typography variant="caption" color={cur_color} paddingTop="2px">
				{state_msg}
			</Typography>
		</Box>
	);
};

export const OnOffCell = (params: any) => {
	const cur_color = is_active_status(params.value) ? 'success' : 'error';
	return (
		<Box height="100%" display="flex" alignItems="center">
			<CircleIcon color={cur_color} sx={{fontSize: '16px'}} />
		</Box>
	);
};

export const MultiLineCell = (params: any) => (
	<Box height="100%" display="flex" alignItems="center">
		<Typography variant="body2" width="100%" whiteSpace="pre-wrap">
			{params.value}
		</Typography>
	</Box>
);

export const TextCell = (params: any) => {
	// Empty cells render an explicit dash: a blank cell reads as a rendering
	// bug, a dash reads as "no value" (AWS-console convention).
	const has_value = params.value !== null && params.value !== undefined && params.value.toString() !== '';
	return (
		<Box height="100%" display="flex" alignItems="center">
			<Typography variant="body2" width="100%" textOverflow="ellipsis" overflow="hidden" whiteSpace="nowrap" color={has_value ? undefined : 'text.secondary'}>
				{has_value ? params.value.toString() : '–'}
			</Typography>
		</Box>
	);
};

// Identifiers (IPs, MACs, CIDRs, ports, IDs) and counters: monospace with
// tabular digits so values align vertically and copy cleanly.
export const MonoCell = (params: any) => {
	const has_value = params.value !== null && params.value !== undefined && params.value.toString() !== '';
	return (
		<Box height="100%" display="flex" alignItems="center">
			<Typography
				variant="body2"
				width="100%"
				textAlign={params.colDef?.align ?? 'left'}
				textOverflow="ellipsis"
				overflow="hidden"
				whiteSpace="nowrap"
				color={has_value ? undefined : 'text.secondary'}
				sx={{fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums'}}
			>
				{has_value ? params.value.toString() : '–'}
			</Typography>
		</Box>
	);
};

// Neutral type badge for enum-ish values (protocol, NAT mode, …): outlined
// gray, never colored — color stays reserved for state columns so a row's
// single status indicator remains the eye-catcher.
export const TagCell = (params: any) => {
	const label = params.value !== null && params.value !== undefined ? params.value.toString() : '';
	if (!label)
		return (
			<Box height="100%" display="flex" alignItems="center">
				<Typography variant="body2" color="text.secondary">
					–
				</Typography>
			</Box>
		);
	return (
		<Box height="100%" display="flex" alignItems="center">
			<Chip size="small" variant="outlined" label={label} sx={{borderRadius: '4px', color: 'text.secondary', fontWeight: 500}} />
		</Box>
	);
};

// Generic labelled chip. value: {label, color?} | null — null renders nothing.
// The label always carries the meaning in text (a11y: never color alone).
export const ChipCell = (params: any) => {
	if (!params.value?.label) return null;
	return (
		<Box height="100%" display="flex" alignItems="center">
			<Chip size="small" label={t(params.value.label)} color={params.value.color ?? 'default'} sx={{borderRadius: '4px'}} />
		</Box>
	);
};

export const LogLevelCell = (params: any) => {
	// Handle both old format (severity/level) and new format (just level)
	const value = params.value || '';
	const parts = value.split('/');
	const level = parts.length > 1 ? parts[1] : parts[0]; // If split by /, use second part, otherwise use first part
	
	type IconColor = 'success' | 'error' | 'info' | 'warning' | 'secondary' | 'primary' | 'disabled' | 'action' | 'inherit';

	const color = ((): IconColor => {
		switch (level?.toUpperCase()) {
			case 'INFO':
				return 'info';
			case 'WARNING':
				return 'warning';
			case 'ERROR':
				return 'error';
			case 'DEBUG':
				return 'secondary';
			case 'CRITICAL':
				return 'error';
			default:
				return 'primary';
		}
	})();

	return (
		<Box height="100%" display="flex" alignItems="center" gap="5px">
			<CircleIcon color={color} sx={{fontSize: '16px'}} />
			<Typography variant="body2" color={color}>
				{level?.toUpperCase() || 'UNKNOWN'}
			</Typography>
		</Box>
	);
};

export const StateAndNameCell = (params: any) => {
	const state: boolean = params.value.split('%')[0] === 'true';
	const name = params.value.split('%')[1];

	const cur_color = state ? 'success' : 'disabled';

	return (
		<Box height="100%" display="flex" alignItems="center" gap="5px">
			<CircleIcon color={cur_color} sx={{fontSize: '16px'}} />
			<Typography variant="body2">{name}</Typography>
		</Box>
	);
};

export const LinkCell = (params: any) => {
	const url = params.value.url ? params.value.url : '#';
	const text = params.value.data ? params.value.data : '';

	const handleOpenLink = () => {
		const root_url = get_root_url();
		window.open(root_url + url, '_blank', 'noopener,noreferrer');
	};

	return (
		<Box height="100%" display="flex" alignItems="center">
			<Typography variant="body2" color="primary">
				{text}
			</Typography>
			{text && text !== '-' && <SimpleButton type="jump" onClick={handleOpenLink} />}
		</Box>
	);
};

export const SublineHeader = (props: {header: string; subheader: string}) => {
	return (
		<Box display="flex" alignItems="center" gap="5px">
			<Typography variant="subtitle2">{props.header}</Typography>
			<Typography variant="caption">{props.subheader}</Typography>
		</Box>
	);
};

export const ToolTipHeader = (props: {header: string; tooltip: string}) => {
	return (
		<Box display="flex" alignItems="center" gap="5px">
			<Typography variant="subtitle2">{props.header}</Typography>
			<TooltipMark content={props.tooltip} />
		</Box>
	);
};
