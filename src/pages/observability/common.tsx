//---------------------------------------------------------
// Shared building blocks for the observability pages (UI-MON-011a)
//---------------------------------------------------------
// Route-level flavor gating is RequireFeature's job; INSIDE a page, panel
// applicability comes from the deny-by-default registry — never from data
// presence. Rates render through one cell so a typed degenerate result
// (reset, gap, warming up) reads identically on every page and can never
// silently print as 0/s.

import {MenuItem, TextField} from '@mui/material';
import {useInstanceCapabilities} from 'hooks/query/flavorHook';
import {useObservabilityCadence} from 'hooks/query/observabilityHooks';
import {useTranslation} from 'react-i18next';
import {isObservabilityCadence, OBSERVABILITY_CADENCE_OPTIONS_MS} from 'preferences';
import {isEntryApplicable, ObservabilityEntryId} from 'observability/capabilityRegistry';

export function useObservabilityApplicable(id: ObservabilityEntryId): boolean {
	const caps = useInstanceCapabilities();
	// Fail-narrow: unresolved/denied/unavailable answers not-applicable.
	return caps.resolved && caps.flavor !== undefined && isEntryApplicable(id, caps.flavor);
}

// The rate/ratio vocabulary moved to components/observability/rateText.ts
// when J3 put a rate on a configuration page. Re-exported here so every
// observability page keeps importing it from the same place.
export {formatAgeSeconds, formatRate, formatRatio} from 'components/observability/rateText';

export {PanelPaper, StatRow} from 'components/observability/panelLayout';

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
