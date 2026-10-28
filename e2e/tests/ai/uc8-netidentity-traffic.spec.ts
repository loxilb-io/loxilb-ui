// UC-8 C5: CLI network identity, UI readback and real strict/advisory traffic.
import {execFileSync} from 'node:child_process';
import {expect,test} from '../../fixtures';
import {activeInstance,fullproxyVip,gw} from '../../helpers/api';
import {dialog,dialogButton,dialogTitle,openToolbarDialog} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {rowByText,toolbarButton} from '../../helpers/table';
import {cleanupLbByName} from '../cicd/_recipes';
const instance=process.env.E2E_INSTANCE_NAME,host=process.env.UC8_QA_SSH_HOST??'',gateway=process.env.UC8_QA_GATEWAY_CONTAINER??'',client=process.env.UC8_QA_CLIENT_CONTAINER??'',backend=process.env.UC8_QA_BACKEND_IP??'',clientIP=process.env.UC8_QA_CLIENT_IP??'',vip=fullproxyVip(),suffix=Date.now().toString(36),rule=`uc8qa-net-traffic-${suffix}`,binding=`uc8qa-binding-${suffix}`;
const tenants=[`uc8qa-net-a-${suffix}`,`uc8qa-net-b-${suffix}`],keys:{id:string;raw:string}[]=[];let ruleAttempted=false,bindingAttempted=false;
test.use({trace:'off',screenshot:'off',video:'off'});
function cli(...args:string[]){return execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=8',host,'docker','exec',gateway,'loxicmd',...args],{encoding:'utf8',timeout:25_000,stdio:['ignore','pipe','pipe']});}
function setBinding(mode:'strict'|'advisory'){cli('create','netidentity',binding,`--tenant=${tenants[0]}`,`--cidr=${clientIP}/32`,`--services=${vip}:20128`,`--enforce=${mode}`,'--forward-identity');}
function request(key:string,nonce:string){const script=`import json,sys,urllib.request,urllib.error\nk=json.load(sys.stdin);url='http://${vip}:20128/v1/chat/completions';base='http://${backend}:8080';body=json.dumps({'model':'uc8qa-net-model','messages':[{'role':'user','content':'test'}]}).encode()\nreq=urllib.request.Request(url,data=body,headers={'Content-Type':'application/json','X-Api-Key':k,'X-Test-Nonce':'${nonce}'})\ntry:\n r=urllib.request.urlopen(req,timeout=8);status=r.status;r.close()\nexcept urllib.error.HTTPError as e:status=e.code\nwith urllib.request.urlopen(base+'/receipt/${nonce}',timeout=3) as r:rec=json.load(r)\nprint(json.dumps({'status':status,'count':rec.get('count',0),'tenant':(rec.get('headers') or {}).get('x-auth-tenant'),'fairness':(rec.get('headers') or {}).get('x-llm-d-inference-fairness-id')}))`;const enc=Buffer.from(script).toString('base64');return JSON.parse(execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=8',host,'docker','exec','-i',client,'python','-c',`'exec(__import__("base64").b64decode("${enc}"))'`],{input:JSON.stringify(key),encoding:'utf8',timeout:20_000,stdio:['pipe','pipe','pipe']}));}
test.describe('UC8-LIVE-NETIDENTITY-TRAFFIC: strict and advisory',()=>{
 test.skip(process.env.UC8_QA_ALLOW_MUTATIONS!=='1'||instance!=='uc8qa-gateway','Requires the dedicated QA instance.');
 test.beforeAll(async()=>{expect(host).toMatch(/^[a-zA-Z0-9._-]+$/);for(const s of [gateway,client])expect(s).toMatch(/^uc8qa-[a-z0-9-]+$/);for(const s of [backend,clientIP,vip])expect(s).toMatch(/^\d{1,3}(?:\.\d{1,3}){3}$/);const actual=execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=8',host,'docker','inspect','--format',"'{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'",client],{encoding:'utf8',timeout:15_000,stdio:['ignore','pipe','pipe']}).trim();expect(actual,'client address must be the actual socket peer').toBe(clientIP);expect((await activeInstance()).name).toBe(instance);ruleAttempted=true;cli('create','lb',vip,'--tcp=20128:8080',`--endpoints=${backend}:1`,'--mode=fullproxy',`--name=${rule}`,`--host=${vip}`,'--path-prefix=/','--path-match-mode=prefix','--model-name=uc8qa-net-model','--sse-mode','--api-key-auth=required','--fc-llmd-headers=on');});
 test.afterAll(async()=>{
  if(bindingAttempted){const r=await gw('DELETE',`/config/ai/netidentity/${binding}`);expect([200,204,404]).toContain(r.status);}
  if(ruleAttempted)await cleanupLbByName(rule);
  for(const k of keys){expect([200,204,404]).toContain((await gw('DELETE',`/config/ai/apikey/${encodeURIComponent(k.id)}`)).status);expect((await gw('GET',`/config/ai/apikey/${encodeURIComponent(k.id)}`)).status).toBe(404);}
  const r=await gw('GET','/config/ai/netidentity');expect(r.status).toBe(200);const body=await r.json() as {netIdentityAttr?:{name:string}[]};expect((body.netIdentityAttr??[]).some(x=>x.name===binding)).toBe(false);
  const lb=await gw('GET','/config/loadbalancer/all');expect(lb.status).toBe(200);const rules=await lb.json() as {lbAttr?:{serviceArguments?:{name?:string}}[]};expect((rules.lbAttr??[]).some(x=>x.serviceArguments?.name===rule)).toBe(false);
 });
 test('strict rejects mismatched tenant and advisory follows the key',async({page})=>{
  test.setTimeout(90_000);
  for(let i=0;i<2;i++){await page.goto(`instance/ai/apikey?name=${encodeURIComponent(instance!)}`);await openToolbarDialog(page,'Add',dialogTitle(page,'New AI API Key'));await field(page,'Tenant ID').fill(tenants[i]);await field(page,'Name').fill(`uc8qa-net-key-${i}-${suffix}`);const [req]=await Promise.all([page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/config/ai/apikey')),dialogButton(page,'Add').click()]);const res=await req.response();expect(res?.status()).toBe(201);const data=await res!.json() as {key_id:string;raw_key:string};expect(data.key_id).toMatch(/^[a-zA-Z0-9_-]+$/);expect(data.raw_key).toBeTruthy();keys.push({id:data.key_id,raw:data.raw_key});await expect(dialogTitle(page,'API Key Created')).toBeVisible();await dialogButton(page,'OK').click();}
  bindingAttempted=true;setBinding('strict');
  await page.goto(`instance/ai/netidentity?name=${encodeURIComponent(instance!)}`);const row=rowByText(page,binding).first();await expect(row).toBeVisible();await expect(row).toContainText(tenants[0]);await expect(row).toContainText(`${clientIP}/32`);await expect(row).toContainText('strict');for(const a of ['Add','Edit','Delete'] as const)await expect(toolbarButton(page,a)).toHaveCount(0);
  const allowed=request(keys[0].raw,`uc8qa-${suffix}-same`);expect(allowed).toMatchObject({status:200,count:1,tenant:tenants[0]});
  const denied=request(keys[1].raw,`uc8qa-${suffix}-mismatch`);expect(denied).toMatchObject({status:403,count:0});
  setBinding('advisory');const read=await gw('GET','/config/ai/netidentity');expect(read.status).toBe(200);const data=await read.json() as {netIdentityAttr?:{name:string;enforce:string}[]};expect(data.netIdentityAttr?.find(x=>x.name===binding)).toMatchObject({enforce:'advisory'});
  await toolbarButton(page,'Refresh').click();await expect(rowByText(page,binding).first()).toContainText('advisory');
  const advisory=request(keys[1].raw,`uc8qa-${suffix}-advisory`);expect(advisory).toMatchObject({status:200,count:1,tenant:tenants[1]});
  console.log('UC8 network identity sanitized evidence:',JSON.stringify({strictSame:{status:allowed.status,count:allowed.count},strictMismatch:denied,advisory:{status:advisory.status,count:advisory.count}}));
 });
});
