// Dedicated software VLAN/VXLAN datapaths, CLI binding and UI readback.
// Never use on a shared Gateway: creates scoped Linux links and a test container.
import {execFileSync} from 'node:child_process';
import {expect,test} from '../../fixtures';
import {activeInstance,fullproxyVip,gw} from '../../helpers/api';
import {rowByText} from '../../helpers/table';
import {cleanupLbByName} from '../cicd/_recipes';
const instance=process.env.E2E_INSTANCE_NAME,host=process.env.UC8_QA_SSH_HOST??'',gateway=process.env.UC8_QA_GATEWAY_CONTAINER??'',backend=process.env.UC8_QA_BACKEND_IP??'',underlay=fullproxyVip(),suffix=Date.now().toString(36),client=`uc8qa-linkclient-${suffix}`;
const tenant=`uc8qa-linktenant-${suffix}`;
let clientCreated=false,gwLink='',clientLink='',binding='',rule='';
function ssh(...args:string[]){return execFileSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=8',host,...args],{encoding:'utf8',timeout:30_000,stdio:['ignore','pipe','pipe']});}
function inside(c:string,...args:string[]){return ssh('docker','exec',c,...args);}
function cli(...args:string[]){return inside(gateway,'loxicmd',...args);}
function rx(iface:string){return Number(inside(gateway,'cat',`/sys/class/net/${iface}/statistics/rx_packets`).trim());}
function probe(vip:string,port:number,nonce:string){const code=`import json,urllib.request,urllib.error\nbase='http://${backend}:8080';body=json.dumps({'model':'uc8qa-link-model','messages':[{'role':'user','content':'test'}]}).encode();req=urllib.request.Request('http://${vip}:${port}/v1/chat/completions',data=body,headers={'Content-Type':'application/json','X-Test-Nonce':'${nonce}'})\ntry:\n r=urllib.request.urlopen(req,timeout=8);status=r.status;r.close()\nexcept urllib.error.HTTPError as e:status=e.code\nwith urllib.request.urlopen(base+'/receipt/${nonce}',timeout=4) as r:d=json.load(r)\nprint(json.dumps({'status':status,'count':d.get('count',0),'tenant':(d.get('headers') or {}).get('x-auth-tenant')}))`;const enc=Buffer.from(code).toString('base64');return JSON.parse(inside(client,'python3','-c',`'exec(__import__("base64").b64decode("${enc}"))'`));}
test.describe('UC8-LIVE-LINKS: software VLAN and VXLAN',()=>{
 test.skip(process.env.UC8_QA_ALLOW_NETWORK!=='1'||process.env.UC8_QA_ALLOW_MUTATIONS!=='1'||instance!=='uc8qa-gateway','Requires explicitly enabled dedicated network testing.');
 test.beforeAll(async()=>{
  expect(host).toMatch(/^[a-zA-Z0-9._-]+$/);expect(gateway).toBe('uc8qa-20261028-gateway');for(const ip of [backend,underlay])expect(ip).toMatch(/^\d{1,3}(?:\.\d{1,3}){3}$/);expect((await activeInstance()).name).toBe(instance);
  expect(ssh('docker','inspect','--format',"'{{index .Config.Labels \"uc8qa.campaign\"}}'",gateway).trim()).toBe('20261028');
  clientCreated=true;ssh('docker','run','-d','--name',client,'--label','uc8qa.campaign=20261028','--cap-add','NET_ADMIN','--network','uc8qa-20261028-net','--entrypoint','/bin/sh','uc8qa-gateway:031f2aa','-c',"'sleep 300'");
 });
 test.afterEach(async()=>{
  if(binding){const r=await gw('DELETE',`/config/ai/netidentity/${binding}`);expect([200,204,404]).toContain(r.status);binding='';}
  if(rule){await cleanupLbByName(rule);rule='';}
  if(clientLink){inside(client,'ip','link','del',clientLink);clientLink='';}
  if(gwLink){inside(gateway,'ip','link','del',gwLink);gwLink='';}
 });
 test.afterAll(async()=>{
  if(clientCreated){let state='';try{state=ssh('docker','inspect','--format',"'{{.State.Status}}'",client).trim();}catch{/* create may have failed */}if(state==='running')ssh('docker','stop',client);}
 });
 for(const kind of ['vlan','vxlan'] as const)test(`${kind}: keyless network credential follows the software interface`,async({page})=>{
  test.setTimeout(90_000);
  const g=kind==='vlan'?'vlan310':'vxlan322',c=kind==='vlan'?'client310':'client322',vip=kind==='vlan'?'198.18.31.1':'198.18.32.1',peer=kind==='vlan'?'198.18.31.2':'198.18.32.2',port=kind==='vlan'?20131:20132;
  const clientIP=ssh('docker','inspect','--format',"'{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'",client).trim();expect(clientIP).toMatch(/^\d{1,3}(?:\.\d{1,3}){3}$/);
  const existing=inside(gateway,'ip','-j','link','show').trim();expect((JSON.parse(existing) as {ifname:string}[]).some(x=>x.ifname===g),`do not take over ${g}`).toBe(false);
  if(kind==='vlan'){
   inside(gateway,'ip','link','add','link','eth0','name',g,'type','vlan','id','310');gwLink=g;
   inside(client,'ip','link','add','link','eth0','name',c,'type','vlan','id','310');clientLink=c;
  }else{
   inside(gateway,'ip','link','add',g,'type','vxlan','id','322','local',underlay,'remote',clientIP,'dstport','4789','dev','eth0');gwLink=g;
   inside(client,'ip','link','add',c,'type','vxlan','id','322','local',clientIP,'remote',underlay,'dstport','4789','dev','eth0');clientLink=c;
  }
  inside(gateway,'ip','addr','add',`${vip}/24`,'dev',g);inside(gateway,'ip','link','set',g,'up');inside(client,'ip','addr','add',`${peer}/24`,'dev',c);inside(client,'ip','link','set',c,'up');
  const link=JSON.parse(inside(gateway,'ip','-j','-d','link','show',g)) as {linkinfo?:{info_kind?:string;info_data?:{id?:number}}}[];
  expect(link[0].linkinfo?.info_kind).toBe(kind);expect(link[0].linkinfo?.info_data?.id).toBe(kind==='vlan'?310:322);
  rule=`uc8qa-${kind}-rule-${suffix}`;cli('create','lb',vip,`--tcp=${port}:8080`,`--endpoints=${backend}:1`,'--mode=fullproxy',`--name=${rule}`,`--host=${vip}`,'--path-prefix=/','--path-match-mode=prefix','--model-name=uc8qa-link-model','--sse-mode','--api-key-auth=required','--fc-llmd-headers=on');
  binding=`uc8qa-${kind}-binding-${suffix}`;cli('create','netidentity',binding,`--tenant=${tenant}`,kind==='vlan'?'--vlan=310':'--vni=322',`--services=${vip}:${port}`,'--credential=network','--enforce=strict','--forward-identity');
  await page.goto(`instance/ai/netidentity?name=${encodeURIComponent(instance!)}`);const row=rowByText(page,binding).first();await expect(row).toBeVisible();await expect(row).toContainText(tenant);await expect(row).toContainText(kind==='vlan'?'310':'322');
  const before=rx(g);const allowed=probe(vip,port,`uc8qa-${suffix}-${kind}-allow`);expect(allowed).toMatchObject({status:200,count:1,tenant});expect(rx(g)).toBeGreaterThan(before);
  const del=await gw('DELETE',`/config/ai/netidentity/${binding}`);expect([200,204]).toContain(del.status);binding='';
  const denied=probe(vip,port,`uc8qa-${suffix}-${kind}-denied`);expect(denied).toMatchObject({status:401,count:0});
  console.log('UC8 link sanitized evidence:',JSON.stringify({kind,linkKind:link[0].linkinfo?.info_kind,id:link[0].linkinfo?.info_data?.id,rxIncreased:true,allowed:allowed.status,allowedReceipt:allowed.count,afterDelete:denied.status,deniedReceipt:denied.count}));
 });
});
