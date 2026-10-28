// UI 504 handling: send one REAL owned write, then replace only its response
// with a simulated timeout. This reproduces an applied-but-unacknowledged write.
import {expect,test} from '../../fixtures';
import {activeInstance,gw} from '../../helpers/api';
import {dialog,dialogButton,dialogTitle,openToolbarDialog} from '../../helpers/dialogs';
import {field} from '../../helpers/form';
import {rowByText} from '../../helpers/table';
const instance=process.env.E2E_INSTANCE_NAME;
const name=`uc8qa-unknown-${Date.now().toString(36)}`;
let attempted=false;
test.describe('UC8-WRITE-UNKNOWN: applied objective with lost response',()=>{
 test.skip(process.env.UC8_QA_ALLOW_MUTATIONS!=='1'||instance!=='uc8qa-gateway','Requires an explicitly selected dedicated instance.');
 test.beforeAll(async()=>{expect((await activeInstance()).name).toBe(instance);const r=await gw('GET','/config/ai/objective');expect(r.status).toBe(200);});
 test.afterAll(async()=>{if(!attempted)return;const r=await gw('DELETE',`/config/ai/objective/${name}`);expect([200,204,404]).toContain(r.status);const read=await gw('GET','/config/ai/objective');expect(read.status).toBe(200);const data=await read.json() as {objectiveAttr?:{name:string}[]};expect((data.objectiveAttr??[]).some(x=>x.name===name)).toBe(false);});
 test('a 504 after an applied write warns and rereads instead of claiming failure',async({page,consoleGuard})=>{
  consoleGuard.allowRequest({status:504,path:/\/config\/ai\/objective$/});
  let writes=0,backendStatus=0,readsAfterWrite=0;
  await page.route('**/netlox/v1/config/ai/objective',async route=>{
   if(route.request().method()!=='POST')return route.continue();
   writes++;attempted=true;
   const actual=await route.fetch();backendStatus=actual.status();
   await route.fulfill({status:504,contentType:'application/json',body:JSON.stringify({message:'simulated lost response'})});
  });
  page.on('response',r=>{if(writes>0&&r.request().method()==='GET'&&r.url().endsWith('/config/ai/objective')&&r.status()===200)readsAfterWrite++;});
  await page.goto(`instance/ai/objectives?name=${encodeURIComponent(instance!)}`);
  await openToolbarDialog(page,'Add',dialogTitle(page,'New Objective'));
  await field(page,'Name').fill(name);await field(page,'Priority').fill('10');
  await dialogButton(page,'Add').click();
  await expect(dialog(page).getByText(/not known whether this change was applied/i)).toBeVisible({timeout:20_000});
  expect(writes).toBe(1);expect(backendStatus).toBe(200);
  await expect.poll(()=>readsAfterWrite,{timeout:20_000}).toBeGreaterThan(0);
  const r=await gw('GET','/config/ai/objective');expect(r.status).toBe(200);
  const body=await r.json() as {objectiveAttr?:{name:string;priority:number}[]};expect(body.objectiveAttr?.find(x=>x.name===name)).toMatchObject({name,priority:10});
  await dialogButton(page,'OK').click();await expect(rowByText(page,name).first()).toBeVisible({timeout:15_000});
  expect(writes).toBe(1);
 });
});
