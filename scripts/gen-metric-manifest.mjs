// Wraps the vendored gateway metric manifest (api-spec/metric-manifest.json,
// byte-for-byte upstream — vendored by sync-specs.sh) in the UI-owned version
// envelope and writes it to src/api/gen/ where application code may import it
// (CRA forbids imports from outside src/). The upstream artifact carries no
// version/generated-at field, so the envelope is where schema versioning and
// provenance live until the gateway adds them (tracked as a gateway handoff).
//
// Usage:  npm run gen:api   (part of the chain; writes src/api/gen/)
//
// Output is deterministic — provenance (commit, vendoredAt) is copied from
// api-spec/SOURCES.json rather than stamped at generation time — so
// `gen:api:check` can diff it in CI.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));

const manifest = readJson('api-spec/metric-manifest.json');
const provenance = readJson('api-spec/SOURCES.json').metricManifest;
if (!provenance?.commit) {
	console.error('api-spec/SOURCES.json has no metricManifest entry — run scripts/sync-specs.sh --only manifest first');
	process.exit(1);
}

// Sanity gates on the upstream shape this envelope schema version pins.
// A failure here means the gateway changed the manifest contract — bump
// schemaVersion deliberately after re-verifying the UI consumers.
const fail = msg => { console.error(`metric-manifest shape check failed: ${msg}`); process.exit(1); };
if (!Array.isArray(manifest.families)) fail('families[] missing');
if (manifest.contract?.total !== manifest.families.length)
	fail(`contract.total (${manifest.contract?.total}) != families length (${manifest.families.length})`);
const required = ['name', 'owner', 'class', 'packaged', 'type', 'labels', 'activation', 'priority', 'privacy', 'consumers', 'waiver', 'source'];
for (const f of manifest.families) {
	for (const k of required) if (!(k in f)) fail(`family ${f.name ?? '<unnamed>'} missing field ${k}`);
}
const classCounts = {};
for (const f of manifest.families) classCounts[f.class] = (classCounts[f.class] ?? 0) + 1;
for (const [cls, n] of Object.entries(manifest.contract.classes ?? {})) {
	if (classCounts[cls] !== n) fail(`contract.classes.${cls} (${n}) != counted (${classCounts[cls] ?? 0})`);
}

const envelope = {
	// UI-owned envelope schema version: bump when the envelope layout or the
	// pinned upstream field set above changes meaning.
	schemaVersion: 1,
	source: {
		repo: provenance.repo,
		path: provenance.path,
		commit: provenance.commit,
		vendoredAt: provenance.vendoredAt,
	},
	manifest,
};

fs.writeFileSync(
	path.join(root, 'src/api/gen/metric-manifest.json'),
	JSON.stringify(envelope, null, '\t') + '\n',
);
console.log(`src/api/gen/metric-manifest.json: ${manifest.families.length} families @ ${provenance.commit.slice(0, 8)}`);
