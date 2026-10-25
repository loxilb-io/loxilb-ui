import 'locales/i18n';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import UnsignedIntegerField from './UnsignedIntegerField';
afterEach(cleanup);
it('keeps bad text visible and invalid; neither zero nor a maximum replaces it', () => {
 const change=vi.fn();const view=render(<UnsignedIntegerField label="Budget" value={100} max={65535} onChange={change} />);
 const input=screen.getByLabelText('Budget') as HTMLInputElement;
 for(const text of ['-1','1.5','65536','50x']) {
  fireEvent.change(input,{target:{value:text}});
  expect(Number.isNaN(change.mock.lastCall![0])).toBe(true);
  view.rerender(<UnsignedIntegerField label="Budget" value={NaN} max={65535} onChange={change} />);
  expect(input.value).toBe(text);
 }
 fireEvent.change(input,{target:{value:'0'}});expect(change).toHaveBeenLastCalledWith(0);
 fireEvent.change(input,{target:{value:''}});expect(change).toHaveBeenLastCalledWith(undefined);
 view.rerender(<UnsignedIntegerField label="Budget" value={123} max={65535} onChange={change} />);expect(input.value).toBe('123');
});
