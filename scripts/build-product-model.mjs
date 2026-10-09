// Author build only: reused dependencies are not a clean reproduction receipt.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {immutableGit,gitEnvironment} from './immutable-git.mjs';
import {productModel,verifyModelSpecs} from './api-spec-model.mjs';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export function selectGenerated(root,model) {
 productModel(model);
 const sources=verifyModelSpecs(root,model);
 const files=['gateway.ts','gateway-extras.ts','oam.ts','loxilb-capability-map.json'];
 const generated={};
 for(const file of files) {
  const from=path.join(root,'src/api/gen',model==='general'?'':`models/${model}`,file);
  const bytes=fs.readFileSync(from);
  generated[file]=sha(bytes);
  if(model!=='general') fs.writeFileSync(path.join(root,'src/api/gen',file),bytes);
 }
 return {model,sources,generated};
}
export function requireSourceContract(root,model) {
 const sources=verifyModelSpecs(root,productModel(model));
 const gaps=JSON.parse(fs.readFileSync(path.join(root,'api-spec/KNOWN_CONTRACT_GAPS.json'))).gaps;
 if(gaps.some(row=>row.model===model && row.producerCommit===sources.gateway.commit && row.swaggerSha256===sources.gateway.sha256['gateway-swagger.yml'] && row.status==='OPEN')) throw new Error('SOURCE_CONTRACT_BLOCKED: exact pinned producer has an open contract gap');
 return sources;
}
function run(executable,args,options={}) {
 const result=spawnSync(executable,args,{env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent'},timeout:600000,maxBuffer:16*1024*1024,...options});
 if(result.error || result.status!==0) throw new Error(`command refused/failed: ${path.basename(executable)} ${args.join(' ')}\n${result.stderr?.toString()??result.error}`);
 return result.stdout;
}
function main() {
 const options={};let apply=false;
 const args=process.argv.slice(2);
 while(args.length) {
  const name=args.shift();
  if(name==='--apply'&&!apply){apply=true;continue;}
  if(!['--model','--commit','--output','--dependencies'].includes(name)||options[name]||!args.length) throw new Error('invalid or duplicate argument');
  options[name]=args.shift();
 }
 const model=productModel(options['--model']??'general');
 const commit=options['--commit'];
 if(!/^[0-9a-f]{40}$/.test(commit??'')) throw new Error('exact source commit required');
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const git=(args)=>immutableGit(root,args);
 if(git(['rev-parse',`${commit}^{commit}`]).toString().trim()!==commit) throw new Error('source commit mismatch');
 for(const file of ['scripts/build-product-model.mjs','scripts/api-spec-model.mjs','scripts/immutable-git.mjs']) {
  if(sha(git(['show',`${commit}:${file}`]))!==sha(fs.readFileSync(path.join(root,file)))) throw new Error('build helper is not the selected source commit');
 }
 if(git(['ls-tree','-r','-z',commit]).toString().split('\0').some(row=>row.startsWith('120000 '))) throw new Error('source archive symlinks are unsupported');
 const output=options['--output'];const dependencyInput=options['--dependencies'];
 if(!output||!dependencyInput||!path.isAbsolute(output)||!path.isAbsolute(dependencyInput)) throw new Error('absolute output and dependency checkout required');
 const destination=path.join(fs.realpathSync(path.dirname(output)),path.basename(output));
 if(fs.existsSync(destination)) throw new Error('output already exists');
 const inGit=spawnSync('/usr/bin/git',['--no-replace-objects','rev-parse','--git-dir'],{cwd:path.dirname(destination),env:gitEnvironment});
 if(inGit.status===0) throw new Error('output must be outside Git');
 const plan={status:'AUTHOR_BUILD_PLANNED',model,sourceCommit:commit,output:destination,dependencies:fs.realpathSync(dependencyInput),cleanReproduction:false};
 if(!apply){console.log(JSON.stringify(plan,null,2));return;}
 fs.mkdirSync(destination,{mode:0o700});
 try {
  const archive=git(['archive','--format=tar',commit]);
  run('/usr/bin/tar',['-xf','-','-C',destination],{input:archive});
  const lock=fs.readFileSync(path.join(destination,'package-lock.json'));
  if(sha(lock)!==sha(fs.readFileSync(path.join(plan.dependencies,'package-lock.json')))) throw new Error('dependency checkout lock mismatch');
  const modules=fs.realpathSync(path.join(plan.dependencies,'node_modules'));
  if(!fs.statSync(modules).isDirectory()) throw new Error('dependency tree unavailable');
  fs.symlinkSync(modules,path.join(destination,'node_modules'));
  const env={PATH:`${path.dirname(process.execPath)}:/usr/bin:/bin`,HOME:'/nonexistent',CI:'true',PRODUCT_MODEL:model,
   REACT_APP_VERSION:JSON.parse(fs.readFileSync(path.join(destination,'package.json'))).version,
   REACT_APP_PRODUCT_MODEL:model,REACT_APP_SOURCE_COMMIT:commit};
  const node=(args)=>run(process.execPath,args,{cwd:destination,env});
  node(['scripts/gen-api-types.mjs']);
  node(['scripts/gen-capability-map.mjs']);
  const selected=selectGenerated(destination,model);
  requireSourceContract(destination,model);
  node(['scripts/check-api-mapping.mjs']);
  node(['node_modules/vitest/vitest.mjs','run','src/api/contract.test.ts','src/api/loxilb-subset.contract.test.ts']);
  node(['node_modules/eslint/bin/eslint.js','src','--ext','.ts,.tsx','--max-warnings','0']);
  node(['node_modules/typescript/bin/tsc','--noEmit']);
  node(['node_modules/vite/bin/vite.js','build','--mode','production']);
  // Bind the emitted bundle to the exact selected producer bytes and generated inputs.
  const artifacts={};
  const walk=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
   const file=path.join(directory,entry.name);
   if(entry.isSymbolicLink()) throw new Error('unexpected bundle symlink');
   if(entry.isDirectory())walk(file);else artifacts[path.relative(path.join(destination,'build'),file)]=sha(fs.readFileSync(file));
  }};
  walk(path.join(destination,'build'));
  const receipt={...plan,status:'AUTHOR_BUILD_COMPLETED',kind:'NetLOXModelClientAuthorBuild',nodeVersion:process.version,
   nodeSha256:sha(fs.readFileSync(process.execPath)),lockSha256:sha(lock),...selected,artifacts};
  fs.writeFileSync(path.join(destination,'build','api-contract.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify(receipt,null,2));
 } catch(error) {
  fs.writeFileSync(path.join(destination,'AUTHOR_BUILD_FAILED.json'),JSON.stringify({...plan,status:'AUTHOR_BUILD_FAILED',reason:error.message},null,2)+'\n',{mode:0o600});
  throw error;
 }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try{main();}catch(error){console.error(error.message);process.exitCode=1;}
}
