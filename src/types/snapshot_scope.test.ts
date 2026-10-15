import {describe, expect, it} from 'vitest';
import {snapshotScope} from './snapshot_scope';
describe('stored snapshot recovery scope projection', () => {
 it('retains declared scope without copying payloads, identities or secrets', () => {
  const scope=snapshotScope({kind:'loxilb-snapshot',schema_version:'1.11',domains:{ipsec:{secret:'private'}},included_domains:['ipsec','cert'],excluded_domains:['ai_keys'],recovery_dependencies:[{type:'api-key-db',required:true,id:'private-store',digest:'private'}]});
  expect(scope).toEqual({schema:'1.11',included:['cert','ipsec'],excluded:['ai_keys'],dependencies:[{type:'api-key-db',required:true}]});
  expect(JSON.stringify(scope)).not.toContain('private');
 });
 it('reports legacy or malformed scope as unknown instead of inferring coverage', () => {
  expect(snapshotScope({kind:'loxilb-snapshot',schema_version:'1.0',domains:{cert:[]}})).toEqual({schema:'1.0',included:null,excluded:null,dependencies:null});
  expect(snapshotScope({kind:'loxilb-snapshot',schema_version:'1.11',domains:{},included_domains:[null],recovery_dependencies:[{type:'db',required:'yes'}]}).included).toBeNull();
 });
 it.each([null,{}, {kind:'other',schema_version:'1',domains:{}}, {kind:'loxilb-snapshot',schema_version:'1'}, {kind:'loxilb-snapshot',schema_version:'1',domains:[]}, {kind:'loxilb-snapshot',schema_version:'',domains:{}}])('rejects an invalid document', doc => expect(() => snapshotScope(doc)).toThrow('Invalid snapshot document'));
});
