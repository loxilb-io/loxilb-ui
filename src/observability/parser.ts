//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {
	IExpositionLimitError,
	IMetricFamily,
	IMetricSample,
	IParseResult,
} from 'types/observability';
import {RuntimeMetricType} from './metricManifest';

//---------------------------------------------------------
// Prometheus text-format parser (UI-MON-002)
//---------------------------------------------------------
// Full text-format grammar over the label-preserving snapshot: HELP/TYPE
// comments, quoted-label escapes (\\ \" \n), optional per-sample timestamps,
// NaN/±Inf values, label-order-insensitive series identity, and histogram/
// summary suffix grouping (`foo_bucket`/`foo_sum`/`foo_count` samples belong
// to family `foo` once `# TYPE foo histogram|summary` was seen).
//
// Failure policy, from the request contract:
// - a malformed LINE is skipped and counted (`skippedSamples` + a bounded
//   warning list) — partial damage never invalidates the snapshot;
// - a breached LIMIT (body size, sample count, label/line length) is a typed
//   error, never a silent truncation — the caller decides how to fail.

// Hard limits, fixed at M0. A healthy gateway scrape is ~250 families and
// well under 1 MiB; these are backstops against a misbehaving backend, not
// tuning knobs.
export const EXPOSITION_LIMITS = {
	// UTF-16 code units ≈ bytes for the ASCII-dominated exposition format.
	bodyBytes: 8 * 1024 * 1024,
	sampleCount: 200_000,
	labelLength: 4_096,
	lineLength: 64 * 1024,
} as const;

// Warnings are diagnostics, not a log — cap them so a pathological body
// cannot balloon the snapshot itself.
const MAX_WARNINGS = 20;

const NAME_RE = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;
const VALUE_RE = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|[+-]?[Ii]nf(?:inity)?|[Nn][aA][nN])$/;

const KNOWN_TYPES: ReadonlySet<string> = new Set(['counter', 'gauge', 'histogram', 'summary', 'untyped']);

// Families the runtime contributes to the scrape (Go runtime, process, and
// promhttp handler). Parsed and retained — the legacy flat projection reads
// them — but they are outside the product contract: excluded from the
// contract family count and never registrable as a capability.
export function isDependencyFamily(name: string): boolean {
	return name.startsWith('go_') || name.startsWith('process_') || name.startsWith('promhttp_');
}

function parseValue(token: string): number | undefined {
	if (!VALUE_RE.test(token)) return undefined;
	if (/[Ii]nf/.test(token)) return token.startsWith('-') ? -Infinity : Infinity;
	if (/[Nn][aA][nN]/.test(token)) return NaN;
	const n = Number(token);
	return Number.isNaN(n) ? undefined : n;
}

// Unescapes a HELP text / label value: \\ → \, \" → " (labels only), \n →
// newline. An unknown escape passes the character through, matching the
// Prometheus scraper's lenient reading.
function unescapeText(raw: string): string {
	let out = '';
	for (let i = 0; i < raw.length; i++) {
		const c = raw[i];
		if (c !== '\\' || i === raw.length - 1) {
			out += c;
			continue;
		}
		const next = raw[++i];
		if (next === 'n') out += '\n';
		else if (next === '\\') out += '\\';
		else if (next === '"') out += '"';
		else out += next;
	}
	return out;
}

interface ILabelParse {
	labels: Record<string, string>;
	// Index just past the closing '}', or -1 on malformed input.
	end: number;
	limitBreach?: number; // observed label-value length beyond the limit
}

// Parses `{k="v",k2="v2"}` starting at `start` (the '{'). Handles escaped
// quotes/backslashes/newlines inside values and a trailing comma.
function parseLabels(line: string, start: number): ILabelParse {
	const labels: Record<string, string> = {};
	let i = start + 1;
	for (;;) {
		while (line[i] === ' ' || line[i] === ',') i++;
		if (line[i] === '}') return {labels, end: i + 1};
		// label name
		const nameStart = i;
		while (i < line.length && /[a-zA-Z0-9_]/.test(line[i])) i++;
		const name = line.slice(nameStart, i);
		if (name === '' || line[i] !== '=' || line[i + 1] !== '"') return {labels, end: -1};
		i += 2;
		// quoted value with escapes
		let raw = '';
		for (;;) {
			if (i >= line.length) return {labels, end: -1};
			const c = line[i];
			if (c === '\\') {
				if (i + 1 >= line.length) return {labels, end: -1};
				raw += c + line[i + 1];
				i += 2;
				continue;
			}
			if (c === '"') break;
			raw += c;
			i++;
		}
		i++; // past closing quote
		const value = unescapeText(raw);
		if (value.length > EXPOSITION_LIMITS.labelLength) {
			return {labels, end: -1, limitBreach: value.length};
		}
		labels[name] = value;
	}
}

// Canonical series identity: label order in the exposition is not
// significant, so equal label sets must collide here.
export function labelKeyOf(labels: Readonly<Record<string, string>>): string {
	return Object.keys(labels)
		.sort()
		.map(k => `${k}="${labels[k].replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`)
		.join(',');
}

// Maps a sample name to the family it belongs to: `foo_bucket`/`foo_sum`/
// `foo_count` collapse onto `foo` only when `foo` was TYPE-declared as a
// histogram or summary (`foo_bucket` is not valid for a summary and stays
// separate there).
function familyNameOf(sampleName: string, typedFamilies: ReadonlyMap<string, string>): string {
	for (const suffix of ['_bucket', '_sum', '_count'] as const) {
		if (!sampleName.endsWith(suffix)) continue;
		const base = sampleName.slice(0, -suffix.length);
		const t = typedFamilies.get(base);
		if (t === 'histogram' && (suffix === '_bucket' || suffix === '_sum' || suffix === '_count')) return base;
		if (t === 'summary' && (suffix === '_sum' || suffix === '_count')) return base;
	}
	return sampleName;
}

interface IMutableFamily {
	name: string;
	type: RuntimeMetricType;
	rawType?: string;
	help?: string;
	samples: IMetricSample[];
	seen: Set<string>; // sampleName + labelKey identities, for duplicate detection
}

export function parseExposition(text: string): IParseResult {
	const families = new Map<string, IMutableFamily>();
	const typedFamilies = new Map<string, string>(); // family → raw TYPE token
	const warnings: string[] = [];
	let skippedSamples = 0;
	let totalSamples = 0;
	let limitError: IExpositionLimitError | undefined;

	const warn = (msg: string) => {
		if (warnings.length < MAX_WARNINGS) warnings.push(msg);
		else if (warnings.length === MAX_WARNINGS) warnings.push('further warnings suppressed');
	};

	const familyOf = (name: string): IMutableFamily => {
		let f = families.get(name);
		if (!f) {
			const rawType = typedFamilies.get(name);
			f = {
				name,
				type: rawType === undefined ? 'untyped' : KNOWN_TYPES.has(rawType) ? (rawType as RuntimeMetricType) : 'unknown',
				rawType: rawType !== undefined && !KNOWN_TYPES.has(rawType) ? rawType : undefined,
				samples: [],
				seen: new Set(),
			};
			families.set(name, f);
		}
		return f;
	};

	if (text.length > EXPOSITION_LIMITS.bodyBytes) {
		limitError = {kind: 'body_bytes', limit: EXPOSITION_LIMITS.bodyBytes, observed: text.length};
	}

	const lines = limitError ? [] : text.split('\n');
	for (const rawLine of lines) {
		// The format allows leading/trailing whitespace around the whole line.
		const line = rawLine.trim();
		if (line === '') continue;

		if (line.length > EXPOSITION_LIMITS.lineLength) {
			limitError = {kind: 'line_length', limit: EXPOSITION_LIMITS.lineLength, observed: line.length};
			break;
		}

		if (line.startsWith('#')) {
			// `# HELP name text` / `# TYPE name type` — anything else is a comment.
			const m = line.match(/^#\s+(HELP|TYPE)\s+([a-zA-Z_:][a-zA-Z0-9_:]*)\s*(.*)$/);
			if (!m) continue;
			const [, keyword, name, rest] = m;
			if (keyword === 'HELP') {
				familyOf(name).help = unescapeText(rest);
			} else {
				const token = rest.trim();
				typedFamilies.set(name, token);
				const f = familyOf(name);
				f.type = KNOWN_TYPES.has(token) ? (token as RuntimeMetricType) : 'unknown';
				f.rawType = KNOWN_TYPES.has(token) ? undefined : token;
			}
			continue;
		}

		// Sample line: name[{labels}] value [timestamp]
		let name: string;
		let labels: Record<string, string> = {};
		let rest: string;
		const braceAt = line.indexOf('{');
		if (braceAt >= 0) {
			name = line.slice(0, braceAt);
			const parsed = parseLabels(line, braceAt);
			if (parsed.limitBreach !== undefined) {
				limitError = {kind: 'label_length', limit: EXPOSITION_LIMITS.labelLength, observed: parsed.limitBreach};
				break;
			}
			if (parsed.end < 0) {
				skippedSamples++;
				warn(`malformed labels: ${line.slice(0, 120)}`);
				continue;
			}
			labels = parsed.labels;
			rest = line.slice(parsed.end);
		} else {
			const sp = line.search(/[ \t]/);
			if (sp < 0) {
				skippedSamples++;
				warn(`malformed sample: ${line.slice(0, 120)}`);
				continue;
			}
			name = line.slice(0, sp);
			rest = line.slice(sp);
		}

		if (!NAME_RE.test(name)) {
			skippedSamples++;
			warn(`invalid metric name: ${line.slice(0, 120)}`);
			continue;
		}

		const parts = rest.trim().split(/[ \t]+/);
		if (parts.length < 1 || parts.length > 2 || parts[0] === '') {
			skippedSamples++;
			warn(`malformed value: ${line.slice(0, 120)}`);
			continue;
		}
		const value = parseValue(parts[0]);
		if (value === undefined) {
			skippedSamples++;
			warn(`unparseable value: ${line.slice(0, 120)}`);
			continue;
		}
		let sourceTimestampMs: number | undefined;
		if (parts.length === 2) {
			const ts = Number(parts[1]);
			if (!Number.isFinite(ts)) {
				skippedSamples++;
				warn(`unparseable timestamp: ${line.slice(0, 120)}`);
				continue;
			}
			sourceTimestampMs = ts;
		}

		if (totalSamples + 1 > EXPOSITION_LIMITS.sampleCount) {
			limitError = {kind: 'sample_count', limit: EXPOSITION_LIMITS.sampleCount, observed: totalSamples + 1};
			break;
		}

		const family = familyOf(familyNameOf(name, typedFamilies));
		const labelKey = labelKeyOf(labels);
		const identity = `${name} ${labelKey}`;
		if (family.seen.has(identity)) {
			// The format forbids duplicate series; keep the first occurrence so a
			// buggy exporter cannot silently double a value through re-emission.
			skippedSamples++;
			warn(`duplicate series: ${name}{${labelKey}}`);
			continue;
		}
		family.seen.add(identity);
		family.samples.push({name, labels, labelKey, value, sourceTimestampMs});
		totalSamples++;
	}

	// TYPE-only families with no samples are real (lazy vectors emit nothing
	// until touched) — they stay in the map with an empty sample list.
	const result = new Map<string, IMetricFamily>();
	let dependencyFamilies = 0;
	for (const f of families.values()) {
		if (isDependencyFamily(f.name)) dependencyFamilies++;
		result.set(f.name, {name: f.name, type: f.type, rawType: f.rawType, help: f.help, samples: f.samples});
	}

	return {
		families: result,
		diagnostics: {skippedSamples, warnings, totalSamples, dependencyFamilies},
		limitError,
	};
}
