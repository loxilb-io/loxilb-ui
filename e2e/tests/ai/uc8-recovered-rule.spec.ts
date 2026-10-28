// Read-only verification of one explicitly selected owned rule after recovery.
import {expect,test} from '../../fixtures';
import {activeInstance,gw} from '../../helpers/api';
import {openToolbarDialog} from '../../helpers/dialogs';
import {expandSection,field} from '../../helpers/form';
import {selectRowByText,toolbarButton} from '../../helpers/table';
const instance=process.env.E2E_INSTANCE_NAME, name=process.env.UC8_RECOVERED_RULE??'';
test('UC8-RECOVERY-READ: recovered persisted rule is visible and editable',async({page})=>{
 test.skip(process.env.UC8_QA_ALLOW_MUTATIONS!=='1'||instance!=='uc8qa-gateway','Requires the dedicated QA instance.');
 expect(name).toMatch(/^uc8qa-restart-[a-z0-9]+$/);expect((await activeInstance()).name).toBe(instance);
 const r=await gw('GET','/config/loadbalancer/all');expect(r.status).toBe(200);const b=await r.json() as {lbAttr?:{serviceArguments:Record<string,unknown>}[]};
 const sa=b.lbAttr?.find(x=>x.serviceArguments.name===name)?.serviceArguments;
 expect(sa).toMatchObject({fc_max_outstanding:11,fc_wake_policy:'weighted',fc_band_weights:'8:3:1',fc_band_min_share_pct:'10:10:10',fc_band_queue_pct:'30:30:30',fc_band_wait_ms:'1000:2000:3000',fc_critical_reserve_pct:10,fc_shed_queue:'on',fc_tenant_wake:'rr',fc_llmd_headers:'on',ai_default_reservation:'on',ai_default_max_tokens:128,ai_objective_strict:true});
 await page.goto(`instance/traffic/lb?name=${encodeURIComponent(instance!)}`);
 await toolbarButton(page,'Refresh').click();await selectRowByText(page,name);await openToolbarDialog(page,'Edit','Edit Load Balancer Rule');
 const ai=await expandSection(page,/^AI Gateway/);await expect(field(page,'Max Outstanding',ai)).toHaveValue('11');
});
