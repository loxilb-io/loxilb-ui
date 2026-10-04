import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {immutableGit} from './immutable-git.mjs';
import {fileURLToPath} from 'node:url';
import {productModel,specRelative} from './api-spec-model.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options={};
for (let i=2;i<process.argv.length;i+=2) {
 const key=process.argv[i];
 if (!['--model','--gateway-repo','--gateway-revision','--oam-repo','--oam-revision'].includes(key) || !process.argv[i+1] || key in options) throw new Error('exact producer arguments required');
 options[key]=process.argv[i+1];
}
const model=productModel(options['--model'] ?? 'general');
const git=(repo,...args)=>immutableGit(repo,args);

const producers=[['gateway',model==='general'?'https://github.com/loxilb-io/loxilb-inference-gateway':'https://github.com/netlox-io/loxilb-igw',
  [['api/swagger.yml','gateway-swagger.yml'],['api/swagger-extras.yml','gateway-swagger-extras.yml']]],
 ['oam','https://github.com/loxilb-io/loxilb-oam',[['docs/swagger.json','oam-swagger.json']]]];
const original=JSON.parse(fs.readFileSync(path.join(root,'api-spec/SOURCES.json'),'utf8'));
const sources={model,kind:'ExactApiProducerSources',loxilb:original.loxilb};
const output=[];
for (const [name,origin,files] of producers) {
 const repo=options[`--${name}-repo`], revision=options[`--${name}-revision`];
 if (!repo || !/^[0-9a-f]{40}$/.test(revision ?? '')) throw new Error('exact full producer commit required');
 if (git(repo,'remote','get-url','origin').toString().trim().replace(/\.git$/,'')!==origin) throw new Error('wrong-model producer origin');
 if (git(repo,'rev-parse',`${revision}^{commit}`).toString().trim()!==revision) throw new Error('producer commit mismatch');
 const entry={repo:origin.split('/').at(-1),repository:origin,commit:revision,dirty:false,readMode:'immutable-git-blobs',sha256:{}};
 for(const [source,file] of files) {
  const bytes=git(repo,'show',`${revision}:${source}`);
  entry.sha256[file]=crypto.createHash('sha256').update(bytes).digest('hex');
  output.push([path.join(root,specRelative(file,model)),bytes]);
 }
 sources[name]=entry;
}
// Validate all producers before changing any vendored file; never run swag or modify them.
for(const [file,bytes] of output){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}
fs.writeFileSync(path.join(root,specRelative('SOURCES.json',model)),JSON.stringify(sources,null,2)+'\n');
console.log(`vendored exact ${model} Gateway/OAM Git blobs`);
