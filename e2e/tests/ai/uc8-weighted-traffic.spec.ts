// UC-8 bounded weighted dispatch: 8:3:1 with all three bands backlogged.
// Raw credentials are sent to the isolated client over stdin only.
import {execFileSync} from 'node:child_process';
import {expect, test} from '../../fixtures';
import {activeInstance, fullproxyVip, gw} from '../../helpers/api';
import {dialog, dialogButton, dialogTitle, openToolbarDialog} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {rowByText} from '../../helpers/table';
import {cleanupLbByName} from '../cicd/_recipes';

const instance=process.env.E2E_INSTANCE_NAME;
const host=process.env.UC8_QA_SSH_HOST ?? '';
const gateway=process.env.UC8_QA_GATEWAY_CONTAINER ?? '';
const client=process.env.UC8_QA_CLIENT_CONTAINER ?? '';
const backend=process.env.UC8_QA_BACKEND_IP ?? '';
const vip=fullproxyVip();
const suffix=Date.now().toString(36);
const rule=`uc8qa-weighted-${suffix}`;
const bands=['critical','standard','sheddable'] as const;
const tenants=bands.map((_,i)=>`uc8qa-wtenant-${i}-${suffix}`);
const objectives=bands.map((_,i)=>`uc8qa-wobjective-${i}-${suffix}`);
const priorities=[10,0,-10];
const keys:{id:string;raw:string}[]=[];
const touchedObjectives:string[]=[];
const touchedTenants:string[]=[];
let attempted=false;
test.use({trace:'off',screenshot:'off',video:'off'});

test.describe('UC8-LIVE-WEIGHTED: bounded mixed-band backlog',()=>{
 test.skip(process.env.UC8_QA_ALLOW_MUTATIONS!=='1' || instance!=='uc8qa-gateway','Requires the explicitly authorized dedicated instance.');
 test.beforeAll(async()=>{
  expect(host).toMatch(/^[a-zA-Z0-9._-]+$/);
  for(const s of [gateway,client]) expect(s).toMatch(/^uc8qa-[a-z0-9-]+$/);
  for(const s of [backend,vip]) expect(s).toMatch(/^\d{1,3}(?:\.\d{1,3}){3}$/);
  expect((await activeInstance()).name).toBe(instance);
  for(let i=0;i<3;i++){
   touchedObjectives.push(objectives[i]);
   expect((await gw('POST','/config/ai/objective',{name:objectives[i],priority:priorities[i]})).status).toBe(200);
   touchedTenants.push(tenants[i]);
   expect((await gw('POST','/config/ai/tenant/ratelimit',{tenant_id:tenants[i],rps:0,tokens_per_min:0,priority_class:bands[i],default_objective:objectives[i],allowed_objectives:[objectives[i]]})).ok).toBe(true);
   const read=await gw('GET',`/config/ai/tenant/ratelimit/${encodeURIComponent(tenants[i])}`);
   expect(read.status).toBe(200);
   expect(await read.json()).toMatchObject({tenant_id:tenants[i],priority_class:bands[i],default_objective:objectives[i]});
  }
  attempted=true;
  execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=8',host,'docker','exec',gateway,'loxicmd','create','lb',vip,
   '--tcp=20123:8080',`--endpoints=${backend}:1`,'--mode=fullproxy',`--name=${rule}`,`--host=${vip}`,
   '--path-prefix=/','--path-match-mode=prefix','--model-name=uc8qa-weighted-model','--sse-mode','--api-key-auth=required',
   '--fc-mode=enforce','--fc-max-outstanding=1','--fc-max-queue-depth=32','--fc-max-queue-wait-ms=60000',
   '--fc-wake-policy=weighted','--fc-band-weights=8:3:1','--fc-shed-queue=on'],{encoding:'utf8',timeout:25_000,stdio:['ignore','pipe','pipe']});
 });
 test.afterAll(async()=>{
  if(attempted) await cleanupLbByName(rule);
  for(const k of keys){const r=await gw('DELETE',`/config/ai/apikey/${encodeURIComponent(k.id)}`); expect([200,204,404]).toContain(r.status); expect((await gw('GET',`/config/ai/apikey/${encodeURIComponent(k.id)}`)).status).toBe(404);}
  for(const t of touchedTenants) expect((await gw('POST','/config/ai/tenant/ratelimit',{tenant_id:t,rps:0,tokens_per_min:0,burst_pct:0,priority_class:'standard',default_objective:'',allowed_objectives:[]})).ok).toBe(true);
  for(const o of touchedObjectives) expect([200,204,404]).toContain((await gw('DELETE',`/config/ai/objective/${encodeURIComponent(o)}`)).status);
  if(attempted){const r=await gw('GET','/config/loadbalancer/all');expect(r.status).toBe(200);const b=await r.json() as {lbAttr?:{serviceArguments?:{name?:string}}[]};expect((b.lbAttr??[]).some(x=>x.serviceArguments?.name===rule)).toBe(false);}
 });
 test('first twelve dispatches contain eight critical, three standard and one sheddable',async({page})=>{
  test.setTimeout(120_000);
  for(let i=0;i<3;i++){
   await page.goto(`instance/ai/apikey?name=${encodeURIComponent(instance!)}`);
   await openToolbarDialog(page,'Add',dialogTitle(page,'New AI API Key'));
   await field(page,'Tenant ID').fill(tenants[i]);await field(page,'Name').fill(`uc8qa-wkey-${i}-${suffix}`);
   await dialog(page).getByRole('button',{name:'Request Priority'}).click();
   await dialog(page).getByRole('combobox',{name:'Priority Class'}).click();
   await page.getByRole('option',{name:bands[i],exact:true}).click();
   await field(page,'Default Objective').fill(objectives[i]);
   await field(page,'Allowed Objectives (comma-separated)').fill(objectives[i]);
   const [req]=await Promise.all([page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/config/ai/apikey')),dialogButton(page,'Add').click()]);
   const response=await req.response();expect(response?.status()).toBe(201);
   const data=await response!.json() as {key_id:string;raw_key:string};expect(data.key_id).toMatch(/^[a-zA-Z0-9_-]+$/);expect(data.raw_key).toBeTruthy();keys.push({id:data.key_id,raw:data.raw_key});
   await expect(dialogTitle(page,'API Key Created')).toBeVisible();await dialogButton(page,'OK').click();
  }
  await page.goto(`instance/traffic/lb?name=${encodeURIComponent(instance!)}`);
  const ruleRow=rowByText(page,rule).first();await expect(ruleRow).toBeVisible();await ruleRow.click();
  await page.getByRole('tab',{name:'AI Gateway'}).click();
  await expect(page.getByRole('table',{name:'Priority band state'})).toBeVisible();
  const wakeValue=page.getByText('Wake Policy',{exact:true}).locator('xpath=ancestor::div[contains(@class,"MuiStack-root")][1]').locator('p');
  await expect(wakeValue).toHaveText(/^weighted/);
  const source=`import json,sys,time,urllib.request,urllib.error,threading
+secrets=json.load(sys.stdin); base='http://${backend}:8080'; api='http://${vip}:11111/netlox/v1/config/loadbalancer/all'; url='http://${vip}:20123/v1/chat/completions'
+holder='uc8qa-${suffix}-holder'; names=[[f'uc8qa-${suffix}-c{i}' for i in range(10)],[f'uc8qa-${suffix}-s{i}' for i in range(5)],[f'uc8qa-${suffix}-b{i}' for i in range(3)]]; flat=sum(names,[]); results={}; threads=[]; evidence={}; error=None
+body=json.dumps({'model':'uc8qa-weighted-model','messages':[{'role':'user','content':'test'}]}).encode()
+def get(url):
+ with urllib.request.urlopen(url,timeout=3) as r:return json.load(r)
+def post(n,k):
+ try:
+  req=urllib.request.Request(url,data=body,headers={'Content-Type':'application/json','X-Api-Key':k,'X-Test-Nonce':n,'X-Test-Hold':'1'})
+  with urllib.request.urlopen(req,timeout=55) as r: results[n]=r.status
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
+def qcounts():
+ b=state().get('bands') or {};return [(b.get(k) or {}).get('queued',0) for k in ['critical','standard','sheddable']]
+try:
+ start(holder,secrets[0]);assert wait(lambda:count(holder)==1),'holder missing'
+ for i,group in enumerate(names):
+  for n in group:start(n,secrets[i])
+  assert wait(lambda:qcounts()[i]==len(group)),'band did not fully queue'
+ evidence['queued']=qcounts();evidence['policy']=state().get('wake_policy_effective')
+ get(base+'/release/'+holder)
+ order=[]
+ for turn in range(len(flat)):
+  assert wait(lambda:len([n for n in get(base+'/order') if n in flat])>turn),'dispatch stalled'
+  order=[n for n in get(base+'/order') if n in flat];n=order[turn];get(base+'/release/'+n)
+ evidence['first12']=[sum(n in names[i] for n in order[:12]) for i in range(3)]
+ evidence['all_receipts']=[sum(count(n)==1 for n in group) for group in names]
+except Exception as e:error=str(e)
+finally:
+ for n in [holder]+flat:
+  try:get(base+'/release/'+n)
+  except Exception:pass
+ for t in threads:t.join(timeout=2)
+print(json.dumps({'error':error,'evidence':evidence,'status_counts':{str(k):list(results.values()).count(k) for k in set(results.values())},'status_total':len(results)}))`.replace(/^\+/gm,'');
  const encoded=Buffer.from(source).toString('base64');
  const raw=execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=8',host,'docker','exec','-i',client,'python','-c',`'exec(__import__("base64").b64decode("${encoded}"))'`],{input:JSON.stringify(keys.map(k=>k.raw)),encoding:'utf8',timeout:100_000,stdio:['pipe','pipe','pipe']});
  const result=JSON.parse(raw);expect(result.error,JSON.stringify(result.evidence)).toBeNull();
  console.log('UC8 weighted sanitized evidence:',JSON.stringify(result.evidence));
  expect(result.evidence.queued).toEqual([10,5,3]);expect(result.evidence.policy).toBe('weighted');
  expect(result.evidence.first12).toEqual([8,3,1]);expect(result.evidence.all_receipts).toEqual([10,5,3]);
  expect(result.status_total).toBe(19);expect(result.status_counts).toEqual({'200':19});
 });
});
