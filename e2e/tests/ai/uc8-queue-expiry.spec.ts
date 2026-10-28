// UC-8: distinguish per-band queue timeout from llm-d admission TTL expiry.
import {execFileSync} from 'node:child_process';
import {expect, test} from '../../fixtures';
import {activeInstance, fullproxyVip, gw} from '../../helpers/api';
import {rowByText} from '../../helpers/table';
import {cleanupLbByName} from '../cicd/_recipes';

const instance = process.env.E2E_INSTANCE_NAME;
const host = process.env.UC8_QA_SSH_HOST ?? '';
const container = process.env.UC8_QA_GATEWAY_CONTAINER ?? '';
const client = process.env.UC8_QA_CLIENT_CONTAINER ?? '';
const backend = process.env.UC8_QA_BACKEND_IP ?? '';
const vip = fullproxyVip();
const suffix = Date.now().toString(36);
const rule = `uc8qa-expiry-${suffix}`;
let attempted = false;

test.describe('UC8-LIVE-EXPIRY: queue timeout and admission TTL', () => {
	test.skip(process.env.UC8_QA_ALLOW_MUTATIONS !== '1' || instance !== 'uc8qa-gateway', 'Requires the explicitly authorized dedicated instance.');
	test.beforeAll(async () => {
		expect(host).toMatch(/^[a-zA-Z0-9._-]+$/);
		for (const value of [container,client]) expect(value).toMatch(/^uc8qa-[a-z0-9-]+$/);
		for (const value of [backend,vip]) expect(value).toMatch(/^\d{1,3}(?:\.\d{1,3}){3}$/);
		expect((await activeInstance()).name).toBe(instance);
		attempted = true;
		execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=8',host,'docker','exec',container,'loxicmd','create','lb',vip,
			'--tcp=20122:8080',`--endpoints=${backend}:1`,'--mode=fullproxy',`--name=${rule}`,`--host=${vip}`,
			'--path-prefix=/','--path-match-mode=prefix','--model-name=uc8qa-expiry-model','--sse-mode',
			'--fc-mode=enforce','--fc-max-outstanding=1','--fc-max-queue-depth=4','--fc-max-queue-wait-ms=2000',
			'--fc-band-wait-ms=0:300:0','--fc-llmd-headers=on'],{encoding:'utf8',timeout:25_000,stdio:['ignore','pipe','pipe']});
	});
	test.afterAll(async () => {
		if (!attempted) return;
		await cleanupLbByName(rule);
		const r = await gw('GET','/config/loadbalancer/all'); expect(r.status).toBe(200);
		const data = await r.json() as {lbAttr?: {serviceArguments?: {name?:string}}[]};
		expect((data.lbAttr ?? []).some(item => item.serviceArguments?.name===rule)).toBe(false);
	});
	test('a timed out queue and an expired TTL never reach the backend', async ({page}) => {
		test.setTimeout(60_000);
		await page.goto(`instance/traffic/lb?name=${encodeURIComponent(instance!)}`);
		await expect(rowByText(page,rule).first()).toBeVisible();
		const source = `import json,time,urllib.request,urllib.error,threading
+base='http://${backend}:8080'; url='http://${vip}:20122/v1/chat/completions'; names=['uc8qa-${suffix}-held','uc8qa-${suffix}-wait','uc8qa-${suffix}-ttl','uc8qa-${suffix}-recovery']; results={}
+body=json.dumps({'model':'uc8qa-expiry-model','messages':[{'role':'user','content':'test'}]}).encode()
+def get(path):
+ with urllib.request.urlopen(base+path,timeout=3) as r: return json.load(r)
+def count(n): return get('/receipt/'+n).get('count',0)
+def post(n,hold=False,ttl=None):
+ headers={'Content-Type':'application/json','X-Test-Nonce':n}
+ if hold: headers['X-Test-Hold']='1'
+ if ttl: headers['X-Llm-D-Inference-Ttl']=ttl
+ try:
+  with urllib.request.urlopen(urllib.request.Request(url,data=body,headers=headers),timeout=10) as r: return {'status':r.status}
+ except urllib.error.HTTPError as e:
+  try: b=json.loads(e.read())
+  except Exception: b={}
+  return {'status':e.code,'error':b.get('error')}
+def hold(): results['holder']=post(names[0],True)
+t=threading.Thread(target=hold,daemon=True); t.start(); error=None
+try:
+ for _ in range(100):
+  if count(names[0])==1: break
+  time.sleep(.05)
+ else: raise RuntimeError('holder did not reach backend')
+ results['queue']=post(names[1]); results['ttl']=post(names[2],ttl='50ms')
+ results['before']=[count(names[1]),count(names[2])]
+finally:
+ get('/release/'+names[0]); t.join(timeout=10)
+results['recovery']=post(names[3]); results['after']=[count(names[1]),count(names[2]),count(names[3])]
+print(json.dumps(results))`.replace(/^\+/gm,'');
		const encoded=Buffer.from(source).toString('base64');
		const out=execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=8',host,'docker','exec',client,'python','-c',`'exec(__import__("base64").b64decode("${encoded}"))'`],{encoding:'utf8',timeout:30_000,stdio:['ignore','pipe','pipe']});
		const result=JSON.parse(out);
		expect(result.queue).toMatchObject({status:504,error:'admission_queue_timeout'});
		expect(result.ttl).toMatchObject({status:429,error:'admission_ttl_expired'});
		expect(result.before).toEqual([0,0]);
		expect(result.holder).toMatchObject({status:200});
		expect(result.recovery).toMatchObject({status:200});
		expect(result.after).toEqual([0,0,1]);
	});
});
