import {spawnSync} from 'node:child_process';
export const gitEnvironment = Object.freeze({PATH:'/usr/bin:/bin',HOME:'/nonexistent',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_SYSTEM:'/dev/null'});
export function immutableGit(repo,args) {
 const result=spawnSync('/usr/bin/git',['--no-replace-objects','-C',repo,...args],{env:gitEnvironment,maxBuffer:64*1024*1024,timeout:60000});
 if(result.error || result.status!==0) throw new Error('immutable Git read refused');
 return result.stdout;
}
