import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {immutableGit} from './immutable-git.mjs';
import {productModel,specRelative,verifyModelSpecs} from './api-spec-model.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('exact producers and strict namespace selection',()=>{
 for(const model of ['general','kcmvp']) assert.equal(verifyModelSpecs(root,model).model,model);
 assert.throws(()=>productModel('typo'));
 assert.notEqual(specRelative('SOURCES.json','general'),specRelative('SOURCES.json','kcmvp'));
});
test('tampered bytes and wrong-model provenance refuse without fallback',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ui-model-spec-test-'));
 try {
  fs.cpSync(path.join(root,'api-spec'),path.join(tmp,'api-spec'),{recursive:true});
  const file=path.join(tmp,specRelative('gateway-swagger.yml','kcmvp'));
  fs.appendFileSync(file,'\n# changed bytes\n');
  assert.throws(()=>verifyModelSpecs(tmp,'kcmvp'),/digest drift/);
  const manifest=path.join(tmp,specRelative('SOURCES.json','general'));
  const value=JSON.parse(fs.readFileSync(manifest));value.model='kcmvp';fs.writeFileSync(manifest,JSON.stringify(value));
  assert.throws(()=>verifyModelSpecs(tmp,'general'),/wrong-model/);
 } finally {fs.rmSync(tmp,{recursive:true,force:true});}
});
test('wrong producer origin refuses before overwriting default specs',()=>{
 const file=path.join(root,'api-spec/gateway-swagger.yml');
 const before=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 const result=spawnSync(process.execPath,['scripts/sync-specs.mjs','--model','general','--gateway-repo',root,
  '--gateway-revision','9872446455338d8e2da9ca69eb23109b7e61623a','--oam-repo',root,
  '--oam-revision','7c295ab1dee185d60fc8e22231ae2cb861ab4cd5'],{cwd:root});
 assert.notEqual(result.status,0);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before);
});

test('real immutable import rejects replacement refs and ambient Git redirection',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ui-immutable-producer-'));
 const git=(repo,...args)=>{
  const result=spawnSync('/usr/bin/git',['-C',repo,...args],{env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);return result.stdout.trim();
 };
 try {
  const producer=(name,origin,files)=>{
   const repo=path.join(tmp,name);fs.mkdirSync(repo);git(repo,'init','-q');git(repo,'remote','add','origin',origin);
   for(const file of files){fs.mkdirSync(path.dirname(path.join(repo,file)),{recursive:true});fs.writeFileSync(path.join(repo,file),`original ${file}\n`);}
   git(repo,'add','.');git(repo,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','original');
   const original=git(repo,'rev-parse','HEAD');
   for(const file of files)fs.writeFileSync(path.join(repo,file),`replacement ${file}\n`);
   git(repo,'add','.');git(repo,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','replacement');
   git(repo,'replace',original,git(repo,'rev-parse','HEAD'));return {repo,original};
  };
  const gateway=producer('gateway','https://github.com/loxilb-io/loxilb-inference-gateway',['api/swagger.yml','api/swagger-extras.yml']);
  const oam=producer('oam','https://github.com/loxilb-io/loxilb-oam',['docs/swagger.json']);
  const client=path.join(tmp,'client');fs.mkdirSync(path.join(client,'scripts'),{recursive:true});fs.mkdirSync(path.join(client,'api-spec'));
  for(const file of ['sync-specs.mjs','api-spec-model.mjs','immutable-git.mjs'])fs.copyFileSync(path.join(root,'scripts',file),path.join(client,'scripts',file));
  fs.copyFileSync(path.join(root,'api-spec/SOURCES.json'),path.join(client,'api-spec/SOURCES.json'));
  const result=spawnSync(process.execPath,['scripts/sync-specs.mjs','--gateway-repo',gateway.repo,'--gateway-revision',gateway.original,'--oam-repo',oam.repo,'--oam-revision',oam.original],{
   cwd:client,env:{...process.env,GIT_DIR:'/nonexistent/poison',GIT_WORK_TREE:'/nonexistent/poison',GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'remote.origin.url',GIT_CONFIG_VALUE_0:'https://wrong.invalid'},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.equal(fs.readFileSync(path.join(client,'api-spec/gateway-swagger.yml'),'utf8'),'original api/swagger.yml\n');
  assert.equal(fs.readFileSync(path.join(client,'api-spec/oam-swagger.json'),'utf8'),'original docs/swagger.json\n');
  const sources=JSON.parse(fs.readFileSync(path.join(client,'api-spec/SOURCES.json')));
  assert.equal(sources.gateway.commit,gateway.original);assert.equal(sources.oam.commit,oam.original);
  const prior=process.env.GIT_DIR;process.env.GIT_DIR='/nonexistent/poison';
  try {
   assert.equal(immutableGit(gateway.repo,['show',`${gateway.original}:api/swagger.yml`]).toString(),'original api/swagger.yml\n');
   const archive=immutableGit(gateway.repo,['archive','--format=tar',gateway.original]);
   const entry=spawnSync('/usr/bin/tar',['-xOf','-','api/swagger.yml'],{input:archive,encoding:'utf8'});
   assert.equal(entry.status,0,entry.stderr);assert.equal(entry.stdout,'original api/swagger.yml\n');
  }finally{if(prior===undefined)delete process.env.GIT_DIR;else process.env.GIT_DIR=prior;}
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
