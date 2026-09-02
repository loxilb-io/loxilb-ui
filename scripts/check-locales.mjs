#!/usr/bin/env node
// Locale parity gate (npm run locale:check).
//
// en.json is the reference catalogue (keys in this codebase are the English
// source strings). Every language must agree with it exactly:
//   1. key parity, both directions — a key missing from a translation renders
//      raw English; a key absent from en is an orphan nothing can ever render;
//   2. interpolation parity — {{placeholder}} sets must match per key, or the
//      translation crashes/garbles at runtime;
//   3. no empty-string values.
//
// Known historical debt can be carried in scripts/locale-allowlist.json
// ({"missing": {"ja": ["key", …]}, "orphan": {"ko": ["key", …]}}) so NEW
// drift fails immediately while the debt is burned down — the allowlist is
// expected to be empty and stay empty; every entry needs an owner in the PR
// that adds it.
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REFERENCE = 'en';
const LANGS = ['en', 'ko', 'ja'];

const read = f => JSON.parse(readFileSync(join(root, f), 'utf8'));
const catalogues = Object.fromEntries(LANGS.map(l => [l, read(`src/locales/${l}.json`)]));
let allow = {missing: {}, orphan: {}};
try {
	allow = {...allow, ...read('scripts/locale-allowlist.json')};
} catch {
	/* no allowlist — strict mode */
}

const placeholders = s => (typeof s === 'string' ? [...s.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)].map(m => m[1]).sort() : []);

const failures = [];
const ref = catalogues[REFERENCE];
const refKeys = new Set(Object.keys(ref));

for (const lang of LANGS) {
	const cat = catalogues[lang];
	const keys = new Set(Object.keys(cat));

	if (lang !== REFERENCE) {
		const allowMissing = new Set(allow.missing?.[lang] ?? []);
		const allowOrphan = new Set(allow.orphan?.[lang] ?? []);
		for (const k of refKeys) {
			if (!keys.has(k) && !allowMissing.has(k)) failures.push(`${lang}: MISSING  ${JSON.stringify(k)}`);
		}
		for (const k of keys) {
			if (!refKeys.has(k) && !allowOrphan.has(k)) failures.push(`${lang}: ORPHAN   ${JSON.stringify(k)}`);
		}
		for (const k of keys) {
			if (!refKeys.has(k)) continue;
			const a = placeholders(ref[k]).join(',');
			const b = placeholders(cat[k]).join(',');
			if (a !== b) failures.push(`${lang}: INTERP   ${JSON.stringify(k)} en={${a}} ${lang}={${b}}`);
		}
	}
	for (const [k, v] of Object.entries(cat)) {
		if (typeof v === 'string' && v.trim() === '') failures.push(`${lang}: EMPTY    ${JSON.stringify(k)}`);
	}
}

// The allowlist must not shelter entries that no longer exist — stale rows
// hide the moment a key is fixed or deleted, so they fail too.
for (const [lang, list] of Object.entries(allow.missing ?? {})) {
	for (const k of list) {
		if (!refKeys.has(k) || Object.hasOwn(catalogues[lang] ?? {}, k)) failures.push(`allowlist: STALE missing/${lang} ${JSON.stringify(k)}`);
	}
}
for (const [lang, list] of Object.entries(allow.orphan ?? {})) {
	for (const k of list) {
		if (!Object.hasOwn(catalogues[lang] ?? {}, k) || refKeys.has(k)) failures.push(`allowlist: STALE orphan/${lang} ${JSON.stringify(k)}`);
	}
}

const counts = LANGS.map(l => `${l}=${Object.keys(catalogues[l]).length}`).join(' ');
if (failures.length) {
	console.error(`locale:check FAILED — ${failures.length} finding(s)  (${counts})\n`);
	for (const f of failures.sort()) console.error('  ' + f);
	process.exit(1);
}
console.log(`locale:check OK  (${counts})`);
