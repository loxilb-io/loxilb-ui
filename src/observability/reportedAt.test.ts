//---------------------------------------------------------
// reportedAt — a sentinel is not an instant, a day-old instant is not today
//---------------------------------------------------------
// `nowMs` is passed in: nothing here reads the real clock. NOW sits at 06:00
// UTC, so NOW ± 1 min is the same local calendar day in every UTC−12…+14
// zone the suite could run in, and NOW − 1 day never is.

import type {TFunction} from 'i18next';
import {describe, expect, it} from 'vitest';
import {formatReportedAt, reportedAtFromIso, reportedAtFromSeconds} from './reportedAt';

const t = ((key: string) => key) as unknown as TFunction;
const NOW = Date.UTC(2026, 8, 29, 6, 0, 0);
const DAY = 86_400_000;
const GO_ZERO_TIME = '0001-01-01T00:00:00Z';

describe('reportedAtFromIso', () => {
	it('reads Go zero time as never, not as an instant in year 1', () => {
		expect(reportedAtFromIso(GO_ZERO_TIME)).toBe('never');
		// go-swagger's strfmt.DateTime marshals with milliseconds.
		expect(reportedAtFromIso('0001-01-01T00:00:00.000Z')).toBe('never');
	});

	it('reads the Unix epoch as never', () => {
		expect(reportedAtFromIso('1970-01-01T00:00:00Z')).toBe('never');
	});

	it('returns the instant for a real report', () => {
		expect(reportedAtFromIso(new Date(NOW).toISOString())).toBe(NOW);
	});

	it('is undefined when the field is absent or unparsable', () => {
		expect(reportedAtFromIso(undefined)).toBeUndefined();
		expect(reportedAtFromIso('')).toBeUndefined();
		expect(reportedAtFromIso('not a time')).toBeUndefined();
	});
});

describe('reportedAtFromSeconds', () => {
	it('reads a gauge still at 0 as never', () => {
		expect(reportedAtFromSeconds(0)).toBe('never');
	});

	it('converts Unix seconds to ms', () => {
		expect(reportedAtFromSeconds(NOW / 1000)).toBe(NOW);
	});

	it('is undefined when the series is absent or not finite', () => {
		expect(reportedAtFromSeconds(undefined)).toBeUndefined();
		expect(reportedAtFromSeconds(NaN)).toBeUndefined();
	});
});

describe('formatReportedAt', () => {
	it('says "None since start" for a sentinel', () => {
		expect(formatReportedAt('never', NOW, t)).toBe('None since start');
	});

	it('prints a bare clock time for an instant on the current local day', () => {
		const at = NOW - 60_000;
		expect(formatReportedAt(at, NOW, t)).toBe(new Date(at).toLocaleTimeString());
	});

	it('includes the date for an instant on an earlier day', () => {
		const at = NOW - DAY;
		const text = formatReportedAt(at, NOW, t);
		expect(text).toBe(new Date(at).toLocaleString());
		expect(text).not.toBe(new Date(at).toLocaleTimeString());
	});

	it('prints the caller-chosen text when nothing was sent', () => {
		expect(formatReportedAt(undefined, NOW, t)).toBe('N/A');
		expect(formatReportedAt(undefined, NOW, t, 'No data')).toBe('No data');
	});
});
