import 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import SnapshotPage from './SnapshotPage';
import {getStableHash} from 'common';

const state = vi.hoisted(() => ({query: {} as any, schedule: {} as any, canWrite: true, popup: vi.fn(), take: vi.fn(), remove: vi.fn(), scope: vi.fn()}));
vi.mock('hooks/instanceHook', () => ({useInstanceFromURL: () => ({id: 1, name: 'ucx'})}));
vi.mock('hooks/query/oamHooks', () => ({useRole: () => ({can_manage_config: state.canWrite})}));
vi.mock('hooks/popupHook', () => ({usePopUp: () => ({openPopUp: state.popup, enableYes: vi.fn()})}));
vi.mock('hooks/query/snapshotHooks', () => ({useSnapshots: () => state.query, useSnapshotSchedule: () => state.schedule, useInvalidateSnapshots: () => vi.fn()}));
vi.mock('components/table/maintenance/SnapshotTable', () => ({default: ({onChangeSelectedRows}: any) => <button onClick={() => onChangeSelectedRows([getStableHash('snap-owned')])}>Select owned snapshot</button>}));
vi.mock('connector/oam/snapshotApi', async original => ({...(await original<typeof import('connector/oam/snapshotApi')>()),request_take_snapshot:state.take, request_delete_snapshot:state.remove, query_snapshot_scope:state.scope}));
vi.mock('components/snapshot/RestoreWizard', () => ({default: () => <div>Restore wizard</div>}));
const rows = [{id: 'snap-owned', name: 'owned', checksum_ok: true}];
const healthy = () => ({data: {data: rows}, error: null, dataUpdatedAt: Date.now(), isLoading: false, isError: false});
const actions = ['Take Snapshot', 'Pre-Upgrade Snapshot', 'Upload', 'Schedule', 'Restore…', 'Recovery scope', 'Download', 'Pin', 'Delete'];
const disabled = (name: string) => (screen.getByRole('button', {name}) as HTMLButtonElement).disabled;

beforeEach(() => {state.query=healthy();state.schedule={data:{enabled:false,interval_hours:24,retain_count:10},error:null,isError:false,isLoading:false};state.canWrite=true;state.popup.mockClear();state.take.mockClear();state.remove.mockClear();state.scope.mockClear();});
afterEach(cleanup);

describe('SnapshotPage trusted read before writes', () => {
 it('blocks every action after a failed refresh even with cached rows selected', () => {
  state.query={...healthy(),error:Object.assign(new Error('Authentication unavailable'),{status:503}),isError:true};
  render(<SnapshotPage />);fireEvent.click(screen.getByRole('button',{name:'Select owned snapshot'}));
  for(const name of actions) expect(disabled(name),name).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Take Snapshot'}));expect(state.popup).not.toHaveBeenCalled();
 });
 it('blocks writes before the initial read succeeds', () => {
  state.query={data:undefined,error:null,dataUpdatedAt:0,isLoading:true,isError:false};render(<SnapshotPage />);
  for(const name of actions) expect(disabled(name),name).toBe(true);
 });
 it('restores actions when the same cached page successfully recovers', () => {
  state.query={...healthy(),error:Object.assign(new Error('unavailable'),{status:503}),isError:true};
  const view=render(<SnapshotPage />);fireEvent.click(screen.getByRole('button',{name:'Select owned snapshot'}));
  state.query=healthy();view.rerender(<SnapshotPage />);
  for(const name of actions) expect(disabled(name),name).toBe(false);
 });
 it('blocks confirmation from a popup opened before a failed refresh', async () => {
  const view=render(<SnapshotPage />);fireEvent.click(screen.getByRole('button',{name:'Take Snapshot'}));
  const args=state.popup.mock.calls[0];args[1].props.onChange({name:'owned',description:'',isValid:true});
  state.query={...healthy(),error:Object.assign(new Error('unavailable'),{status:503}),isError:true};view.rerender(<SnapshotPage />);
  await args[4]();expect(state.take).not.toHaveBeenCalled();
 });
 it('blocks a typed delete confirmation opened before a failed refresh', async () => {
  const view=render(<SnapshotPage />);fireEvent.click(screen.getByRole('button',{name:'Select owned snapshot'}));
  fireEvent.click(screen.getByRole('button',{name:'Delete'}));
  const args=state.popup.mock.calls[0];args[1].props.onChange('owned');
  state.query={...healthy(),error:new Error('unavailable'),isError:true};view.rerender(<SnapshotPage />);
  await args[4]();expect(state.remove).not.toHaveBeenCalled();
 });
 it('keeps recovery-scope inspection available after a trusted read', async () => {
  state.scope.mockResolvedValue({included_domains:[],excluded_domains:[],external_dependencies:[]});
  render(<SnapshotPage />);fireEvent.click(screen.getByRole('button',{name:'Select owned snapshot'}));
  fireEvent.click(screen.getByRole('button',{name:'Recovery scope'}));
  expect(state.scope).toHaveBeenCalledWith('snap-owned');
 });
 it('does not overwrite a schedule whose own read failed', () => {
  state.schedule={...state.schedule,error:new Error('schedule unavailable'),isError:true};render(<SnapshotPage />);
  expect(disabled('Schedule')).toBe(true);expect(disabled('Take Snapshot')).toBe(false);
 });
 it('still allows creation after a trusted empty read', () => {
  state.query={...healthy(),data:{data:[]}};render(<SnapshotPage />);expect(disabled('Take Snapshot')).toBe(false);
 });
});
