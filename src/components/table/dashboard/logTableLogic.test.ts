import {describe, expect, it} from 'vitest';
import {ILog} from 'types/log';
import {
	countLogsByLevel,
	extractLogTags,
	filterLogsByLevel,
	filterLogsByPeriod,
	formatCompactTimestamp,
	logTimestampMs,
	resolvePresetRange,
	sortLogsNewestFirst,
	splitLogComponent,
	toConsoleRow,
	toLogRow,
	visibleLogLevels,
} from './logTableLogic';

function log(timestamp: string, level = 'info', message = 'msg'): ILog {
	return {id: 0, created_at: timestamp, host: '', level, message, programname: '', timestamp};
}

describe('logTimestampMs', () => {
	it('reads the gateway timestamp format as UTC, not local time', () => {
		expect(logTimestampMs('2025/08/17 09:00:00')).toBe(Date.UTC(2025, 7, 17, 9, 0, 0));
	});

	it('returns NaN rather than throwing for an unparseable timestamp', () => {
		expect(Number.isNaN(logTimestampMs('not a timestamp'))).toBe(true);
	});
});

describe('sortLogsNewestFirst', () => {
	it('orders newest first', () => {
		const sorted = sortLogsNewestFirst([
			log('2025/08/17 09:00:00', 'info', 'older'),
			log('2025/08/17 11:00:00', 'info', 'newest'),
			log('2025/08/17 10:00:00', 'info', 'middle'),
		]);
		expect(sorted.map(l => l.message)).toEqual(['newest', 'middle', 'older']);
	});

	// Regression: the tables used to call data.sort() directly on the array held
	// in the parent's state, reordering it in place.
	it('does not reorder the array it is given', () => {
		const input = [log('2025/08/17 09:00:00', 'info', 'a'), log('2025/08/17 11:00:00', 'info', 'b')];
		const before = input.map(l => l.message);

		const sorted = sortLogsNewestFirst(input);

		expect(input.map(l => l.message)).toEqual(before);
		expect(sorted).not.toBe(input);
	});

	it('keeps a stable order when a timestamp cannot be parsed', () => {
		const sorted = sortLogsNewestFirst([log('2025/08/17 09:00:00', 'info', 'real'), log('garbage', 'info', 'bad')]);
		expect(sorted).toHaveLength(2);
		expect(sorted.map(l => l.message)).toContain('real');
	});
});

describe('filterLogsByPeriod', () => {
	const logs = [log('2025/08/17 09:00:00', 'info', 'in'), log('2025/08/17 23:00:00', 'info', 'late')];

	// Regression: the window was seeded with `end = now` when the table mounted,
	// so lines written after that instant were dropped and an actively-written
	// log emptied its own table a few minutes after it was opened.
	it('filters nothing when neither bound is set', () => {
		expect(filterLogsByPeriod(logs, '', '')).toHaveLength(2);
		expect(filterLogsByPeriod(logs, '', '')).toBe(logs);
	});

	// Regression: both bounds used to be required, so adjusting a single picker
	// silently did nothing and the control read as broken.
	it('treats a lone start bound as "since X"', () => {
		const filtered = filterLogsByPeriod(logs, '2025-08-17T12:00:00Z', '');
		expect(filtered.map(l => l.message)).toEqual(['late']);
	});

	it('treats a lone end bound as "until Y"', () => {
		const filtered = filterLogsByPeriod(logs, '', '2025-08-17T12:00:00Z');
		expect(filtered.map(l => l.message)).toEqual(['in']);
	});

	it('keeps only the lines inside an explicit range', () => {
		const filtered = filterLogsByPeriod(logs, '2025-08-17T08:00:00Z', '2025-08-17T10:00:00Z');
		expect(filtered.map(l => l.message)).toEqual(['in']);
	});

	it('includes the lines exactly on each bound', () => {
		const filtered = filterLogsByPeriod(logs, '2025-08-17T09:00:00Z', '2025-08-17T23:00:00Z');
		expect(filtered).toHaveLength(2);
	});

	it('ignores an unparseable bound rather than dropping everything', () => {
		expect(filterLogsByPeriod(logs, 'nonsense', 'nonsense')).toHaveLength(2);
		expect(filterLogsByPeriod(logs, 'nonsense', '2025-08-17T12:00:00Z').map(l => l.message)).toEqual(['in']);
	});
});

describe('filterLogsByLevel', () => {
	const logs = [log('2025/08/17 09:00:00', 'ERROR'), log('2025/08/17 10:00:00', 'info')];

	it('returns everything when no level is selected', () => {
		expect(filterLogsByLevel(logs, '')).toHaveLength(2);
	});

	it('matches the level case-insensitively', () => {
		expect(filterLogsByLevel(logs, 'error')).toHaveLength(1);
		expect(filterLogsByLevel(logs, 'ERROR')).toHaveLength(1);
	});

	it('does not copy when nothing is filtered out', () => {
		expect(filterLogsByLevel(logs, '')).toBe(logs);
	});
});

describe('toLogRow', () => {
	it('indexes rows by position so appended pages do not collide', () => {
		const rows = [log('2025/08/17 09:00:00'), log('2025/08/17 10:00:00')].map(toLogRow);
		expect(rows.map(r => r.id)).toEqual([0, 1]);
	});

	it('falls back to the raw string when the timestamp cannot be parsed', () => {
		expect(toLogRow(log('garbage'), 0).timestamp).toBe('garbage');
	});
});

describe('resolvePresetRange', () => {
	const now = Date.UTC(2026, 7, 17, 12, 0, 0);

	it('resolves a duration preset to an open-ended window starting in the past', () => {
		const {start, end} = resolvePresetRange('15m', now);
		expect(new Date(start).getTime()).toBe(now - 15 * 60_000);
		expect(end).toBe('');
	});

	// Regression guard for the whole class of bug that started this work: a
	// window whose end is pinned at render time hides every line written after.
	it('never pins an end bound, so newer lines are always in range', () => {
		for (const preset of ['5m', '15m', '1h', '24h'] as const) {
			expect(resolvePresetRange(preset, now).end).toBe('');
		}
	});

	it('re-resolves against the clock rather than freezing', () => {
		const first = resolvePresetRange('5m', now).start;
		const later = resolvePresetRange('5m', now + 60_000).start;
		expect(new Date(later).getTime() - new Date(first).getTime()).toBe(60_000);
	});

	it('treats "all" as no bounds at all', () => {
		expect(resolvePresetRange('all', now)).toEqual({start: '', end: ''});
	});

	it('passes custom ranges through untouched', () => {
		const custom = {start: '2026-08-17T00:00:00Z', end: '2026-08-17T06:00:00Z'};
		expect(resolvePresetRange('custom', now, custom)).toEqual(custom);
	});

	it('falls back to no bounds when custom is selected but unset', () => {
		expect(resolvePresetRange('custom', now)).toEqual({start: '', end: ''});
	});
});

describe('splitLogComponent', () => {
	it('lifts a bracketed subsystem out of the message', () => {
		expect(splitLogComponent('[Metrics] Updated global ConntrackInfo')).toEqual({
			component: 'Metrics',
			body: 'Updated global ConntrackInfo',
		});
	});

	it('leaves unprefixed lines alone', () => {
		expect(splitLogComponent('vLLM scraper: 33.33.33.1:80 returned no metrics')).toEqual({
			component: '',
			body: 'vLLM scraper: 33.33.33.1:80 returned no metrics',
		});
	});

	it('does not treat a mid-line bracket as a component', () => {
		const line = 'api: failed [retry] later';
		expect(splitLogComponent(line)).toEqual({component: '', body: line});
	});
});

describe('extractLogTags', () => {
	it('pulls model and tenant out of an AI gateway line', () => {
		expect(extractLogTags('llb_ai_stream_end: tenant=acme model=sse-test')).toEqual({
			model: 'sse-test',
			tenant: 'acme',
		});
	});

	it('handles an empty tenant value without swallowing the next key', () => {
		expect(extractLogTags('llb_ai_stream_end: tenant= model=sse-test')).toEqual({
			model: 'sse-test',
			tenant: '',
		});
	});

	it('returns blanks when the line carries no tags', () => {
		expect(extractLogTags('[Metrics] Processing 4 conntrack entries')).toEqual({model: '', tenant: ''});
	});

	it('does not match a key that is only a suffix of another', () => {
		expect(extractLogTags('submodel=nope').model).toBe('');
	});
});

describe('countLogsByLevel', () => {
	const mk = (level: string): ILog => ({
		id: 0, created_at: '', host: '', level, message: '', programname: '', timestamp: '2026/08/17 09:00:00',
	});

	it('counts each level', () => {
		expect(countLogsByLevel([mk('ERROR'), mk('INFO'), mk('ERROR')])).toEqual({ERROR: 2, INFO: 1});
	});

	it('normalises case so DEBUG and debug are one bucket', () => {
		expect(countLogsByLevel([mk('debug'), mk('DEBUG')])).toEqual({DEBUG: 2});
	});

	it('buckets a missing level rather than dropping the line', () => {
		expect(countLogsByLevel([mk('')])).toEqual({UNKNOWN: 1});
	});
});

describe('formatCompactTimestamp', () => {
	it('renders MM-DD HH:MM:SS in local time', () => {
		const local = new Date(Date.UTC(2026, 7, 17, 9, 0, 0));
		const pad = (n: number) => String(n).padStart(2, '0');
		const expected = `${pad(local.getMonth() + 1)}-${pad(local.getDate())} ${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`;
		expect(formatCompactTimestamp('2026/08/17 09:00:00')).toBe(expected);
	});

	it('is far shorter than the locale string it replaces', () => {
		expect(formatCompactTimestamp('2026/08/17 09:00:00').length).toBe(14);
	});

	it('falls back to the raw value when unparseable', () => {
		expect(formatCompactTimestamp('garbage')).toBe('garbage');
	});
});

describe('toConsoleRow', () => {
	const line: ILog = {
		id: 0, created_at: '', host: '', level: 'INFO', programname: '',
		message: '[AIGateway] llb_ai_stream_end: tenant=acme model=sse-test',
		timestamp: '2026/08/17 09:00:00',
	};

	it('splits component, tags and body into separate fields', () => {
		const row = toConsoleRow(line, 3);
		expect(row.component).toBe('AIGateway');
		expect(row.model).toBe('sse-test');
		expect(row.tenant).toBe('acme');
		expect(row.message).toBe('llb_ai_stream_end: tenant=acme model=sse-test');
		expect(row.id).toBe(3);
	});
});

describe('visibleLogLevels', () => {
	it('orders chips worst-first and omits levels with no lines', () => {
		expect(visibleLogLevels({DEBUG: 5, ERROR: 2, INFO: 9}, '')).toEqual(['ERROR', 'INFO', 'DEBUG']);
	});

	// The dead end this guards: filter on ERROR in one file, switch to a file
	// that holds none, and the chip used to disappear along with every row —
	// leaving "No lines match the current filters" and no way to see why, or
	// to click the filter off again.
	it('keeps the selected level visible when the current view holds none of it', () => {
		expect(visibleLogLevels({DEBUG: 1000}, 'ERROR')).toEqual(['ERROR', 'DEBUG']);
	});

	it('keeps a selected level that is not one of the known severities', () => {
		expect(visibleLogLevels({INFO: 3}, 'TRACE')).toEqual(['INFO', 'TRACE']);
	});

	it('matches the selection case-insensitively, as countLogsByLevel uppercases', () => {
		expect(visibleLogLevels({INFO: 3}, 'error')).toEqual(['ERROR', 'INFO']);
	});

	it('shows an unknown severity that appears in the data', () => {
		expect(visibleLogLevels({INFO: 1, NOTICE: 2}, '')).toEqual(['INFO', 'NOTICE']);
	});

	it('does not duplicate the selected level when it is also present', () => {
		expect(visibleLogLevels({ERROR: 4}, 'ERROR')).toEqual(['ERROR']);
	});

	it('renders nothing when there is neither data nor a selection', () => {
		expect(visibleLogLevels({}, '')).toEqual([]);
	});
});
