import 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {RecoilRoot} from 'recoil';
import SnapshotPage from './SnapshotPage';
import PopUp from 'components/modal/PopUp';
import {getStableHash} from 'common';

const state = vi.hoisted(() => ({pinned: false, remove: vi.fn(), invalidate: vi.fn()}));
vi.mock('hooks/instanceHook', () => ({useInstanceFromURL: () => ({id: 1})}));
vi.mock('hooks/query/oamHooks', () => ({useRole: () => ({can_manage_config: true})}));
vi.mock('hooks/query/snapshotHooks', () => ({
 useSnapshots: () => ({data: {data: [{id:'owned-id', name:'uc5-owned', pinned:state.pinned, checksum_ok:true}]}, isError:false, isLoading:false}),
 useSnapshotSchedule: () => ({data:{enabled:false}}),
 useInvalidateSnapshots: () => state.invalidate,
}));
vi.mock('components/table/maintenance/SnapshotTable', () => ({default: ({onChangeSelectedRows}: any) => <button onClick={() => onChangeSelectedRows([getStableHash('owned-id')])}>Select owned snapshot</button>}));
vi.mock('components/snapshot/RestoreWizard', () => ({default: () => null}));
vi.mock('connector/oam/snapshotApi', async original => ({...(await original<typeof import('connector/oam/snapshotApi')>()), request_delete_snapshot:state.remove}));
beforeEach(() => {state.pinned=false;state.remove.mockReset().mockResolvedValue({status:'confirmed'});state.invalidate.mockClear();});
afterEach(cleanup);
function open() {
 render(<RecoilRoot><SnapshotPage /><PopUp /></RecoilRoot>);
 fireEvent.click(screen.getByRole('button',{name:'Select owned snapshot'}));
 fireEvent.click(screen.getByRole('button',{name:'Delete'}));
}
const confirmButton = () => within(screen.getByRole('dialog')).getByRole('button',{name:'Delete'}) as HTMLButtonElement;
describe('snapshot typed delete with the actual popup', () => {
 it('retains typed input, rejects mismatches and clearing, then deletes the captured ID once', async () => {
  const user=userEvent.setup();open();
  const input=screen.getByRole('textbox');
  expect(confirmButton().disabled).toBe(true);
  await user.type(input,'uc5-owned-wrong');
  expect((input as HTMLInputElement).value).toBe('uc5-owned-wrong');
  expect(confirmButton().disabled).toBe(true);
  await user.clear(input);await user.type(input,'uc5-owned');
  expect(confirmButton().disabled).toBe(false);
  await user.clear(input);expect(confirmButton().disabled).toBe(true);
  await user.type(input,'uc5-owned');await user.click(confirmButton());
  expect(state.remove).toHaveBeenCalledExactlyOnceWith('owned-id');
  expect(state.invalidate).toHaveBeenCalledOnce();
 });
 it('cancel and reopening reset the confirmation without deleting', async () => {
  const user=userEvent.setup();open();await user.type(screen.getByRole('textbox'),'uc5-owned');
  await user.click(screen.getByRole('button',{name:'Cancel'}));
  expect(state.remove).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button',{name:'Delete'}));
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  expect(confirmButton().disabled).toBe(true);
 });
 it('blocks pinned snapshots without presenting a delete input', () => {
  state.pinned=true;open();expect(screen.queryByRole('textbox')).toBeNull();expect(state.remove).not.toHaveBeenCalled();
 });
});
