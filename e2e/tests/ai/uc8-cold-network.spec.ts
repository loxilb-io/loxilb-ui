// Separate cold-start Gateway using a protected copy of the QA LKG snapshot.
// The primary Gateway, OAM and DB remain running. The cold container is stopped
// and retained for evidence, and only its own OAM registration is deleted.
import {execFileSync} from 'node:child_process';
import {expect,test} from '../../fixtures';
import {activeInstance,adminToken,createInstanceApi,deleteInstanceApi,findInstanceByName,gw,OAM_BASE} from '../../helpers/api';
import {rowByText,toolbarButton} from '../../helpers/table';
const instance=process.env.E2E_INSTANCE_NAME,host=process.env.UC8_QA_SSH_HOST??'',gateway=process.env.UC8_QA_GATEWAY_CONTAINER??'',suffix=Date.now().toString(36);
const name=`uc8qa-cold-objective-${suffix}`,coldName=`uc8qa-cold-${suffix}`,folder=`/root/uc8-ui-qa-20261028/cold-${suffix}`;
const binding=`uc8qa-cold-binding-${suffix}`,tenant=`uc8qa-cold-tenant-${suffix}`,coldIP='172.18.0.77',coldPort=20134,client=process.env.UC8_QA_CLIENT_CONTAINER??'',backend=process.env.UC8_QA_BACKEND_IP??'';
let bindingAttempted=false;
const originalConfig='/root/uc8-ui-qa-20261028/restart-active-031f';
const dbIP=process.env.UC8_QA_DB_IP??'';
let objectiveAttempted=false,coldAttempted=false,registrationAttempted=false;
function ssh(...args:string[]):string{return execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=8',host,...args],{encoding:'utf8',timeout:30_000,stdio:['ignore','pipe','pipe']});}
async function coldGet(id:number,path:string){return fetch(`${OAM_BASE}/loxilbs/${id}/netlox/v1${path}`,{headers:{Authorization:`Bearer ${adminToken()}`},signal:AbortSignal.timeout(10_000)});}
test.describe('UC8-LIVE-COLD-NETWORK: LKG inference traffic',()=>{
 test.skip(process.env.UC8_QA_ALLOW_FAULTS!=='1'||process.env.UC8_QA_ALLOW_MUTATIONS!=='1'||instance!=='uc8qa-gateway','Requires explicit fault enablement and the dedicated QA instance.');
 test.beforeAll(async()=>{
  expect(host).toMatch(/^[a-zA-Z0-9._-]+$/);expect(gateway).toBe('uc8qa-20261028-gateway');expect(client).toBe('uc8qa-20261028-client');expect(backend).toBe('172.18.0.5');expect((await activeInstance()).name).toBe(instance);
  const owner=ssh('docker','inspect','--format',"'{{index .Config.Labels \"uc8qa.campaign\"}}'",gateway).trim();expect(owner).toBe('20261028');
  const source=ssh('docker','inspect','--format',"'{{range .Mounts}}{{if eq .Destination \"/etc/loxilb\"}}{{.Source}}{{end}}{{end}}'",gateway).trim();expect(source).toBe(originalConfig);
  expect(dbIP).toBe('172.18.0.2');
  expect(ssh('docker','inspect','--format',"'{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'",'uc8qa-20261028-postgres').trim()).toBe(dbIP);
  expect(await findInstanceByName(coldName)).toBeUndefined();
 });
 test.afterAll(async()=>{
  if(registrationAttempted){const inst=await findInstanceByName(coldName);if(inst)expect(await deleteInstanceApi(inst.id)).toBe(true);}
  if(coldAttempted){let state='';try{state=ssh('docker','inspect','--format',"'{{.State.Status}}'",coldName).trim();}catch{/* A failed create may leave no container. */}if(state==='running')ssh('docker','stop',coldName);}
  if(bindingAttempted){const d=await gw('DELETE',`/config/ai/netidentity/${binding}`);expect([200,204,404]).toContain(d.status);}
  if(objectiveAttempted){const r=await gw('DELETE',`/config/ai/objective/${name}`);expect([200,204,404]).toContain(r.status);const read=await gw('GET','/config/ai/objective');expect(read.status).toBe(200);expect((((await read.json()) as {objectiveAttr?:{name:string}[]}).objectiveAttr??[]).some(x=>x.name===name)).toBe(false);}
 });
 test('admits trusted network traffic while refusing key lookup during cold LKG',async({page,consoleGuard})=>{
  test.setTimeout(180_000);consoleGuard.allowRequest({status:503,path:/\/status\/ready$/});consoleGuard.allowRequest({status:503,path:/\/config\/ai\/apikey$/});
  objectiveAttempted=true;expect((await gw('POST','/config/ai/objective',{name,priority:10})).status).toBe(200);
  bindingAttempted=true;ssh('docker','exec',gateway,'loxicmd','create','netidentity',binding,`--tenant=${tenant}`,'--ingress-if=eth0',`--services=${coldIP}:${coldPort}`,'--credential=network','--enforce=strict','--forward-identity');
  expect((await gw('POST','/config/persist',{})).status).toBe(200);
  await page.goto(`instance/ai/objectives?name=${encodeURIComponent(instance!)}`);await expect(rowByText(page,name).first()).toBeVisible();
  const check=`import json\np='/etc/loxilb/aigw-lkg.json'\ntry:\n d=json.load(open(p));print('present' if any(x.get('name')=='${name}' for x in d.get('objectives',[])) else 'missing')\nexcept (OSError,ValueError):print('missing')`;
  const encoded=Buffer.from(check).toString('base64');
  await expect.poll(()=>ssh('docker','exec',gateway,'python3','-c',`'exec(__import__("base64").b64decode("${encoded}"))'`).trim(),{timeout:40_000,intervals:[1000,2000]}).toBe('present');
  ssh('test','!','-e',folder);
  ssh('cp','-a',originalConfig,folder);
  coldAttempted=true;
  ssh('docker','run','-d','--name',coldName,'--label','uc8qa.campaign=20261028','--network','uc8qa-20261028-net','--ip',coldIP,'--privileged',
   '--mount',`type=bind,src=${folder},dst=/etc/loxilb`,'--mount','type=bind,src=/root/uc8-ui-qa-20261028/secrets/aigw-password,dst=/opt/loxilb/cert/dp-password,readonly',
   '--entrypoint','/bin/sh','uc8qa-gateway:031f2aa','-c',"'exec /root/loxilb-io/loxilb/loxilb -p --sockmapsupport --aikey-db-host=127.0.0.1 --aikey-db-port=5432 --aikey-db-user=aigwuser --aikey-db-name=uc8qa031f --aikey-db-password-file=/opt/loxilb/cert/dp-password'");
  const ip=ssh('docker','inspect','--format',"'{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'",coldName).trim();expect(ip).toBe(coldIP);
  registrationAttempted=true;const create=await createInstanceApi({name:coldName,host:ip,port:'11111',protocol:'http',version:'v1',cimage:'uc8qa-gateway',ctag:'031f2aa'});expect(create.ok,`cold instance registration HTTP ${create.status}`).toBe(true);
  const inst=await findInstanceByName(coldName);expect(inst).toBeTruthy();
  let evidence:{source?:string;reachable?:boolean;present?:boolean}|undefined;
  await expect.poll(async()=>{try{const r=await coldGet(inst!.id,'/config/ai/objective');if(r.status!==200)return false;const b=await r.json() as {source?:string;store_reachable?:boolean;objectiveAttr?:{name:string}[]};evidence={source:b.source,reachable:b.store_reachable,present:b.objectiveAttr?.some(x=>x.name===name)};return b.source==='lkg'&&b.store_reachable===false&&evidence.present===true;}catch{return false;}},{timeout:60_000,intervals:[1000,2000]}).toBe(true);
  expect(evidence).toMatchObject({source:'lkg',reachable:false,present:true});
  expect((await coldGet(inst!.id,'/status/ready')).status).toBe(503);
  expect((await coldGet(inst!.id,'/config/ai/apikey')).status).toBe(503);
  await page.goto(`instance/ai/objectives?name=${encodeURIComponent(coldName)}`);
  await expect(rowByText(page,name).first()).toBeVisible({timeout:30_000});
  await expect(page.getByText(/The key store has not answered since this gateway started/)).toBeVisible();
  console.log('UC8 cold LKG sanitized evidence:',JSON.stringify({source:evidence?.source,reachable:evidence?.reachable,objectivePresent:evidence?.present,readiness:503,keyStore:503}));
  // Install a service on the isolated cold instance; its source network binding
  // came from the snapshot written while the primary store was healthy.
  ssh('docker','exec',coldName,'loxicmd','create','lb',coldIP,`--tcp=${coldPort}:8080`,`--endpoints=${backend}:1`,'--mode=fullproxy',`--name=uc8qa-cold-rule-${suffix}`,`--host=${coldIP}`,'--path-prefix=/','--path-match-mode=prefix','--model-name=uc8qa-cold-model','--sse-mode','--api-key-auth=required','--fc-llmd-headers=on');
  await page.goto(`instance/ai/netidentity?name=${encodeURIComponent(coldName)}`);await expect(rowByText(page,binding).first()).toBeVisible({timeout:30_000});
  const probe=`import json,urllib.request,urllib.error\nbase='http://${backend}:8080';url='http://${coldIP}:${coldPort}/v1/chat/completions';body=json.dumps({'model':'uc8qa-cold-model','messages':[{'role':'user','content':'test'}]}).encode()\ndef post(n,key=None):\n h={'Content-Type':'application/json','X-Test-Nonce':n}\n if key:h['X-Api-Key']=key\n try:\n  r=urllib.request.urlopen(urllib.request.Request(url,data=body,headers=h),timeout=10);status=r.status;r.close()\n except urllib.error.HTTPError as e:status=e.code\n with urllib.request.urlopen(base+'/receipt/'+n,timeout=3) as r:d=json.load(r)\n return {'status':status,'count':d.get('count',0),'tenant':(d.get('headers') or {}).get('x-auth-tenant')}\nprint(json.dumps({'network':post('uc8qa-${suffix}-cold-network'),'key':post('uc8qa-${suffix}-cold-key','invalid')}))`;
  const encProbe=Buffer.from(probe).toString('base64');
  const traffic=JSON.parse(ssh('docker','exec',client,'python','-c',`'exec(__import__("base64").b64decode("${encProbe}"))'`));
  expect(traffic.network).toMatchObject({status:200,count:1,tenant});expect(traffic.key).toMatchObject({status:503,count:0});
  console.log('UC8 cold LKG traffic:',JSON.stringify({networkStatus:traffic.network.status,networkReceipts:traffic.network.count,keyStatus:traffic.key.status,keyReceipts:traffic.key.count}));
  await page.goto(`instance/ai/objectives?name=${encodeURIComponent(coldName)}`);await expect(rowByText(page,name).first()).toBeVisible();

  // Restore only this cold instance's store path using an ephemeral TCP forwarder.
  // The dedicated PostgreSQL and the primary Gateway remain untouched.
  const forward=`import select,socket,socketserver
class H(socketserver.BaseRequestHandler):
 def handle(self):
  peer=socket.create_connection(('${dbIP}',5432),timeout=5)
  try:
   sockets=[self.request,peer]
   while True:
    ready,_,_=select.select(sockets,[],[],30)
    if not ready:break
    for s in ready:
     data=s.recv(65536)
     if not data:return
     (peer if s is self.request else self.request).sendall(data)
  finally:peer.close()
class S(socketserver.ThreadingTCPServer):
 allow_reuse_address=True
 daemon_threads=True
S(('127.0.0.1',5432),H).serve_forever()`.replace(/^\+/gm,'');
  const encForward=Buffer.from(forward).toString('base64');
  ssh('docker','exec','-d',coldName,'python3','-c',`'exec(__import__("base64").b64decode("${encForward}"))'`);
  await expect.poll(async()=>{try{const r=await coldGet(inst!.id,'/config/ai/objective');if(r.status!==200)return false;const b=await r.json() as {source?:string;store_reachable?:boolean;objectiveAttr?:{name:string}[]};return b.source==='store'&&b.store_reachable===true&&!!b.objectiveAttr?.some(x=>x.name===name);}catch{return false;}},{timeout:60_000,intervals:[1000,2000]}).toBe(true);
  expect((await coldGet(inst!.id,'/status/ready')).status).toBe(200);
  expect((await coldGet(inst!.id,'/config/ai/apikey')).status).toBe(200);
  await toolbarButton(page,'Refresh').click();
  await expect(page.getByText(/The key store has not answered since this gateway started/)).toHaveCount(0,{timeout:20_000});
  await expect(rowByText(page,name).first()).toBeVisible();
  console.log('UC8 cold LKG recovery: source=store, reachable=true, readiness=200, keyStore=200');
 });
});
