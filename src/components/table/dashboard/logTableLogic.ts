//---------------------------------------------------------
// Shared log list shaping used by LogTable and LogTableDashboard.
//
// Both tables previously carried their own copy of this block, and both copies
// sorted the caller's array in place. Keeping it in one place makes the "never
// mutate the caller's data" rule testable instead of a convention.
//---------------------------------------------------------
import {ILog} from 'types/log';

//---------------------------------------------------------
// Timestamp parsing
//---------------------------------------------------------
// The gateway emits "2025/08/17 09:00:00" in UTC with no zone marker. Slashes
// are swapped for dashes and a Z appended so it is read as UTC rather than in
// the browser's local zone.
export function logTimestampMs(timestamp: string): number {
	const normalized = new Date(timestamp.replace(/\//g, '-') + 'Z').getTime();
	if (!Number.isNaN(normalized)) return normalized;

	// Fall back to whatever the runtime makes of the raw string.
	return new Date(timestamp).getTime();
}

//---------------------------------------------------------
// Sorting
//---------------------------------------------------------
// Returns a new array, newest first. Unparseable timestamps sort oldest, which
// keeps the comparator consistent — returning NaN from a comparator leaves the
// resulting order unspecified.
export function sortLogsNewestFirst(logs: ILog[]): ILog[] {
	return [...logs].sort((a, b) => {
		const a_ms = logTimestampMs(a.timestamp);
		const b_ms = logTimestampMs(b.timestamp);
		return (Number.isNaN(b_ms) ? 0 : b_ms) - (Number.isNaN(a_ms) ? 0 : a_ms);
	});
}

//---------------------------------------------------------
// Period filter
//---------------------------------------------------------
// Each bound is independent and optional:
//   neither -> no filtering at all
//   start   -> "since X"
//   end     -> "until Y"
//   both    -> bounded window
//
// Requiring both bounds meant adjusting a single picker did nothing, which read
// as a dead control. An unset range must also filter nothing: the range used to
// be seeded with `end = now` when the table mounted, so every line written after
// that instant was dropped and an actively-written log emptied its own table.
export function filterLogsByPeriod(logs: ILog[], start_datetime_str: string, end_datetime_str: string): ILog[] {
	const parseBound = (value: string, fallback: number) => {
		if (!value) return fallback;
		const ms = new Date(value).getTime();
		return Number.isNaN(ms) ? fallback : ms;
	};

	const start = parseBound(start_datetime_str, -Infinity);
	const end = parseBound(end_datetime_str, Infinity);
	if (start === -Infinity && end === Infinity) return logs;

	return logs.filter(item => {
		const ts = logTimestampMs(item.timestamp);
		return ts >= start && ts <= end;
	});
}

//---------------------------------------------------------
// Level filter
//---------------------------------------------------------
// Applied client-side over the lines already paged in, so changing the level
// re-filters what is loaded instead of restarting pagination.
export function filterLogsByLevel(logs: ILog[], level: string): ILog[] {
	if (!level) return logs;
	return logs.filter(log => log.level.toLowerCase() === level.toLowerCase());
}

//---------------------------------------------------------
// Row projection
//---------------------------------------------------------
export function toLogRow(item: ILog, index: number) {
	const ms = logTimestampMs(item.timestamp);
	return {
		id: index,
		timestamp: Number.isNaN(ms) ? item.timestamp : new Date(ms).toLocaleString(),
		level: item.level,
		host: item.host,
		message: item.message,
	};
}

//---------------------------------------------------------
// Time range presets
//---------------------------------------------------------
// Operators triage in windows ("what happened in the last 15 minutes"), not by
// typing two absolute datetimes. Presets are stored as a duration and resolved
// against the current clock on every pass — never captured at mount. That is
// what keeps a live window from freezing and silently hiding new lines, which
// is exactly how the original card ended up blanking itself.
export type TimeRangePreset = '5m' | '15m' | '1h' | '24h' | 'all' | 'custom';

export const TIME_RANGE_PRESETS: {value: TimeRangePreset; label: string; minutes: number | null}[] = [
	{value: '5m', label: 'Last 5 min', minutes: 5},
	{value: '15m', label: 'Last 15 min', minutes: 15},
	{value: '1h', label: 'Last 1 hour', minutes: 60},
	{value: '24h', label: 'Last 24 hours', minutes: 60 * 24},
	{value: 'all', label: 'All time', minutes: null},
	{value: 'custom', label: 'Custom range', minutes: null},
];

// Resolves a preset to the (start, end) pair the period filter expects. `now`
// is a parameter rather than a call to Date.now() so the behaviour is testable.
export function resolvePresetRange(
	preset: TimeRangePreset,
	now: number,
	custom?: {start: string; end: string},
): {start: string; end: string} {
	if (preset === 'custom') return {start: custom?.start ?? '', end: custom?.end ?? ''};

	const entry = TIME_RANGE_PRESETS.find(p => p.value === preset);
	if (!entry || entry.minutes === null) return {start: '', end: ''};

	// Open-ended on the right: anything newer than the window start belongs in
	// it, including lines written since the last render.
	return {start: new Date(now - entry.minutes * 60_000).toISOString(), end: ''};
}

//---------------------------------------------------------
// Message structure
//---------------------------------------------------------
// loxilb prefixes most lines with a bracketed subsystem — "[Metrics] …",
// "[AIGateway] …", "[Conntrack] …". Splitting it out gives the operator a
// column to scan instead of a wall of prose. Lines without a prefix (the vLLM
// scraper and bare api: messages) keep an empty component.
export function splitLogComponent(message: string): {component: string; body: string} {
	const match = /^\[([A-Za-z0-9_-]+)\]\s*(.*)$/s.exec(message);
	if (!match) return {component: '', body: message};
	return {component: match[1], body: match[2]};
}

// The AI gateway tags its lines with the tenant and model they belong to.
// Those are the two axes an AI infra operator actually pivots on, so they are
// lifted out of the message text into their own columns when present.
export function extractLogTags(message: string): {model: string; tenant: string} {
	const read = (key: string) => {
		const m = new RegExp(`\\b${key}=([^\\s,]*)`).exec(message);
		return m ? m[1] : '';
	};
	return {model: read('model'), tenant: read('tenant')};
}

//---------------------------------------------------------
// Severity summary
//---------------------------------------------------------
// Doubles as the level filter control: the counts answer "how bad is it" and
// clicking one narrows the table. Counted over whatever is currently loaded,
// which is the same scope the level filter applies to.
export function countLogsByLevel(logs: ILog[]): Record<string, number> {
	return logs.reduce<Record<string, number>>((acc, log) => {
		const key = (log.level || 'UNKNOWN').toUpperCase();
		acc[key] = (acc[key] ?? 0) + 1;
		return acc;
	}, {});
}

//---------------------------------------------------------
// Compact timestamp
//---------------------------------------------------------
// toLocaleString spells out the date and meridiem ("2026. 8. 17. 오후 4:03:56"),
// which is ~24 characters of mostly-repeated text on every row. Operators are
// reading a stream where the date rarely changes, so this keeps MM-DD HH:MM:SS
// in local time and lets the column shrink.
export function formatCompactTimestamp(timestamp: string): string {
	const ms = logTimestampMs(timestamp);
	if (Number.isNaN(ms)) return timestamp;

	const d = new Date(ms);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

//---------------------------------------------------------
// Console row projection
//---------------------------------------------------------
export function toConsoleRow(item: ILog, index: number) {
	const {component, body} = splitLogComponent(item.message);
	const {model, tenant} = extractLogTags(item.message);
	return {
		id: index,
		timestamp: formatCompactTimestamp(item.timestamp),
		level: item.level,
		component,
		model,
		tenant,
		message: body,
	};
}
