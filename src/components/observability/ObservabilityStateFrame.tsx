//---------------------------------------------------------
// ObservabilityStateFrame — the ten-state model becomes pixels
//---------------------------------------------------------
// One renderer for every observability panel state, so an AI-traffic panel
// and a persistence panel describe the same situation identically (the same
// contract PageStateBanner keeps for pages). Rules carried over from the
// request state table:
// - `not-applicable` is neutral — no error color, no alarm;
// - `denied` is never an empty chart, `unavailable` always offers retry;
// - `stale`/`partial` still render the children (last value + badge /
//   data + diagnostics), never a blank;
// - `unknown` shows the raw token — a new enum value is surfaced, not hidden.
// Raw server prose never reaches the screen; OpResult.rawDetail stays
// diagnostics-only.

import {Alert, AlertTitle, Box, Button, Chip, Skeleton, Typography} from '@mui/material';
import {ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {ObservabilityViewState} from 'types/observability';

export interface ObservabilityStateFrameProps {
	state: ObservabilityViewState;
	/** Localized panel name, e.g. t('AI Traffic'). */
	name: string;
	onRetry?: () => void;
	children?: ReactNode;
}

export default function ObservabilityStateFrame({state, name, onRetry, children}: ObservabilityStateFrameProps) {
	const {t} = useTranslation();

	const retry = onRetry ? (
		<Button color="inherit" size="small" onClick={onRetry}>
			{t('Retry')}
		</Button>
	) : undefined;

	switch (state.kind) {
		case 'loading':
			return (
				<Box role="status" aria-label={t('Loading {{name}}...', {name})}>
					<Skeleton variant="rounded" width="40%" height={24} sx={{mb: 1}} />
					<Skeleton variant="rounded" width="100%" height={120} />
				</Box>
			);
		case 'not-applicable':
			return (
				<Typography role="status" variant="body2" color="text.secondary" sx={{p: 2}}>
					{t('Not applicable to this instance')}
				</Typography>
			);
		case 'no-data':
			return (
				<Typography role="status" variant="body2" color="text.secondary" sx={{p: 2}}>
					{t('No data')}
				</Typography>
			);
		case 'disabled':
			return (
				<Alert role="status" severity="info">
					<AlertTitle>{t('Disabled')}</AlertTitle>
					{t(state.reasonKey ?? 'This feature is disabled on the instance.')}
				</Alert>
			);
		case 'denied':
			return (
				<Alert role="alert" severity="warning">
					<AlertTitle>{t('Permission denied')}</AlertTitle>
					{t('You are not authorized to read {{name}}.', {name})}
				</Alert>
			);
		case 'unavailable':
			return (
				<Alert role="alert" severity="error" action={retry}>
					<AlertTitle>{t('The service is temporarily unavailable. Please try again later.')}</AlertTitle>
				</Alert>
			);
		case 'unknown':
			return (
				<Alert role="status" severity="info">
					<AlertTitle>{t('Unknown value')}</AlertTitle>
					{/* The raw token is data (an enum this build predates), not server prose. */}
					<code>{state.raw}</code>
				</Alert>
			);
		case 'stale':
			return (
				<Box>
					<Chip role="status" size="small" color="warning" label={t('Stale')} sx={{mb: 1}} />
					{children}
				</Box>
			);
		case 'partial':
			return (
				<Box>
					<Chip
						role="status"
						size="small"
						color="warning"
						label={t('Partial data — {{count}} samples skipped', {count: state.skippedSamples})}
						sx={{mb: 1}}
					/>
					{children}
				</Box>
			);
		case 'ready':
			return <>{children}</>;
	}
}
