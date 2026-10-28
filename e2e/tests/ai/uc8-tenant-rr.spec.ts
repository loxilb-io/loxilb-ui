// UC-8: two tenants in one band, rotation and per-tenant FIFO.
import {execFileSync} from 'node:child_process';
import {expect,test} from '../../fixtures';
import {activeInstance,fullproxyVip,gw} from '../../helpers/api';
import {dialog,dialogButton,dialogTitle,openToolbarDialog} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {rowByText} from '../../helpers/table';
import {cleanupLbByName} from '../cicd/_recipes';
const instance=process.env.E2E_INSTANCE_NAME,host=process.env.UC8_QA_SSH_HOST??'',gateway=process.env.UC8_QA_GATEWAY_CONTAINER??'',client=process.env.UC8_QA_CLIENT_CONTAINER??'',backend=process.env.UC8_QA_BACKEND_IP??'',vip=fullproxyVip(),suffix=Date.now().toString(36),rule=`uc8qa-rr-${suffix}`;
const tenants=[`uc8qa-rr-a-${suffix}`,`uc8qa-rr-b-${suffix}`];
const keys:{id:string;raw:string}[]=[];const touched:string[]=[];let attempted=false;
test.use({trace:'off',screenshot:'off',video:'off'});
test.describe('UC8-LIVE-TENANT-RR: same-band tenant rotation',()=>{
 test.skip(process.env.UC8_QA_ALLOW_MUTATIONS!=='1'||instance!=='uc8qa-gateway','Requires the explicitly authorized dedicated instance.');
 test.beforeAll(async()=>{
  expect(host).toMatch(/^[a-zA-Z0-9._-]+$/);for(const x of [gateway,client])expect(x).toMatch(/^uc8qa-[a-z0-9-]+$/);for(const x of [backend,vip])expect(x).toMatch(/^\d{1,3}(?:\.\d{1,3}){3}$/);
  expect((await activeInstance()).name).toBe(instance);
  for(const t of tenants){touched.push(t);expect((await gw('POST','/config/ai/tenant/ratelimit',{tenant_id:t,rps:0,tokens_per_min:0,priority_class:'standard'})).ok).toBe(true);const read=await gw('GET',`/config/ai/tenant/ratelimit/${t}`);expect(read.status).toBe(200);expect(await read.json()).toMatchObject({tenant_id:t,priority_class:'standard'});}
  attempted=true;execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=8',host,'docker','exec',gateway,'loxicmd','create','lb',vip,'--tcp=20124:8080',`--endpoints=${backend}:1`,'--mode=fullproxy',`--name=${rule}`,`--host=${vip}`,'--path-prefix=/','--path-match-mode=prefix','--model-name=uc8qa-rr-model','--sse-mode','--api-key-auth=required','--fc-mode=enforce','--fc-max-outstanding=1','--fc-max-queue-depth=8','--fc-max-queue-wait-ms=30000','--fc-tenant-wake=rr'],{encoding:'utf8',timeout:25_000,stdio:['ignore','pipe','pipe']});
 });
 test.afterAll(async()=>{
  if(attempted)await cleanupLbByName(rule);
  for(const k of keys){expect([200,204,404]).toContain((await gw('DELETE',`/config/ai/apikey/${encodeURIComponent(k.id)}`)).status);expect((await gw('GET',`/config/ai/apikey/${encodeURIComponent(k.id)}`)).status).toBe(404);}
  for(const t of touched)expect((await gw('POST','/config/ai/tenant/ratelimit',{tenant_id:t,rps:0,tokens_per_min:0,burst_pct:0,priority_class:'standard',default_objective:'',allowed_objectives:[]})).ok).toBe(true);
  if(attempted){const r=await gw('GET','/config/loadbalancer/all');expect(r.status).toBe(200);const b=await r.json() as {lbAttr?:{serviceArguments?:{name?:string}}[]};expect((b.lbAttr??[]).some(x=>x.serviceArguments?.name===rule)).toBe(false);}
 });
 test('rotates tenants and preserves FIFO within one tenant',async({page})=>{
  test.setTimeout(90_000);
  for(let i=0;i<2;i++){
   await page.goto(`instance/ai/apikey?name=${encodeURIComponent(instance!)}`);await openToolbarDialog(page,'Add',dialogTitle(page,'New AI API Key'));
   await field(page,'Tenant ID').fill(tenants[i]);await field(page,'Name').fill(`uc8qa-rr-key-${i}-${suffix}`);
   await dialog(page).getByRole('button',{name:'Request Priority'}).click();await dialog(page).getByRole('combobox',{name:'Priority Class'}).click();await page.getByRole('option',{name:'standard',exact:true}).click();
   const [req]=await Promise.all([page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/config/ai/apikey')),dialogButton(page,'Add').click()]);const response=await req.response();expect(response?.status()).toBe(201);const d=await response!.json() as {key_id:string;raw_key:string};expect(d.key_id).toMatch(/^[a-zA-Z0-9_-]+$/);expect(d.raw_key).toBeTruthy();keys.push({id:d.key_id,raw:d.raw_key});await expect(dialogTitle(page,'API Key Created')).toBeVisible();await dialogButton(page,'OK').click();
  }
  await page.goto(`instance/traffic/lb?name=${encodeURIComponent(instance!)}`);const row=rowByText(page,rule).first();await expect(row).toBeVisible();await row.click();await page.getByRole('tab',{name:'AI Gateway'}).click();
  const orderValue=page.getByText('In-band Order',{exact:true}).locator('xpath=ancestor::div[contains(@class,"MuiStack-root")][1]').locator('p');await expect(orderValue).toHaveText(/^rr/);
  const source=`import json,sys,time,urllib.request,urllib.error,threading
+secrets=json.load(sys.stdin);base='http://${backend}:8080';api='http://${vip}:11111/netlox/v1/config/loadbalancer/all';url='http://${vip}:20124/v1/chat/completions';names=['uc8qa-${suffix}-hold','uc8qa-${suffix}-a1','uc8qa-${suffix}-a2','uc8qa-${suffix}-b1']; results={};threads=[];evidence={};error=None
+body=json.dumps({'model':'uc8qa-rr-model','messages':[{'role':'user','content':'test'}]}).encode()
+def get(url):
+ with urllib.request.urlopen(url,timeout=3) as r:return json.load(r)
+def post(n,k):
+ try:
+  req=urllib.request.Request(url,data=body,headers={'Content-Type':'application/json','X-Api-Key':k,'X-Test-Nonce':n,'X-Test-Hold':'1'})
+  with urllib.request.urlopen(req,timeout=40) as r:results[n]=r.status
+ except urllib.error.HTTPError as e:results[n]=e.code
+ except Exception:results[n]='transport-error'
+def start(n,k):
+ t=threading.Thread(target=post,args=(n,k),daemon=True);threads.append(t);t.start()
+def wait(f):
+ for _ in range(150):
+  if f():return True
+  time.sleep(.05)
+ return False
+def count(n):return get(base+'/receipt/'+n).get('count',0)
+def state():
+ for row in get(api).get('lbAttr',[]):
+  sa=row.get('serviceArguments',{})
+  if sa.get('name')=='${rule}':return sa.get('fc_effective') or {}
+ return {}
+def queued(n):
+ eff=state();return eff.get('queued')==n and ((eff.get('bands') or {}).get('standard') or {}).get('queued')==n
+try:
+ start(names[0],secrets[0]);assert wait(lambda:count(names[0])==1),'holder missing'
+ for i in range(1,4):
+  start(names[i],secrets[1 if i==3 else 0]);assert wait(lambda:queued(i)),'waiter not queued'
+ evidence['policy']=state().get('tenant_wake_effective');get(base+'/release/'+names[0]);order=[]
+ for i in range(3):
+  assert wait(lambda:len([x for x in get(base+'/order') if x in names[1:]])>i),'dispatch stalled'
+  order=[x for x in get(base+'/order') if x in names[1:]];get(base+'/release/'+order[i])
+ evidence['order']=[names.index(x) for x in order];evidence['receipts']=[count(n) for n in names]
+except Exception as e:error=str(e)
+finally:
+ for n in names:
+  try:get(base+'/release/'+n)
+  except Exception:pass
+ for t in threads:t.join(timeout=3)
+print(json.dumps({'error':error,'evidence':evidence,'statuses':[results.get(n) for n in names]}))`.replace(/^\+/gm,'');
  const enc=Buffer.from(source).toString('base64');const raw=execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=8',host,'docker','exec','-i',client,'python','-c',`'exec(__import__("base64").b64decode("${enc}"))'`],{input:JSON.stringify(keys.map(k=>k.raw)),encoding:'utf8',timeout:70_000,stdio:['pipe','pipe','pipe']});
  const result=JSON.parse(raw);expect(result.error,JSON.stringify(result.evidence)).toBeNull();expect(result.evidence.policy).toBe('rr');
  console.log('UC8 tenant RR sanitized evidence:',JSON.stringify(result.evidence));
  expect([[1,3,2],[3,1,2]]).toContainEqual(result.evidence.order);expect(result.evidence.receipts).toEqual([1,1,1,1]);expect(result.statuses).toEqual([200,200,200,200]);
 });
});
