// UC-8 C3: CLI-only invalid expert settings must be refused with no rule mutation.
import {execFileSync,spawnSync} from 'node:child_process';
import {expect,test} from '../../fixtures';
import {activeInstance,fullproxyVip,gw} from '../../helpers/api';
import {openToolbarDialog} from '../../helpers/dialogs';
import {expandSection,field} from '../../helpers/form';
import {selectRowByText} from '../../helpers/table';
import {cleanupLbByName} from '../cicd/_recipes';
const instance=process.env.E2E_INSTANCE_NAME, host=process.env.UC8_QA_SSH_HOST??'',container=process.env.UC8_QA_GATEWAY_CONTAINER??'',backend=process.env.UC8_QA_BACKEND_IP??'',vip=fullproxyVip(),name=`uc8qa-invalid-${Date.now().toString(36)}`;
const keys=['fc_wake_policy','fc_band_weights','fc_band_min_share_pct','fc_band_queue_pct','fc_band_wait_ms','fc_critical_reserve_pct','fc_shed_queue','fc_tenant_wake','fc_llmd_headers','ai_default_reservation','ai_default_max_tokens','ai_objective_strict'];
const cases:{label:string;field:string;args:string[];exit:number}[]=[
 {label:'weighted zero',field:'fc_band_weights',args:['--fc-wake-policy=weighted','--fc-band-weights=8:0:1'],exit:6},
 {label:'weighted absent',field:'fc_band_weights',args:['--fc-wake-policy=weighted'],exit:6},
 {label:'weighted reset',field:'fc_band_weights',args:['--fc-wake-policy=weighted','--fc-band-weights=0:0:0'],exit:6},
 {label:'weighted sum',field:'fc_band_weights',args:['--fc-wake-policy=weighted','--fc-band-weights=40:20:5'],exit:6},
 {label:'weight range',field:'fc_band_weights',args:['--fc-band-weights=63:1:0'],exit:2},
 {label:'strict zero',field:'fc_band_weights',args:['--fc-wake-policy=strict','--fc-band-weights=8:0:1'],exit:6},
 {label:'floor sum',field:'fc_band_min_share_pct',args:['--fc-band-min-share-pct=50:40:20'],exit:6},
 {label:'reserve and floor',field:'fc_critical_reserve_pct',args:['--fc-critical-reserve-pct=60','--fc-band-min-share-pct=0:50:0'],exit:6},
 {label:'reserve and two floors',field:'fc_critical_reserve_pct',args:['--fc-critical-reserve-pct=50','--fc-band-min-share-pct=0:30:30'],exit:6},
 {label:'queue shares',field:'fc_band_queue_pct',args:['--fc-band-queue-pct=50:40:20'],exit:6},
 {label:'malformed wait',field:'fc_band_wait_ms',args:['--fc-band-wait-ms=100:200'],exit:2},
 {label:'wait range',field:'fc_band_wait_ms',args:['--fc-band-wait-ms=0:3600001:0'],exit:2},
 {label:'shed with no queue',field:'fc_shed_queue',args:['--fc-max-queue-depth=0','--fc-shed-queue=on'],exit:6},
];
let attempted=false;
function args(extra:string[]):string[]{return ['-o','BatchMode=yes','-o','ConnectTimeout=8',host,'docker','exec',container,'loxicmd','create','lb',vip,'--tcp=20126:8080',`--endpoints=${backend}:1`,'--mode=fullproxy',`--name=${name}`,`--host=${vip}`,'--path-prefix=/','--path-match-mode=prefix','--model-name=uc8qa-invalid-model','--sse-mode','--fc-mode=enforce','--fc-max-outstanding=4','--fc-max-queue-depth=8','--fc-max-queue-wait-ms=5000',...extra];}
async function read(){const r=await gw('GET','/config/loadbalancer/all');expect(r.status).toBe(200);const b=await r.json() as {lbAttr?:{serviceArguments:Record<string,unknown>}[]};const v=b.lbAttr?.find(x=>x.serviceArguments.name===name);expect(v).toBeTruthy();const sa={...v!.serviceArguments};delete sa.fc_effective;return sa;}
test.describe('UC8-LIVE-CLI-INVALID: CLI validation and UI readback',()=>{
 test.skip(process.env.UC8_QA_ALLOW_MUTATIONS!=='1'||instance!=='uc8qa-gateway','Requires explicitly authorized dedicated instance.');
 test.beforeAll(async()=>{expect(host).toMatch(/^[a-zA-Z0-9._-]+$/);expect(container).toMatch(/^uc8qa-[a-z0-9-]+$/);for(const x of [vip,backend])expect(x).toMatch(/^\d{1,3}(?:\.\d{1,3}){3}$/);expect((await activeInstance()).name).toBe(instance);attempted=true;execFileSync('ssh',args([]),{encoding:'utf8',timeout:25_000,stdio:['ignore','pipe','pipe']});});
 test.afterAll(async()=>{if(!attempted)return;await cleanupLbByName(name);const r=await gw('GET','/config/loadbalancer/all');expect(r.status).toBe(200);const b=await r.json() as {lbAttr?:{serviceArguments?:{name?:string}}[]};expect((b.lbAttr??[]).some(x=>x.serviceArguments?.name===name)).toBe(false);});
 test('rejects C3 combinations without changing the rule or exposing expert inputs',async({page})=>{
  test.setTimeout(120_000);const before=await read();
  for(const c of cases){const result=spawnSync('ssh',args(c.args),{encoding:'utf8',timeout:25_000,stdio:['ignore','pipe','pipe']});expect(result.status,c.label).toBe(c.exit);const text=`${result.stdout??''}\n${result.stderr??''}`;expect(text.includes(c.field)||text.includes(c.field.replaceAll('_','-')),`${c.label} identifies ${c.field}`).toBe(true);expect(await read(),`${c.label} preserves rule`).toEqual(before);console.log('UC8 CLI rejection:',c.label,'exit',result.status);}
  await page.goto(`instance/traffic/lb?name=${encodeURIComponent(instance!)}`);await selectRowByText(page,name);await openToolbarDialog(page,'Edit','Edit Load Balancer Rule');const ai=await expandSection(page,/^AI Gateway/);await expect(field(page,'Max Outstanding',ai)).toHaveValue('4');
  for(const key of keys)await expect(page.locator(`[name="${key}"]`),`${key} is not a UI input`).toHaveCount(0);
 });
});
