// Independent, isolated TLS syslog collector for synthetic QA events only.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {expect,test} from '../../fixtures';
import {activeInstance,gw} from '../../helpers/api';
import {cleanupLbByName} from '../cicd/_recipes';
const host=process.env.UC8_QA_SSH_HOST??'', gateway=process.env.UC8_QA_GATEWAY_CONTAINER??'', client=process.env.UC8_QA_CLIENT_CONTAINER??'',instance=process.env.E2E_INSTANCE_NAME??'', backend=process.env.UC8_QA_BACKEND_IP??'',suffix=Date.now().toString(36);
const name=`uc8qa-siem-${suffix}`,rule=`uc8qa-siem-rule-${suffix}`,requestId=`uc8qa-siem-request-${suffix}`,folder=`/root/uc8-ui-qa-20261028/restart-active-031f/${name}`;
let collectorAttempted=false,sinkAttempted=false,ruleAttempted=false;
function ssh(...args:string[]){return execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=8',host,...args],{encoding:'utf8',timeout:30_000,stdio:['ignore','pipe','pipe']});}
function python(c:string,code:string){const encoded=Buffer.from(code).toString('base64');return ssh('docker','exec',c,'python','-c',`'exec(__import__("base64").b64decode("${encoded}"))'`);}
test.describe('UC8-LIVE-SIEM: independent TLS receiver',()=>{
 test.skip(process.env.UC8_QA_ALLOW_MUTATIONS!=='1'||instance!=='uc8qa-gateway','Requires dedicated QA mutation permission.');
 test.beforeAll(async()=>{
  expect(host).toMatch(/^[a-zA-Z0-9._-]+$/);expect(gateway).toBe('uc8qa-20261028-gateway');expect(client).toBe('uc8qa-20261028-client');expect(backend).toBe('172.18.0.5');expect((await activeInstance()).name).toBe(instance);
  expect(ssh('docker','inspect','--format',"'{{index .Config.Labels \"uc8qa.campaign\"}}'",gateway).trim()).toBe('20261028');
  expect(ssh('docker','inspect','--format',"'{{range .Mounts}}{{if eq .Destination \"/etc/loxilb\"}}{{.Source}}{{end}}{{end}}'",gateway).trim()).toBe('/root/uc8-ui-qa-20261028/restart-active-031f');
 });
 test.afterAll(async()=>{
  if(sinkAttempted){const d=await gw('DELETE',`/audit/sinks/${name}`);expect([200,204,404]).toContain(d.status);}
  if(ruleAttempted)await cleanupLbByName(rule);
  if(collectorAttempted){let status='';try{status=ssh('docker','inspect','--format',"'{{.State.Status}}'",name).trim();}catch{}if(status==='running')ssh('docker','stop',name);}
 });
 test('UI configures TLS delivery and collector receives the correlated inference event',async({page})=>{
  test.setTimeout(150_000);
  ssh('test','!','-e',folder);ssh('mkdir','-m','700',folder);
  ssh('openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',`${folder}/server.key`,'-out',`${folder}/server.crt`,'-days','1','-subj',"'/CN=uc8qa-collector'",'-addext',"'subjectAltName=DNS:uc8qa-collector'");
  execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=8',host,`cat > ${folder}/receiver.py`],{input:readFileSync('e2e/tests/ai/uc8-syslog-receiver.py','utf8'),timeout:15_000,stdio:['pipe','pipe','pipe']});
  collectorAttempted=true;ssh('docker','run','-d','--name',name,'--label','uc8qa.campaign=20261028','--network','uc8qa-20261028-net','--mount',`type=bind,src=${folder},dst=/fixture,readonly`,'-e',`UC8_REQUEST_ID=${requestId}`,'python:3.12-slim','python','/fixture/receiver.py');
  const ip=ssh('docker','inspect','--format',"'{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'",name).trim();expect(ip).toMatch(/^172\.18\.0\.\d+$/);
  const receipt=()=>JSON.parse(python(client,`import json,urllib.request\nprint(json.dumps(json.load(urllib.request.urlopen('http://${ip}:8081/receipt',timeout=3))))`));
  await expect.poll(()=>{try{return receipt().matches;}catch{return -1;}},{timeout:30_000}).toBe(0);
  await page.goto(`instance/maintenance/audit?name=${encodeURIComponent(instance)}`);
  await page.getByTestId('audit-named-sinks').getByRole('button',{name:'Add a sink'}).click();
  const dialog=page.getByRole('dialog');
  for(const [field,value] of Object.entries({name,address:`${ip}:6514`,ca_bundle_path:`/etc/loxilb/${name}/server.crt`,server_name:'uc8qa-collector',enterprise_number:'32473'}))await dialog.getByTestId(`audit-field-${field}`).fill(value);
  await dialog.getByRole('checkbox',{name:'data',exact:true}).check();sinkAttempted=true;
  const [response]=await Promise.all([page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().includes(`/audit/sinks/${name}`)),dialog.getByRole('button',{name:'Save'}).click()]);expect(response.status()).toBe(204);
  await expect(page.getByTestId(`audit-named-sink-${name}`)).toBeVisible();
  ruleAttempted=true;ssh('docker','exec',gateway,'loxicmd','create','lb','172.18.0.4','--tcp=20135:8080',`--endpoints=${backend}:1`,'--mode=fullproxy',`--name=${rule}`,'--host=172.18.0.4','--path-prefix=/','--path-match-mode=prefix','--model-name=uc8qa-siem-model','--sse-mode');
  const probe=`import json,urllib.request\nbody=json.dumps({'model':'uc8qa-siem-model','messages':[{'role':'user','content':'test'}]}).encode()\nreq=urllib.request.Request('http://172.18.0.4:20135/v1/chat/completions',data=body,headers={'Content-Type':'application/json','X-Request-Id':'${requestId}','X-Test-Nonce':'${requestId}'})\nwith urllib.request.urlopen(req,timeout=10) as r: status=r.status\nwith urllib.request.urlopen('http://${backend}:8080/receipt/${requestId}',timeout=4) as r: received=json.load(r).get('count',0)\nprint(json.dumps({'status':status,'backendReceipt':received}))`;
  const traffic=JSON.parse(python(client,probe));expect(traffic).toMatchObject({status:200,backendReceipt:1});
  await expect.poll(()=>{try{const r=receipt();return r.matches>0&&r.correlated;}catch{return false;}},{timeout:45_000,intervals:[1000,2000]}).toBe(true);
  console.log('UC8 SIEM sanitized evidence:',JSON.stringify({uiSaveStatus:response.status(),traffic,collector:receipt(),transport:'TLS RFC5425'}));
 });
});
