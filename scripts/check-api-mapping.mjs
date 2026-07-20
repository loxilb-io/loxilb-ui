// H4 mapping-correctness guard.
//
// Extracts every REST call the connector layer makes (GET/POST/PUT/PATCH/
// DELETE _INST and _OAM variants, incl. GET_INST_TEXT / UPLOAD_FILE_OAM /
// DOWNLOAD_FILE_OAM) and asserts the path+method exists in the vendored specs
// under api-spec/. Exits 1 on any orphan call — wire into CI so a connector
// can never silently call a path the backend does not declare.
//
// Usage:  npm run api:check-mapping             (guard mode)
//         node scripts/check-api-mapping.mjs --coverage
//                                               (also print spec endpoints the
//                                                UI never calls, for gap review)
//
// Matching rules:
//   - `${expr}` template holes are normalized to {p}; query strings dropped.
//   - a spec {param} segment matches any connector segment (literal or hole);
//   - a connector {p} hole only matches a spec {param} segment — a hole where
//     the spec expects a literal is a mismatch.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COVERAGE = process.argv.includes('--coverage');

//---------------------------------------------------------
// Load specs
//---------------------------------------------------------
function loadSpec(rel) {
	const raw = fs.readFileSync(path.join(root, rel), 'utf8');
	return rel.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw);
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

// -> Map<pathTemplate, Set<method>>; ops tagged x-not-implemented in the spec
// (declared but unwired in the backend, i.e. runtime 501) are excluded from the
// callable route set, so a connector calling one FAILS this guard.
const notImplemented = [];
function specRoutes(...specs) {
	const routes = new Map();
	for (const spec of specs) {
		for (const [p, ops] of Object.entries(spec.paths ?? {})) {
			if (!routes.has(p)) routes.set(p, new Set());
			for (const m of HTTP_METHODS) {
				if (!ops[m]) continue;
				if (ops[m]['x-not-implemented']) {
					notImplemented.push(`${m.toUpperCase()} ${p}`);
					continue;
				}
				routes.get(p).add(m);
			}
		}
	}
	return routes;
}

const gatewayRoutes = specRoutes(loadSpec('api-spec/gateway-swagger.yml'), loadSpec('api-spec/gateway-swagger-extras.yml'));
const oamRoutes = specRoutes(loadSpec('api-spec/oam-swagger.json'));

//---------------------------------------------------------
// Extract connector calls
//---------------------------------------------------------
function* walk(dir) {
	for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) yield* walk(p);
		else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) yield p;
	}
}

// GET_INST / GET_INST_TEXT take (instance, url, ...); _OAM take (url, ...).
const CALL_RE = /\b(GET|POST|PUT|PATCH|DELETE|UPLOAD_FILE|DOWNLOAD_FILE)_(INST|OAM)(_TEXT)?\s*(?:<[^(]*>)?\(\s*(?:instance\s*,\s*)?([^,)]+)/g;

function normalize(raw) {
	let s = raw.trim();
	// resolveArg's capture stops at the first nested quote, so a hole holding a
	// ternary/query-builder arrives unterminated — the base path precedes it.
	s = s.replace(/\$\{[^}]*$/, '');
	s = s.split('?')[0]; // literal query string
	s = s.replace(/\$\{[^}]*\}/g, '{p}');
	s = s.replace(/(\{p\})+/g, '{p}'); // `${base}${query}` style suffix builders
	return s;
}

// resolve first-arg expressions: literal/template string, or an identifier
// assigned a string earlier in the same file.
function resolveArg(arg, src) {
	const m = arg.match(/^[`'"](.*)[`'"]$/s);
	if (m) return m[1];
	const id = arg.trim();
	if (!/^[A-Za-z_$][\w$]*$/.test(id)) return null;
	const assign = src.match(new RegExp(`(?:const|let|var)\\s+${id}\\s*=\\s*[\`'"]([^\`'"]*)[\`'"]`));
	if (assign) return assign[1];
	// `let url = ...; url += ...` style or ternary — give up, must be listed manually
	return null;
}

const calls = []; // {file, line, method, target: 'gateway'|'oam', path}
const unresolved = [];

for (const file of walk(path.join(root, 'src/connector'))) {
	const src = fs.readFileSync(file, 'utf8');
	const rel = path.relative(root, file);
	if (rel.includes('fetcher')) continue; // definitions, not calls
	for (const m of src.matchAll(CALL_RE)) {
		const [, verb, kind, isText, argRaw] = m;
		const line = src.slice(0, m.index).split('\n').length;
		const resolved = resolveArg(argRaw, src);
		if (resolved === null) {
			unresolved.push({file: rel, line, call: m[0].trim()});
			continue;
		}
		const method = verb === 'UPLOAD_FILE' ? 'post' : verb === 'DOWNLOAD_FILE' ? 'get' : verb.toLowerCase();
		const p = normalize(resolved);
		if (!p.startsWith('/')) continue; // not a path (defensive)
		calls.push({file: rel, line, method: isText ? 'get' : method, target: kind === 'INST' ? 'gateway' : 'oam', path: p});
	}
}

// Raw fetch() calls in connectors that bypass the wrappers (log downloads).
// Keep this list in sync when adding raw fetch usage.
calls.push(
	{file: 'src/connector/instance/status.ts', line: 0, method: 'get', target: 'gateway', path: '/log-archives/{p}'},
	{file: 'src/connector/oam/oam.ts', line: 0, method: 'get', target: 'oam', path: '/logs/archives/{p}'},
	{file: 'src/connector/oam/snapshotApi.ts', line: 0, method: 'get', target: 'oam', path: '/snapshots/{sid}/download'},
);

//---------------------------------------------------------
// Match
//---------------------------------------------------------
function segMatch(specSeg, callSeg) {
	const specParam = specSeg.startsWith('{');
	const callParam = callSeg.startsWith('{');
	if (specParam) return true; // spec param matches literal or hole
	if (callParam) return false; // hole where spec expects a literal
	return specSeg === callSeg;
}

function findRoute(routes, callPath) {
	if (routes.has(callPath)) return callPath;
	const cs = callPath.split('/');
	for (const specPath of routes.keys()) {
		const ss = specPath.split('/');
		if (ss.length !== cs.length) continue;
		if (ss.every((s, i) => segMatch(s, cs[i]))) return specPath;
	}
	return null;
}

const orphans = [];
const usedRoutes = {gateway: new Map(), oam: new Map()}; // specPath -> Set<method>

for (const c of calls) {
	const routes = c.target === 'gateway' ? gatewayRoutes : oamRoutes;
	const lookupPath = c.target === 'oam' ? `/oam${c.path}` : c.path;
	const hit = findRoute(routes, lookupPath);
	if (!hit) {
		orphans.push({...c, reason: 'path not in spec', lookupPath});
		continue;
	}
	if (!routes.get(hit).has(c.method)) {
		orphans.push({...c, reason: `method ${c.method.toUpperCase()} not declared on ${hit}`, lookupPath});
		continue;
	}
	const used = usedRoutes[c.target];
	if (!used.has(hit)) used.set(hit, new Set());
	used.get(hit).add(c.method);
}

//---------------------------------------------------------
// Report
//---------------------------------------------------------
console.log(`checked ${calls.length} connector calls against ${gatewayRoutes.size} gateway + ${oamRoutes.size} OAM spec paths`);
if (notImplemented.length) console.log(`(${notImplemented.length} spec ops are marked x-not-implemented and treated as non-existent)`);

if (unresolved.length) {
	console.log(`\nWARN: ${unresolved.length} call(s) with URLs this script cannot statically resolve — verify manually:`);
	for (const u of unresolved) console.log(`  ${u.file}:${u.line}  ${u.call}`);
}

if (orphans.length) {
	console.error(`\nFAIL: ${orphans.length} connector call(s) do not match any spec route:`);
	for (const o of orphans) console.error(`  ${o.file}:${o.line}  ${o.method.toUpperCase()} ${o.lookupPath}  (${o.reason})`);
	process.exit(1);
}

console.log('OK: every connector call maps to a declared spec route.');

if (COVERAGE) {
	console.log('\n--- Spec endpoints with NO connector coverage ---');
	for (const [name, routes, used] of [
		['gateway', gatewayRoutes, usedRoutes.gateway],
		['oam', oamRoutes, usedRoutes.oam],
	]) {
		const missing = [];
		for (const [p, methods] of routes) {
			for (const m of methods) {
				if (!used.get(p)?.has(m)) missing.push(`${m.toUpperCase().padEnd(6)} ${p}`);
			}
		}
		console.log(`\n[${name}] ${missing.length} uncovered operation(s):`);
		for (const s of missing.sort((a, b) => a.slice(7).localeCompare(b.slice(7)) || a.localeCompare(b))) console.log('  ' + s);
	}
}
