//---------------------------------------------------------
// Shared building blocks for the observability pages (UI-MON-011a)
//---------------------------------------------------------
// Route-level flavor gating is RequireFeature's job; INSIDE a page, panel
// applicability comes from the deny-by-default registry — never from data
// presence. Rates render through one cell so a typed degenerate result
// (reset, gap, warming up) reads identically on every page and can never
// silently print as 0/s.

import {Box, MenuItem, Paper, TextField, Typography} from '@mui/material';
import type {TFunction} from 'i18next';
import {useInstanceCapabilities} from 'hooks/query/flavorHook';
import {useObservabilityCadence} from 'hooks/query/observabilityHooks';
import {ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {isObservabilityCadence, OBSERVABILITY_CADENCE_OPTIONS_MS} from 'preferences';
import {isEntryApplicable, ObservabilityEntryId} from 'observability/capabilityRegistry';
import {RateResult} from 'observability/rates';
import {RatioResult} from 'observability/aiRequests';

export function useObservabilityApplicable(id: ObservabilityEntryId): boolean {
	const caps = useInstanceCapabilities();
	// Fail-narrow: unresolved/denied/unavailable answers not-applicable.
	return caps.resolved && caps.flavor !== undefined && isEntryApplicable(id, caps.flavor);
}

// The degenerate vocabulary, shared by every derived quantity. A ratio that
// cannot be computed because its underlying rate was a reset or a gap has to
// say the same words a rate does, or the same condition reads as two different
// problems depending on which cell the operator happens to look at.
function degenerateText(kind: Exclude<RateResult['kind'], 'ok'>, t: TFunction): string {
	switch (kind) {
		case 'insufficient-samples':
			return t('Warming up…');
		case 'reset':
			return t('Counter reset');
		case 'gap':
			return t('Gap in samples');
		case 'invalid-interval':
		case 'invalid-sample':
			return t('N/A');
	}
}

export function formatRate(rate: RateResult, t: TFunction, unit = '/s'): string {
	if (rate.kind !== 'ok') return degenerateText(rate.kind, t);
	const v = rate.perSecond;
	const text = v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(3);
	return `${text}${unit}`;
}

/**
 * A derived ratio as a percentage.
 *
 * Two cases are deliberately not "0%": `no-traffic`, where the ratio is 0/0
 * and printing a number would assert health nothing measured; and a small but
 * nonzero ratio, which reads as an explicit bound rather than rounding down to
 * 0.0% and telling an operator there were no failures when there were.
 */
export function formatRatio(ratio: RatioResult, t: TFunction): string {
	switch (ratio.kind) {
		case 'no-traffic':
			return t('No traffic');
		case 'not-derivable':
			return degenerateText(ratio.reason, t);
		case 'ok': {
			const pct = ratio.ratio * 100;
			if (pct === 0) return '0%';
			if (pct < 0.1) return `<0.1%`;
			return `${pct >= 10 ? pct.toFixed(1) : pct.toFixed(2)}%`;
		}
	}
}

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

// Refresh-interval selector for the SHARED snapshot query — one global
// preference, so changing it on any page changes every snapshot consumer
// (including the dashboard's gateway cards). Freshness badges and rate gap
// tolerance derive from the same value, keeping every option honest.
export function CadenceSelector() {
	const {t} = useTranslation();
	const [cadenceMs, setCadenceMs] = useObservabilityCadence();
	return (
		<TextField
			select
			size="small"
			value={cadenceMs}
			label={t('Refresh interval')}
			onChange={e => {
				const v = Number(e.target.value);
				if (isObservabilityCadence(v)) setCadenceMs(v);
			}}
			sx={{minWidth: 120, ml: 'auto'}}
		>
			{OBSERVABILITY_CADENCE_OPTIONS_MS.map(ms => (
				<MenuItem key={ms} value={ms}>
					{t('{{seconds}}s', {seconds: ms / 1000})}
				</MenuItem>
			))}
		</TextField>
	);
}

// The gateway collapses model labels past its 64-distinct-model bound to the
// literal "other" — that row is an overflow bucket, not a model.
export const MODEL_OVERFLOW_LABEL = 'other';

export function ModelName({model}: {model: string}) {
	const {t} = useTranslation();
	if (model !== MODEL_OVERFLOW_LABEL) return <>{model}</>;
	return <em>{t('Other models (overflow bucket)')}</em>;
}
