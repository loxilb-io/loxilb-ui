import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const script = fs.readFileSync(new URL('./sync-specs.sh', import.meta.url));

test('OAM-only sync pins committed bytes and preserves other sources', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-spec-test-'));
  const ui = path.join(root, 'ui');
  const oam = path.join(root, 'oam');
  const run = (cmd, args, cwd = oam) => spawnSync(cmd, args, {cwd, encoding: 'utf8', env: {...process.env, OAM_REPO: oam, GATEWAY_REPO: path.join(root, 'absent-gateway')}});
  const git = (...args) => {const r = run('git', args); assert.equal(r.status, 0, r.stderr); return r.stdout.trim();};
  try {
    fs.mkdirSync(path.join(ui, 'scripts'), {recursive: true});
    fs.mkdirSync(path.join(ui, 'api-spec'));
    fs.mkdirSync(path.join(oam, 'docs'), {recursive: true});
    fs.writeFileSync(path.join(ui, 'scripts/sync-specs.sh'), script);
    const sources = {gateway: {commit: 'preserved'}, oam: {dirty: true}, loxilb: {note: 'preserved'}, metricManifest: {commit: 'preserved'}, vendoredAt: 'preserved'};
    fs.writeFileSync(path.join(ui, 'api-spec/SOURCES.json'), JSON.stringify(sources));
    fs.writeFileSync(path.join(ui, 'api-spec/oam-swagger.json'), 'original');
    fs.writeFileSync(path.join(oam, 'docs/swagger.json'), '{"swagger":"2.0"}\n');
    git('init'); git('add', '.');
    git('-c', 'user.name=Spec Test', '-c', 'user.email=spec@example.invalid', 'commit', '-m', 'fixture');
    const sha = git('rev-parse', 'HEAD');
    const sync = () => run('bash', ['scripts/sync-specs.sh', '--only', 'oam'], ui);
    assert.notEqual(sync().status, 0, 'branch heads must be rejected');
    assert.equal(fs.readFileSync(path.join(ui, 'api-spec/oam-swagger.json'), 'utf8'), 'original');
    git('checkout', '--detach', sha);
    fs.writeFileSync(path.join(oam, 'dirty'), 'dirty');
    assert.notEqual(sync().status, 0, 'dirty sources must be rejected');
    fs.unlinkSync(path.join(oam, 'dirty'));
    const ok = sync(); assert.equal(ok.status, 0, ok.stderr);
    const actual = JSON.parse(fs.readFileSync(path.join(ui, 'api-spec/SOURCES.json')));
    for (const key of ['gateway', 'loxilb', 'metricManifest', 'vendoredAt']) assert.deepEqual(actual[key], sources[key]);
    assert.equal(actual.oam.commit, sha); assert.equal(actual.oam.dirty, false);
    assert.equal(actual.oam.repo, 'loxilb-oam');
    assert.deepEqual(fs.readFileSync(path.join(ui, 'api-spec/oam-swagger.json')), fs.readFileSync(path.join(oam, 'docs/swagger.json')));
    assert.equal(git('status', '--porcelain'), '');
    fs.unlinkSync(path.join(oam, 'docs/swagger.json'));
    assert.notEqual(sync().status, 0, 'missing source must be rejected');
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});
