// UC-8: create an admission rule through the real UI and send one synthetic request.
// One successful request is not proof of saturation, ordering, or fairness.
import {execFileSync} from 'node:child_process';
import {expect, test} from '../../fixtures';
import {activeInstance, fullproxyVip, gw} from '../../helpers/api';
import {cleanupLbByName, LbRecipe, runLbScenario} from '../cicd/_recipes';

const instance = process.env.E2E_INSTANCE_NAME;
const host = process.env.UC8_QA_SSH_HOST ?? '';
const client = process.env.UC8_QA_CLIENT_CONTAINER ?? '';
const backend = process.env.UC8_QA_BACKEND_IP ?? '';
const vip = fullproxyVip();
const name = `uc8qa-traffic-${Date.now().toString(36)}`;
const nonce = `uc8qa-${Date.now().toString(36)}`;
let attempted = false;
const allowed = process.env.UC8_QA_ALLOW_MUTATIONS === '1' && instance === 'uc8qa-gateway';

function clientPython(source: string): any {
	const encoded = Buffer.from(source).toString('base64');
	const raw = execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', host,
		'docker', 'exec', client, 'python', '-c', `'exec(__import__("base64").b64decode("${encoded}"))'`],
	{encoding: 'utf8', timeout: 25_000, stdio: ['ignore', 'pipe', 'pipe']});
	return JSON.parse(raw);
}

test.describe.serial('UC8-LIVE-TRAFFIC: UI admission rule and backend receipt', () => {
	test.skip(!allowed, 'Requires explicit mutation authorization and the dedicated uc8qa-gateway instance.');
	test.beforeAll(async () => {
		expect(host).toMatch(/^[a-zA-Z0-9._-]+$/);
		expect(client).toMatch(/^uc8qa-[a-z0-9-]+$/);
		expect(backend).toMatch(/^\d{1,3}(?:\.\d{1,3}){3}$/);
		expect(vip).toMatch(/^\d{1,3}(?:\.\d{1,3}){3}$/);
		expect((await activeInstance()).name).toBe(instance);
	});
	test.afterAll(async () => {
		if (!attempted) return;
		await cleanupLbByName(name);
		const response = await gw('GET', '/config/loadbalancer/all');
		expect(response.status).toBe(200);
		const body = await response.json() as {lbAttr?: {serviceArguments?: {name?: string}}[]};
		expect((body.lbAttr ?? []).some(row => row.serviceArguments?.name === name)).toBe(false);
	});
	test('forwards a request to the synthetic backend', async ({page}) => {
		const recipe: LbRecipe = {cicd: 'uc8qa', name, vip, port: '20119', mode: 'fullproxy', host: vip,
			pathPrefix: '/', pathMatchMode: 'prefix', ai: {modelName: 'uc8qa-model', sseMode: true,
				fcMode: 'enforce', fcMaxOutstanding: '1', fcMaxQueueDepth: '1', fcMaxQueueWaitMs: '5000'},
			endpoints: [{ip: backend, targetPort: '8080'}]};
		attempted = true;
		await runLbScenario(page, instance!, recipe);
		const result = clientPython(`import json,urllib.request\nbody=json.dumps({'model':'uc8qa-model','messages':[{'role':'user','content':'test'}]}).encode()\nreq=urllib.request.Request('http://${vip}:20119/v1/chat/completions',data=body,headers={'Content-Type':'application/json','X-Test-Nonce':'${nonce}'})\nwith urllib.request.urlopen(req,timeout=12) as r: print(json.dumps({'status':r.status,'body':json.load(r)}))`);
		expect(result.status).toBe(200);
		expect(result.body.id).toBe(nonce);
		const receipt = clientPython(`import json,urllib.request\nwith urllib.request.urlopen('http://${backend}:8080/receipt/${nonce}',timeout=5) as r: print(json.dumps(json.load(r)))`);
		expect(receipt).toMatchObject({count: 1, name: nonce, body: {model: 'uc8qa-model'}});
	});
	test('holds one request, queues one and rejects overflow before releasing', async () => {
		const run = clientPython(`import json,urllib.request,urllib.error,threading,time
url='http://${vip}:20119/v1/chat/completions'
base='http://${backend}:8080'
body=json.dumps({'model':'uc8qa-model','messages':[{'role':'user','content':'test'}]}).encode()
results={}
def get(path):
 with urllib.request.urlopen(base+path,timeout=5) as r: return json.load(r)
def post(name,hold=False):
 headers={'Content-Type':'application/json','X-Test-Nonce':name}
 if hold: headers['X-Test-Hold']='1'
 try:
  with urllib.request.urlopen(urllib.request.Request(url,data=body,headers=headers),timeout=12) as r: results[name]={'status':r.status,'body':json.load(r)}
 except urllib.error.HTTPError as e: results[name]={'status':e.code,'body':e.read().decode()}
 except Exception as e: results[name]={'error':str(e)}
first='${nonce}-held'; second='${nonce}-queued'; third='${nonce}-overflow'
a=threading.Thread(target=post,args=(first,True)); a.start()
try:
 for _ in range(100):
  if get('/receipt/'+first).get('count')==1: break
  time.sleep(.05)
 else: raise RuntimeError('held request never arrived at backend')
 b=threading.Thread(target=post,args=(second,)); b.start(); time.sleep(.4)
 c=threading.Thread(target=post,args=(third,)); c.start(); c.join(timeout=3)
 before={'queued':get('/receipt/'+second),'overflow':get('/receipt/'+third)}
finally:
 get('/release/'+first)
a.join(timeout=12); b.join(timeout=12); c.join(timeout=12)
print(json.dumps({'results':results,'before':before,'after':{'queued':get('/receipt/'+second),'overflow':get('/receipt/'+third)}}))`);
		expect(run.results[`${nonce}-held`].status).toBe(200);
		expect(run.results[`${nonce}-queued`].status).toBe(200);
		expect(run.results[`${nonce}-overflow`].status).toBe(429);
		expect(run.before.queued.count).toBe(0);
		expect(run.before.overflow.count).toBe(0);
		expect(run.after.queued.count).toBe(1);
		expect(run.after.overflow.count).toBe(0);
	});
});
