// UC-8 strict priority with two UI-created tenant keys and independent backend receipts.
// Test credentials travel through SSH stdin, never command arguments or logs.
import {execFileSync, spawn} from 'node:child_process';
import {expect, test} from '../../fixtures';
import {activeInstance, fullproxyVip, gw} from '../../helpers/api';
import {dialog, dialogButton, dialogTitle, openToolbarDialog} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {rowByText} from '../../helpers/table';
import {cleanupLbByName} from '../cicd/_recipes';

const instance = process.env.E2E_INSTANCE_NAME;
const host = process.env.UC8_QA_SSH_HOST ?? '';
const container = process.env.UC8_QA_GATEWAY_CONTAINER ?? '';
const client = process.env.UC8_QA_CLIENT_CONTAINER ?? '';
const backend = process.env.UC8_QA_BACKEND_IP ?? '';
const vip = fullproxyVip();
const suffix = Date.now().toString(36);
const rule = `uc8qa-priority-${suffix}`;
const objective = `uc8qa-critical-${suffix}`;
const tenants = [`uc8qa-urgent-${suffix}`, `uc8qa-batch-${suffix}`];
const keys: {id: string; raw: string}[] = [];
let ruleAttempted = false;
let objectiveAttempted = false;
const touchedTenants: string[] = [];
test.use({trace: 'off', screenshot: 'off', video: 'off'});

test.describe('UC8-LIVE-STRICT: two tenants and strict priority', () => {
	test.skip(process.env.UC8_QA_ALLOW_MUTATIONS !== '1' || instance !== 'uc8qa-gateway', 'Requires the explicitly authorized dedicated instance.');
	test.beforeAll(async () => {
		expect(host).toMatch(/^[a-zA-Z0-9._-]+$/);
		for (const value of [container, client]) expect(value).toMatch(/^uc8qa-[a-z0-9-]+$/);
		for (const value of [backend, vip]) expect(value).toMatch(/^\d{1,3}(?:\.\d{1,3}){3}$/);
		expect((await activeInstance()).name).toBe(instance);
		objectiveAttempted = true;
		expect((await gw('POST', '/config/ai/objective', {name:objective, priority:10})).status).toBe(200);
		for (const [i, priority] of ['critical', 'sheddable'].entries()) {
			touchedTenants.push(tenants[i]);
			const response = await gw('POST', '/config/ai/tenant/ratelimit', {tenant_id: tenants[i], rps: 0, tokens_per_min: 0, priority_class: priority, ...(i === 0 ? {default_objective: objective, allowed_objectives: [objective]} : {})});
			expect(response.ok).toBe(true);
			const read = await gw('GET', `/config/ai/tenant/ratelimit/${encodeURIComponent(tenants[i])}`);
			expect(read.status).toBe(200);
			expect(await read.json()).toMatchObject({tenant_id: tenants[i], priority_class: priority});
		}
		ruleAttempted = true;
		execFileSync('ssh', ['-o','BatchMode=yes','-o','ConnectTimeout=8',host,'docker','exec',container,'loxicmd','create','lb',vip,
			'--tcp=20121:8080',`--endpoints=${backend}:1`,'--mode=fullproxy',`--name=${rule}`,`--host=${vip}`,
			'--path-prefix=/','--path-match-mode=prefix','--model-name=uc8qa-priority-model','--sse-mode','--api-key-auth=required',
			'--fc-mode=enforce','--fc-max-outstanding=1','--fc-max-queue-depth=4','--fc-max-queue-wait-ms=30000',
			'--fc-wake-policy=strict','--fc-shed-queue=on'], {encoding:'utf8', timeout:25_000, stdio:['ignore','pipe','pipe']});
	});
	test.afterAll(async () => {
		if (ruleAttempted) await cleanupLbByName(rule);
		for (const key of keys) {
			const r = await gw('DELETE', `/config/ai/apikey/${encodeURIComponent(key.id)}`);
			expect([200,204,404]).toContain(r.status);
			expect((await gw('GET', `/config/ai/apikey/${encodeURIComponent(key.id)}`)).status).toBe(404);
		}
		for (const tenant of touchedTenants) {
			const r = await gw('POST', '/config/ai/tenant/ratelimit', {tenant_id:tenant, rps:0, tokens_per_min:0, burst_pct:0, priority_class:'standard', default_objective:'', allowed_objectives:[]});
			expect(r.ok, 'neutralize only this test tenant').toBe(true);
		}
		if (objectiveAttempted) expect([200,204,404]).toContain((await gw('DELETE', `/config/ai/objective/${encodeURIComponent(objective)}`)).status);
		if (ruleAttempted) {
			const r = await gw('GET', '/config/loadbalancer/all'); expect(r.status).toBe(200);
			const data = await r.json() as {lbAttr?: {serviceArguments?: {name?: string}}[]};
			expect((data.lbAttr ?? []).some(item => item.serviceArguments?.name === rule)).toBe(false);
		}
	});
	test('critical overtakes an earlier sheddable waiter on a held service', async ({page}) => {
		test.setTimeout(120_000);
		for (const [i, priority] of ['critical', 'sheddable'].entries()) {
			await page.goto(`instance/ai/apikey?name=${encodeURIComponent(instance!)}`);
			await openToolbarDialog(page, 'Add', dialogTitle(page, 'New AI API Key'));
			await field(page, 'Tenant ID').fill(tenants[i]);
			await field(page, 'Name').fill(`uc8qa-priority-key-${i}-${suffix}`);
			await dialog(page).getByRole('button', {name:'Request Priority'}).click();
			await dialog(page).getByRole('combobox', {name:'Priority Class'}).click();
			await page.getByRole('option', {name:priority, exact:true}).click();
			if (i === 0) {
				await field(page, 'Default Objective').fill(objective);
				await field(page, 'Allowed Objectives (comma-separated)').fill(objective);
			}
			const [request] = await Promise.all([page.waitForRequest(r => r.method()==='POST' && r.url().endsWith('/config/ai/apikey')), dialogButton(page,'Add').click()]);
			const response = await request.response(); expect(response?.status()).toBe(201);
			const data = await response!.json() as {key_id:string; raw_key:string};
			expect(data.key_id).toMatch(/^[a-zA-Z0-9_-]+$/); expect(data.raw_key).toBeTruthy();
			keys.push({id:data.key_id, raw:data.raw_key});
			await expect(dialogTitle(page,'API Key Created')).toBeVisible();
			await dialogButton(page,'OK').click();
		}
		await page.goto(`instance/traffic/lb?name=${encodeURIComponent(instance!)}`);
		const ruleRow = rowByText(page, rule).first();
		await expect(ruleRow).toBeVisible();
		await ruleRow.click();
		await page.getByRole('tab', {name:'AI Gateway'}).click();
		const bandTable = page.getByRole('table', {name:'Priority band state'});
		await expect(bandTable).toBeVisible();
		for (const band of ['Critical', 'Standard', 'Sheddable']) await expect(bandTable.getByRole('rowheader', {name:band})).toBeVisible();
		const source = `import json,sys,time,urllib.request,urllib.error,threading
+secrets=json.loads(sys.stdin.readline())
+base='http://${backend}:8080'; url='http://${vip}:20121/v1/chat/completions'; api='http://${vip}:11111/netlox/v1/config/loadbalancer/all'
+names=['uc8qa-${suffix}-held','uc8qa-${suffix}-batch','uc8qa-${suffix}-urgent']; unauth='uc8qa-${suffix}-unauth'; results={}; threads=[]
+body=json.dumps({'model':'uc8qa-priority-model','messages':[{'role':'user','content':'test'}]}).encode()
+def get(url):
+ with urllib.request.urlopen(url,timeout=3) as r: return json.load(r)
+def post(name,key):
+ try:
+  req=urllib.request.Request(url,data=body,headers={'Content-Type':'application/json','X-Api-Key':key,'X-Test-Nonce':name,'X-Test-Hold':'1'})
+  with urllib.request.urlopen(req,timeout=45) as r: results[name]=r.status
+ except urllib.error.HTTPError as e: results[name]=e.code
+ except Exception: results[name]='transport-error'
+def start(name,key):
+ t=threading.Thread(target=post,args=(name,key),daemon=True); threads.append(t); t.start()
+def wait_until(f):
+ for _ in range(120):
+  if f(): return True
+  time.sleep(.1)
+ return False
+def count(name): return get(base+'/receipt/'+name).get('count',0)
+def queued(n):
+ rows=get(api).get('lbAttr',[])
+ for row in rows:
+  sa=row.get('serviceArguments',{})
+  if sa.get('name')=='${rule}':
+   effective=sa.get('fc_effective') or {}; bands=effective.get('bands') or {}
+   evidence['last_queued']={'total':effective.get('queued'),'critical':(bands.get('critical') or {}).get('queued'),'standard':(bands.get('standard') or {}).get('queued'),'sheddable':(bands.get('sheddable') or {}).get('queued')}
+   expected={'critical':0,'sheddable':1} if n==1 else {'critical':1,'sheddable':1}
+   return effective.get('queued')==n and all((bands.get(k) or {}).get('queued')==v for k,v in expected.items())
+ return False
+error=None; evidence={}
+try:
+ try:
+  req=urllib.request.Request(url,data=body,headers={'Content-Type':'application/json','X-Test-Nonce':unauth})
+  with urllib.request.urlopen(req,timeout=5) as r: evidence['unauth_status']=r.status
+ except urllib.error.HTTPError as e: evidence['unauth_status']=e.code
+ evidence['unauth_receipt']=count(unauth)
+ start(names[0],secrets[0]); assert wait_until(lambda: count(names[0])==1), 'holder did not reach backend'
+ start(names[1],secrets[1]); assert wait_until(lambda: queued(1)), 'batch did not queue'
+ start(names[2],secrets[0]); assert wait_until(lambda: queued(2)), 'critical did not queue'
+ evidence['before']=[count(names[1]),count(names[2])]
+ print('BANDS_READY',flush=True)
+ if sys.stdin.readline().strip()!='CONTINUE': raise RuntimeError('UI observation interrupted')
+ get(base+'/release/'+names[0]); assert wait_until(lambda: count(names[2])==1), 'critical was not dispatched'
+ evidence['while_urgent_held']=[count(names[1]),count(names[2])]
+ get(base+'/release/'+names[2]); assert wait_until(lambda: count(names[1])==1), 'batch was not dispatched'
+ evidence['after']=[count(names[1]),count(names[2])]
+ order=get(base+'/order'); evidence['order']=[names.index(n) for n in order if n in names]
+except Exception as e: error=str(e)
+finally:
+ for n in names:
+  try: get(base+'/release/'+n)
+  except Exception: pass
+ for t in threads: t.join(timeout=4)
+print(json.dumps({'error':error,'evidence':evidence,'statuses':[results.get(n) for n in names]}))`.replace(/^\+/gm, '');
		const encoded = Buffer.from(source).toString('base64');
		const child = spawn('ssh', ['-o','BatchMode=yes','-o','ConnectTimeout=8',host,'docker','exec','-i',client,'python','-c',`'exec(__import__("base64").b64decode("${encoded}"))'`], {stdio:['pipe','pipe','ignore']});
		let output = '';
		let readyResolve!: () => void;
		let readyReject!: (error: Error) => void;
		const ready = new Promise<void>((resolve, reject) => { readyResolve=resolve; readyReject=reject; });
		child.stdout.setEncoding('utf8');
		child.stdout.on('data', (chunk: string) => { output += chunk; if (output.includes('BANDS_READY\n')) readyResolve(); });
		const exited = new Promise<number | null>((resolve, reject) => {
			child.once('error', reject);
			child.once('close', code => { readyReject(new Error('Traffic fixture exited before the UI observation')); resolve(code); });
		});
		child.stdin.write(JSON.stringify(keys.map(k => k.raw))+'\n');
		let uiFailure: unknown;
		let timeout: ReturnType<typeof setTimeout> | undefined;
		try {
			await Promise.race([ready, new Promise<never>((_, reject) => { timeout=setTimeout(() => reject(new Error('Timed out waiting for both bands')), 30_000); })]);
			await page.reload();
			await rowByText(page, rule).first().click();
			await page.getByRole('tab', {name:'AI Gateway'}).click();
			const table = page.getByRole('table', {name:'Priority band state'});
			for (const band of ['Critical', 'Sheddable']) {
				const row = table.getByRole('rowheader', {name:band, exact:true}).locator('..');
				await expect(row.locator('td').nth(1), `${band} UI waiting count`).toHaveText('1', {timeout:15_000});
			}
		} catch (error) { uiFailure=error; }
		finally {
			if (timeout) clearTimeout(timeout);
			if (!child.stdin.destroyed) child.stdin.end('CONTINUE\n');
		}
		const exitCode = await exited;
		if (uiFailure) throw uiFailure;
		expect(exitCode).toBe(0);
		const resultLine = output.split('\n').filter(line => line.startsWith('{')).at(-1);
		expect(resultLine, 'sanitized traffic result').toBeTruthy();
		const result = JSON.parse(resultLine!);
		expect(result.error, `HTTP statuses and counts: ${JSON.stringify({statuses: result.statuses, evidence: result.evidence})}`).toBeNull();
		expect(result.evidence.unauth_status).toBe(401);
		expect(result.evidence.unauth_receipt).toBe(0);
		expect(result.evidence.before).toEqual([0,0]);
		expect(result.evidence.while_urgent_held).toEqual([0,1]);
		expect(result.evidence.after).toEqual([1,1]);
		expect(result.evidence.order).toEqual([0,2,1]);
		expect(result.statuses).toEqual([200,200,200]);
	});
});
