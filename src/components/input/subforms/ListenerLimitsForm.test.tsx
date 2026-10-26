import 'locales/i18n';
import {afterEach, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import ListenerLimitsForm from './ListenerLimitsForm';
import {validateListenerLimits} from 'types/listener_limits';
const value = {name: 'r', externalIP: '192.0.2.1', port: 8080, protocol: 'tcp', mode: 4, inactiveTimeOut: 60};
const params = {connectionLimit: {}, timeoutTcpInspect: {}};
afterEach(cleanup);
it('preserves zero and omission and rejects fractional or overflowing input', () => {
 const change = vi.fn();
 render(<ListenerLimitsForm value={value} params={params} onChange={change} />);
 const input = screen.getByLabelText('Concurrent Connection Limit');
 for (const raw of ['1.5', '-1', '4294967296', '1e2']) {
  fireEvent.change(input, {target: {value: raw}});
  expect(validateListenerLimits(change.mock.lastCall![0])).toEqual(['connectionLimit']);
 }
 fireEvent.change(input, {target: {value: '0'}});
 expect(change).toHaveBeenLastCalledWith({connectionLimit: 0});
 fireEvent.change(input, {target: {value: ''}});
 expect(change).toHaveBeenLastCalledWith({connectionLimit: undefined});
});
it('offers only declared fields and locks them outside fullproxy', () => {
 render(<ListenerLimitsForm value={{...value, mode: 0}} params={{connectionLimit: {}}} onChange={vi.fn()} />);
 expect((screen.getByLabelText('Concurrent Connection Limit') as HTMLInputElement).disabled).toBe(true);
 expect(screen.queryByLabelText('Header Deadline (ms)')).toBeNull();
});
