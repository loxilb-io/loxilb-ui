// Dedicated QA only: temporarily isolate the Gateway from its PostgreSQL IP.
// The OAM and database remain running. A container-side watchdog restores the route.
import {execFileSync} from 'node:child_process';
import {expect,test} from '../../fixtures';
import {activeInstance,gw} from '../../helpers/api';
import {rowByText,toolbarButton} from '../../helpers/table';
import {dialog,dialogButton,dialogTitle,openToolbarDialog} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
const instance=process.env.E2E_INSTANCE_NAME;
const host=process.env.UC8_QA_SSH_HOST??'';
const gateway=process.env.UC8_QA_GATEWAY_CONTAINER??'';
const db=process.env.UC8_QA_DB_IP??'';
const suffix=Date.now().toString(36);
const name=`uc8qa-outage-${suffix}`;
const denied=`uc8qa-denied-${suffix}`;
const marker=`/tmp/uc8qa-route-${suffix}`;
let routeOwned=false, objectiveAttempted=false;
function ssh(...args:string[]):string{return execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=8',host,...args],{encoding:'utf8',timeout:15_000,stdio:['ignore','pipe','pipe']});}
function route():string{return ssh('docker','exec',gateway,'ip','-4','route','show','exact',`${db}/32`).trim();}
function restore():void{
 if(!routeOwned)return;
 const current=route();
 if(current && current!==`unreachable ${db}` && current!==`unreachable ${db}/32`) throw new Error('unexpected route; refusing to remove it');
 if(current)ssh('docker','exec',gateway,'ip','route','del','unreachable',`${db}/32`);
 ssh('docker','exec',gateway,'rm','-f',marker);
 routeOwned=false;
}
test.describe('UC8-LIVE-STORE-REFRESH: explicit recovery read',()=>{
 test.skip(process.env.UC8_QA_ALLOW_FAULTS!=='1'||process.env.UC8_QA_ALLOW_MUTATIONS!=='1'||instance!=='uc8qa-gateway','Requires explicit fault enablement and the dedicated instance.');
 test.beforeAll(async()=>{
  expect(host).toMatch(/^[a-zA-Z0-9._-]+$/);expect(gateway).toBe('uc8qa-20261028-gateway');expect(db).toBe('172.18.0.2');expect((await activeInstance()).name).toBe(instance);
  const state=ssh('docker','inspect','--format',"'{{index .Config.Labels \"uc8qa.campaign\"}}'",gateway).trim();expect(state).toBe('20261028');
  const dbAddress=ssh('docker','inspect','--format',"'{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'",'uc8qa-20261028-postgres').trim();expect(dbAddress).toBe(db);
  expect(route(),'no existing host route to database').toBe('');
  objectiveAttempted=true;expect((await gw('POST','/config/ai/objective',{name,priority:10})).status).toBe(200);
  const r=await gw('GET','/config/ai/objective');expect(r.status).toBe(200);
  const body=await r.json() as {store_reachable?:boolean;objectiveAttr?:{name:string}[]};expect(body.store_reachable).toBe(true);expect(body.objectiveAttr?.some(x=>x.name===name)).toBe(true);
 });
 test.afterAll(async()=>{
  restore();
  await expect.poll(async()=>{try{const r=await gw('GET','/config/ai/objective');if(r.status!==200)return false;return (await r.json()).store_reachable===true;}catch{return false;}},{timeout:45_000}).toBe(true);
  if(objectiveAttempted) for(const n of [name,denied])expect([200,204,404]).toContain((await gw('DELETE',`/config/ai/objective/${n}`)).status);
 });
 test('shows last applied data, refuses a write, then recovers after explicit refresh',async({page,consoleGuard})=>{
  test.setTimeout(150_000);
  consoleGuard.allowRequest({status:503,path:/\/config\/ai\/(objective|apikey)(\/.*)?$/});
  await page.goto(`instance/ai/objectives?name=${encodeURIComponent(instance!)}`);
  await expect(rowByText(page,name).first()).toBeVisible();
  // Only a brand-new exact /32 route may be touched. The marker prevents a later
  // watchdog from removing another actor's route after our own cleanup.
  ssh('docker','exec',gateway,'touch',marker);
  ssh('docker','exec','-d',gateway,'sh','-c',`'sleep 90; if test -f ${marker}; then ip route del unreachable ${db}/32; rm -f ${marker}; fi'`);
  routeOwned=true;
  ssh('docker','exec',gateway,'ip','route','add','unreachable',`${db}/32`);
  expect(route()).toMatch(new RegExp(`^unreachable ${db.replaceAll('.','\\.')}(/32)?$`));
  let outage:{status:number;reachable?:boolean;present?:boolean}|undefined;
  await expect.poll(async()=>{
   try{const r=await gw('GET','/config/ai/objective');if(r.status!==200){outage={status:r.status};return false;}const b=await r.json() as {store_reachable?:boolean;objectiveAttr?:{name:string}[]};outage={status:r.status,reachable:b.store_reachable,present:b.objectiveAttr?.some(x=>x.name===name)};return b.store_reachable===false;}catch{return false;}
  },{timeout:40_000,intervals:[500,1000,2000]}).toBe(true);
  expect(outage).toMatchObject({status:200,reachable:false,present:true});
  console.log('UC8 store outage sanitized evidence:',JSON.stringify(outage));
  await toolbarButton(page,'Refresh').click();
  await expect(page.getByText(/The key store did not answer this read/)).toBeVisible({timeout:20_000});
  await expect(rowByText(page,name).first()).toBeVisible();
  await openToolbarDialog(page,'Add',dialogTitle(page,'New Objective'));
  await field(page,'Name').fill(denied);await field(page,'Priority').fill('5');
  const [req]=await Promise.all([page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/config/ai/objective')),dialogButton(page,'Add').click()]);
  expect((await req.response())?.status()).toBe(503);
  await expect(dialog(page).getByText(/unavailable|could not|failed|refused/i).first()).toBeVisible({timeout:20_000});
  restore();
  await expect.poll(async()=>{const r=await gw('GET','/config/ai/objective');if(r.status!==200)return false;const b=await r.json() as {store_reachable?:boolean;objectiveAttr?:{name:string}[]};return b.store_reachable===true && !!b.objectiveAttr?.some(x=>x.name===name) && !b.objectiveAttr?.some(x=>x.name===denied);},{timeout:45_000}).toBe(true);
  console.log('UC8 store recovery: reachable=true, original present, rejected write absent');
  await page.reload();
  const [uiRead] = await Promise.all([
   page.waitForResponse(r=>r.request().method()==='GET' && r.url().includes('/config/ai/objective') && r.status()===200,{timeout:30_000}),
   toolbarButton(page,'Refresh').click(),
  ]);
  const uiBody=await uiRead.json() as {store_reachable?:boolean;source?:string};
  console.log('UC8 recovered UI read:',JSON.stringify({status:uiRead.status(),reachable:uiBody.store_reachable,source:uiBody.source}));
  expect(uiBody.store_reachable, 'the browser must receive a fresh recovered read').toBe(true);
  await expect(rowByText(page,name).first()).toBeVisible();await expect(page.getByText(/The key store did not answer this read/)).toHaveCount(0);
 });
});
