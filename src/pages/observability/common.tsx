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
import {getObservabilityEntry, isEntryApplicable, ObservabilityEntryId} from 'observability/capabilityRegistry';
import {explainAbsence, IAbsenceExplanation} from 'observability/familyActivation';
import {useMemo} from 'react';
import {IMetricsSnapshot} from 'types/observability';

export function useObservabilityApplicable(id: ObservabilityEntryId): boolean {
	const caps = useInstanceCapabilities();
	// Fail-narrow: unresolved/denied/unavailable answers not-applicable.
	return caps.resolved && caps.flavor !== undefined && isEntryApplicable(id, caps.flavor);
}

/**
 * Why this page's metric families are missing from the scrape (Stage 3.5).
 *
 * Pass the result to `ObservabilityStateFrame`'s `absence` prop and its
 * `no-data` state explains itself instead of printing a bare "No data".
 * `undefined` when every family the page declares IS present — the page's
 * emptiness is then about samples, not the exposition.
 *
 * ⚠️ Scoped to the families the page's REGISTRY ENTRY declares, which is the
 * honest scope: that list is what the page was built to read, so an eager
 * family missing from it is a real export gap even if some other panel on the
 * page is empty for its own reasons.
 */
export function useAbsenceExplanation(id: ObservabilityEntryId, snapshot: IMetricsSnapshot | undefined): IAbsenceExplanation | undefined {
	return useMemo(() => {
		const entry = getObservabilityEntry(id);
		if (!entry) return undefined;
		return explainAbsence(entry.metricFamilies, snapshot);
	}, [id, snapshot]);
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

// Moved under components/ when Stage 3.2 put a second `model` column on a
// panel, which must not import from pages/. Re-exported so page code is
// unchanged.
export {MODEL_OVERFLOW_LABEL, ModelName} from 'components/observability/modelLabel';
