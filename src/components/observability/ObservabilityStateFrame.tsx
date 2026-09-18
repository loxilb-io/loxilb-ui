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
import type {TFunction} from 'i18next';
import {IAbsenceExplanation} from 'observability/familyActivation';
import {ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {ObservabilityViewState} from 'types/observability';

//---------------------------------------------------------
// Why there is no data (Stage 3.5)
//---------------------------------------------------------
// ⭐ Deliberately a PROP rather than a field on the `no-data` state. The
// stage brief said to feed the state classifier from the manifest, but
// `classifyViewState`'s own design note is that it stays a pure precedence
// table, unit-testable without a DOM — and an absence explanation changes no
// precedence, it captions one state. Putting rendering payload into the
// precedence layer would have cost that separation for nothing.
//
// ⚠️ The caption NEVER changes the state. A panel with no data still reports
// no data; this only says why, and only when the manifest actually knows.
function absenceText(absence: IAbsenceExplanation, t: TFunction): string {
	switch (absence.reading.kind) {
		case 'conditional':
			// ⭐ The manifest's own precondition prose, verbatim. It is written
			// for an operator and says what to configure, which is more useful
			// than anything this layer could paraphrase.
			return t('No data yet: {{precondition}}', {precondition: absence.reading.precondition});
		case 'until-used':
			return t('No data yet — these metrics appear the first time the feature is used.');
		case 'gated':
			return t('No data: these metrics are behind a datapath or hardware gate that is not enabled on this instance.');
		case 'unexpected':
			// ⭐⭐ The one reading that indicates a problem: the gateway always
			// registers these, so their absence is an export or version gap
			// rather than an unused feature.
			return t('No data, and these metrics should always be exported — the gateway may be older than them, or not exporting them. This is worth reporting.');
		case 'not-in-manifest':
		case 'indeterminate':
			// Deny by default: say only that the reason is unknown rather than
			// guessing a benign one.
			return t('No data, and this build cannot tell whether that is expected for these metrics.');
	}
}

export interface ObservabilityStateFrameProps {
	state: ObservabilityViewState;
	/** Localized panel name, e.g. t('AI Traffic'). */
	name: string;
	onRetry?: () => void;
	/**
	 * Why the panel's families are missing from the scrape, from
	 * `explainAbsence`. Captions the `no-data` state only; ignored in every
	 * other state, because a denied or stale scrape is already explained and
	 * a contract reason would misattribute it.
	 */
	absence?: IAbsenceExplanation;
	children?: ReactNode;
}

export default function ObservabilityStateFrame({state, name, onRetry, absence, children}: ObservabilityStateFrameProps) {
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
					{absence ? absenceText(absence, t) : t('No data')}
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
