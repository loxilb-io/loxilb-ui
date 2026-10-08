import {cleanup, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useSessionWatch} from './useSessionWatch';
import {IDLE_LIMIT_MS} from './sessionPolicy';
const logout = vi.hoisted(() => vi.fn());
const terminate = vi.hoisted(() => vi.fn());
vi.mock('connector/oam/oam', () => ({request_logout: logout}));
vi.mock('./session', () => ({terminateSession: terminate, msUntilProactiveLogout: () => 8*60*60_000}));
beforeEach(() => {vi.useFakeTimers(); localStorage.setItem('access_token','watched');logout.mockReset();terminate.mockReset();});
afterEach(() => {cleanup();vi.restoreAllMocks();vi.useRealTimers();localStorage.clear();});
describe('idle watcher', () => {
 it('requests revocation and tears down locally without waiting for a stalled logout', async () => {
  logout.mockImplementation(() => new Promise(() => {}));
  renderHook(useSessionWatch);await vi.advanceTimersByTimeAsync(IDLE_LIMIT_MS);
  expect(logout).toHaveBeenCalledOnce();expect(terminate).toHaveBeenCalledWith('idle');
 });
 it('visibility return respects the elapsed deadline', () => {
  renderHook(useSessionWatch);
  vi.setSystemTime(Date.now()+IDLE_LIMIT_MS+1);
  Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});
  document.dispatchEvent(new Event('visibilitychange'));
  expect(logout).toHaveBeenCalledOnce();expect(terminate).toHaveBeenCalledWith('idle');
 });
 it('real interaction grants a fresh idle window', async () => {
  renderHook(useSessionWatch);await vi.advanceTimersByTimeAsync(IDLE_LIMIT_MS-1);
  window.dispatchEvent(new Event('keydown'));await vi.advanceTimersByTimeAsync(2);
  expect(logout).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(IDLE_LIMIT_MS-2);
  expect(logout).toHaveBeenCalledOnce();
 });
 it('an old watcher cannot revoke a replacement token', async () => {
  renderHook(useSessionWatch);localStorage.setItem('access_token','replacement');
  await vi.advanceTimersByTimeAsync(8*60*60_000);
  expect(logout).not.toHaveBeenCalled();expect(terminate).not.toHaveBeenCalled();
 });
 it('unmount clears both watcher timer handles and prevents later callbacks', async () => {
  const schedule=vi.spyOn(globalThis,'setTimeout');
  const cancel=vi.spyOn(globalThis,'clearTimeout');
  const h=renderHook(useSessionWatch);
  const owned=schedule.mock.calls.flatMap((call,index) =>
   call[1]===IDLE_LIMIT_MS || call[1]===8*60*60_000 ? [schedule.mock.results[index].value] : []);
  expect(owned).toHaveLength(2);
  h.unmount();
  owned.forEach(handle => expect(cancel).toHaveBeenCalledWith(handle));
  await vi.advanceTimersByTimeAsync(8*60*60_000);
  expect(logout).not.toHaveBeenCalled();expect(terminate).not.toHaveBeenCalled();
 });
});
