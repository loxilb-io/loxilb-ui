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
