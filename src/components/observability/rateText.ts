//---------------------------------------------------------
// Shared text for derived observability quantities
//---------------------------------------------------------
// One vocabulary for every derived number on every surface. A ratio that
// cannot be computed because its underlying rate was a reset or a gap has to
// say the same words a rate does, or the same condition reads as two
// different problems depending on which cell the operator happens to look at.
//
// This lives under components/ rather than pages/observability/ because it is
// no longer only the observability pages that render these: J3 puts a rate on
// the JWT Auth Profiles page, which is a configuration page.
// pages/observability/common.tsx re-exports it, so page code is unchanged.

import type {TFunction} from 'i18next';
import {RatioResult} from 'observability/aiRequests';
import {RateResult} from 'observability/rates';

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

/**
 * An elapsed duration, coarsened to the largest unit that still says
 * something. Never a bare number of seconds past a minute: an operator
 * reading "last success 5400s ago" has to do arithmetic to learn it is an
 * hour and a half.
 */
export function formatAgeSeconds(ageSec: number, t: TFunction): string {
	// ⚠️ `n`, not `count`: i18next treats a `count` option as a plural
	// selector and resolves `key_one`/`key_other` before the base key. These
	// are unit suffixes, not sentences, so the plural machinery has nothing to
	// offer and would only add keys that must exist in three catalogues.
	const s = Math.max(0, Math.round(ageSec));
	if (s < 60) return t('{{n}}s', {n: s});
	if (s < 3600) return t('{{n}}m', {n: Math.round(s / 60)});
	if (s < 86_400) return t('{{n}}h', {n: Math.round(s / 3600)});
	return t('{{n}}d', {n: Math.round(s / 86_400)});
}
