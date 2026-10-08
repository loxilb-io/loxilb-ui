import assert from 'node:assert/strict';
import test from 'node:test';
import {loadConfigFromFile} from 'vite';

test('production prefix and public settings are preserved without exposing private environment', async () => {
 const names=['REACT_APP_PUBLIC_URL','REACT_APP_API_URL','REACT_APP_VERSION','UC6_PRIVATE_PROBE'];
 const before=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{REACT_APP_PUBLIC_URL:'/owned-console',REACT_APP_API_URL:'/owned-api/oam',REACT_APP_VERSION:'test-build',UC6_PRIVATE_PROBE:'never-embed-this-marker'});
 try {
  const {config}=await loadConfigFromFile({command:'build',mode:'production'}, 'vite.config.mts');
  assert.equal(config.base,'/owned-console/');
  assert.equal(config.define['process.env.REACT_APP_PUBLIC_URL'],'"/owned-console"');
  assert.equal(config.define['process.env.REACT_APP_API_URL'],'"/owned-api/oam"');
  assert.equal(config.define['process.env.REACT_APP_VERSION'],'"test-build"');
  assert.equal(config.define['process.env'],undefined);
  assert.ok(!JSON.stringify(config.define).includes('never-embed-this-marker'));
  assert.equal(config.build.outDir,'build');
  assert.equal(config.build.sourcemap,false);
 } finally {
  for(const k of names){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];}
 }
});

// The deployed container must boot on IPv4-only kernels without changing host sysctls.
import {mkdtempSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
test('optional IPv6 listeners preserve HTTP/TLS ports without requiring AF_INET6', () => {
 const dir=mkdtempSync(join(tmpdir(),'ui-ipv6-'));
 try {
  const available=join(dir,'if_inet6');writeFileSync(available,'loopback interface');
  for(const [file,expected] of [[join(dir,'missing'),'|'],[available,'listen [::]:8080;|listen [::]:8443 ssl;']]) {
   const result=spawnSync('/bin/sh',['-c','. ./nginx-ipv6.sh; HTTP_PORT=8080; HTTPS_PORT=8443; configure_ipv6_listeners "$1"; printf "%s|%s" "$IPV6_HTTP_LISTEN" "$IPV6_HTTPS_LISTEN"','sh',file],{encoding:'utf8'});
   assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,expected);
  }
  const entry=readFileSync('docker-entrypoint.sh','utf8');
  assert.ok(entry.includes('configure_ipv6_listeners'));assert.ok(entry.includes('${IPV6_HTTP_LISTEN} ${IPV6_HTTPS_LISTEN}'));
  for(const name of ['nginx-http.conf.template','nginx-https.conf.template']) {
   const template=readFileSync(name,'utf8');assert.ok(template.includes('listen ${HTTP_PORT};'));assert.ok(template.includes('${IPV6_HTTP_LISTEN}'));assert.ok(!template.includes('listen [::]'));
  }
  assert.ok(readFileSync('nginx-https.conf.template','utf8').includes('${IPV6_HTTPS_LISTEN}'));
 } finally {rmSync(dir,{recursive:true,force:true});}
});
