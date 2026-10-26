import 'locales/i18n';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import FirewallInputForm from './FirewallInputForm';
const metadata = vi.hoisted(() => ({ruleArguments:{type:'object',properties:{sourceIP:{type:'string'},destinationIP:{type:'string'},minSourcePort:{type:'integer'},maxSourcePort:{type:'integer'},minDestinationPort:{type:'integer'},maxDestinationPort:{type:'integer'},protocol:{type:'integer'},preference:{type:'integer'}}},opts:{type:'object',properties:{drop:{type:'boolean'},allow:{type:'boolean'},fwMark:{type:'integer'},toPort:{type:'integer'}}}}));
vi.mock('hooks/instanceHook', () => ({useInstanceFromURL: () => null}));
vi.mock('hooks/query/queryHooks', () => {
 const getParam=()=>undefined;
 return {useMetadata:()=>({is_fetched:true,param_fields:metadata,get_param:getParam})};
});
afterEach(cleanup);
it('preserves rapid sibling edits and rejects invalid raw input without changing it to zero', () => {
 const change=vi.fn();render(<FirewallInputForm onChange={change} />);
 act(()=>{
  fireEvent.change(screen.getByLabelText('Source IP'),{target:{value:'192.0.2.1/32'}});
  fireEvent.change(screen.getByLabelText('Destination IP'),{target:{value:'198.51.100.1/32'}});
  fireEvent.change(screen.getAllByLabelText('Port Min')[1],{target:{value:'8080'}});
  fireEvent.change(screen.getAllByLabelText('Port Max')[1],{target:{value:'8080'}});
  fireEvent.click(screen.getByLabelText('Drop'));
 });
 expect(change.mock.lastCall![0]).toMatchObject({ruleArguments:{sourceIP:'192.0.2.1/32',destinationIP:'198.51.100.1/32',minDestinationPort:8080,maxDestinationPort:8080},opts:{drop:true},isValid:true});
 const preference=screen.getByLabelText('Preference') as HTMLInputElement;
 fireEvent.change(preference,{target:{value:'-1'}});
 expect(preference.value).toBe('-1');expect(change.mock.lastCall![0].isValid).toBe(false);
 fireEvent.change(preference,{target:{value:'0'}});expect(change.mock.lastCall![0]).toMatchObject({ruleArguments:{preference:0},isValid:true});
 expect(screen.queryByLabelText('Counter')).toBeNull();
});
it('keeps a partial destination range invalid until its upper bound is explicit',()=>{
 const change=vi.fn();render(<FirewallInputForm onChange={change}/>);
 fireEvent.change(screen.getByLabelText('Source IP'),{target:{value:'192.0.2.1/32'}});
 fireEvent.click(screen.getByLabelText('Drop'));
 fireEvent.change(screen.getAllByLabelText('Port Min')[1],{target:{value:'8080'}});
 expect(change.mock.lastCall![0].isValid).toBe(false);
 expect(screen.getAllByText('Min port must not exceed max port')).toHaveLength(2);
 fireEvent.change(screen.getAllByLabelText('Port Max')[1],{target:{value:'8080'}});
 expect(change.mock.lastCall![0].isValid).toBe(true);
});
