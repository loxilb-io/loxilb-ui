//---------------------------------------------------------
// Reported-at instants: "never" is not a time, and a time is not "today"
//---------------------------------------------------------
// Gateway timestamps reach the UI with two "no report yet" sentinels that
// parse as perfectly finite instants:
//   - Go's zero `time.Time` (`0001-01-01T00:00:00Z`). go-swagger's
//     `strfmt.DateTime` is a struct, so `omitempty` never drops it: a GPU
//     monitor no worker has reported to still sends `last_metrics_update`.
//   - A gauge that starts at 0 (`loxilb_last_restore_timestamp_seconds`
//     before the first restore): the Unix epoch.
// Read as instants, both print a date decades or millennia ago and make any
// "older than N seconds" check fire — "stalled" for something that never
// started. Neither can be a real report, so anything at or before the epoch
// is "never" — worded "None since start", because both are in-memory state
// that a gateway restart resets.
//
// A real instant is printed as a bare clock time only when it falls on the
// viewer's current local day; otherwise the date is included, so yesterday's
// persist cannot read as this morning's.

import type {TFunction} from 'i18next';

export type ReportedAt = number | 'never' | undefined;

/** An ISO date-time from a gateway body: epoch ms, 'never' for a zero-time sentinel, undefined when absent or unparsable. */
export function reportedAtFromIso(iso: string | undefined): ReportedAt {
	if (!iso) return undefined;
	return fromMs(Date.parse(iso));
}

/** A Unix-seconds gauge value: epoch ms, 'never' for 0, undefined when absent or not finite. */
export function reportedAtFromSeconds(seconds: number | undefined): ReportedAt {
	if (seconds === undefined) return undefined;
	return fromMs(seconds * 1000);
}

function fromMs(ms: number): ReportedAt {
	if (!Number.isFinite(ms)) return undefined;
	return ms <= 0 ? 'never' : ms;
}

function sameLocalDay(a: number, b: number): boolean {
	const x = new Date(a);
	const y = new Date(b);
	return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/**
 * Display text for a reported instant. `nowMs` is a parameter, not
 * `Date.now()`, so "is it today" is decided by the caller's clock.
 */
export function formatReportedAt(at: ReportedAt, nowMs: number, t: TFunction, missing = t('N/A')): string {
	if (at === undefined) return missing;
	if (at === 'never') return t('None since start');
	const d = new Date(at);
	return sameLocalDay(at, nowMs) ? d.toLocaleTimeString() : d.toLocaleString();
}
