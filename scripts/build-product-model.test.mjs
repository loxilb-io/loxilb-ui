import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {selectGenerated,requireSourceContract} from './build-product-model.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
test('private selection overlays only ephemeral generated imports and binds exact provenance',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ui-build-selection-'));
 const original=path.join(root,'src/api/gen/gateway.ts');const before=digest(original);
 try {
  fs.cpSync(path.join(root,'api-spec'),path.join(tmp,'api-spec'),{recursive:true});
  fs.mkdirSync(path.join(tmp,'src/api'),{recursive:true});
  fs.cpSync(path.join(root,'src/api/gen'),path.join(tmp,'src/api/gen'),{recursive:true});
  const selected=selectGenerated(tmp,'kcmvp');
  assert.equal(selected.model,'kcmvp');assert.equal(selected.sources.model,'kcmvp');
  assert.equal(digest(path.join(tmp,'src/api/gen/gateway.ts')),selected.generated['gateway.ts']);
  assert.equal(digest(path.join(tmp,'src/api/gen/gateway.ts')),digest(path.join(root,'src/api/gen/models/kcmvp/gateway.ts')));
  assert.equal(digest(original),before);
  assert.throws(()=>selectGenerated(tmp,'unknown'));
  fs.appendFileSync(path.join(tmp,'api-spec/models/kcmvp/gateway-swagger.yml'),'# drift');
  assert.throws(()=>selectGenerated(tmp,'kcmvp'),/digest drift/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

test('both exact current producer pins block source-contract/build acceptance',()=>{
 for(const model of ['general','kcmvp']) assert.throws(()=>requireSourceContract(root,model),/SOURCE_CONTRACT_BLOCKED/);
});
