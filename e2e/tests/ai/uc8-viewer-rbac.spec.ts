// Viewer UI controls and OAM enforcement on an owned objective.
import {expect,test} from '../../fixtures';
import {activeInstance,gw} from '../../helpers/api';
import {toolbarButton} from '../../helpers/table';
const instance=process.env.E2E_INSTANCE_NAME;
const name=`uc8qa-viewer-${Date.now().toString(36)}`;
let attempted=false;
test.use({storageState:'.auth/viewer.json',trace:'off',screenshot:'off',video:'off'});
test.describe('UC8-LIVE-VIEWER: objective write authorization',()=>{
 test.skip(process.env.UC8_QA_ALLOW_MUTATIONS!=='1'||instance!=='uc8qa-gateway','Requires the dedicated QA instance.');
 test.beforeAll(async()=>{expect((await activeInstance()).name).toBe(instance);});
 test.afterAll(async()=>{
  if(!attempted)return;
  const r=await gw('GET','/config/ai/objective');expect(r.status).toBe(200);
  const body=await r.json() as {objectiveAttr?:{name:string}[]};
  if((body.objectiveAttr??[]).some(x=>x.name===name))expect([200,204]).toContain((await gw('DELETE',`/config/ai/objective/${name}`)).status);
  const after=await gw('GET','/config/ai/objective');expect(after.status).toBe(200);
  expect(((await after.json()) as {objectiveAttr?:{name:string}[]}).objectiveAttr?.some(x=>x.name===name)??false).toBe(false);
 });
 test('hides edit controls and denies a direct viewer write',async({page})=>{
  const readPromise=page.waitForRequest(r=>r.method()==='GET'&&r.url().endsWith('/config/ai/objective'));
  await page.goto(`instance/ai/objectives?name=${encodeURIComponent(instance!)}`);
  const read=await readPromise;const headers=await read.allHeaders();
  const authorization=headers.authorization;expect(authorization,'viewer request must carry authorization').toBeTruthy();
  for(const action of ['Add','Edit','Delete'] as const)await expect(toolbarButton(page,action)).toHaveCount(0);
  attempted=true;
  const response=await page.request.post(read.url(),{headers:{authorization,'content-type':'application/json'},data:{name,priority:10}});
  expect(response.status(),'OAM must reject viewer writes').toBe(403);
  const after=await gw('GET','/config/ai/objective');expect(after.status).toBe(200);
  const body=await after.json() as {objectiveAttr?:{name:string}[]};expect((body.objectiveAttr??[]).some(x=>x.name===name)).toBe(false);
 });
});
