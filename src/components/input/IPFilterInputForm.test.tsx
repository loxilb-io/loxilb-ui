import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import IPFilterInputForm from './IPFilterInputForm';

afterEach(cleanup);
describe('XDP IP filter priority', () => {
	it('explains an invalid source prefix on its field and clears the error after correction', () => {
		const changed = vi.fn();
		render(<IPFilterInputForm onChange={changed} />);
		const cidr = screen.getByRole('textbox', {name: /^CIDR/});
		fireEvent.change(cidr, {target: {value: '172.30.197.51/999'}});
		expect(changed.mock.lastCall?.[0]).toMatchObject({isValid: false});
		expect(cidr.getAttribute('aria-invalid')).toBe('true');
		expect(screen.getByText('Invalid IP address format.')).not.toBeNull();
		fireEvent.change(cidr, {target: {value: '172.30.197.51/32'}});
		expect(changed.mock.lastCall?.[0]).toMatchObject({isValid: true});
		expect(cidr.getAttribute('aria-invalid')).toBe('false');
		expect(screen.queryByText('Invalid IP address format.')).toBeNull();
	});
	it('initializes the provided configuration without replacing priority zero', () => {
		const change = vi.fn();
		render(<IPFilterInputForm value={{filterType: 'blacklist', action: 'drop', cidr: '192.0.2.1/32', zone: 0, priority: 0}} onChange={change} />);
		expect(change.mock.lastCall?.[0]).toMatchObject({cidr: '192.0.2.1/32', priority: 0, isValid: true});
	});
	it('preserves explicit zero instead of silently replacing it with 100', () => {
		const changed=vi.fn(); render(<IPFilterInputForm onChange={changed} />);
		fireEvent.change(screen.getByRole('textbox',{name:/^CIDR/}),{target:{value:'172.30.97.51/32'}});
		fireEvent.change(screen.getByRole('textbox',{name:/^Priority/}),{target:{value:'0'}});
		expect(changed.mock.lastCall?.[0]).toMatchObject({priority:0,zone:0,isValid:true});
	});
	it('does not truncate bad integers into a policy priority', () => {
		const changed=vi.fn(); render(<IPFilterInputForm onChange={changed} />);
		fireEvent.change(screen.getByRole('textbox',{name:/^CIDR/}),{target:{value:'172.30.97.51/32'}});
		for(const raw of ['', '-1','1.5','65536','2x']) {
			fireEvent.change(screen.getByRole('textbox',{name:/^Priority/}),{target:{value:raw}});
			expect(changed.mock.lastCall?.[0]).toMatchObject({priority:100,isValid:false});
		}
		fireEvent.change(screen.getByRole('textbox',{name:/^Priority/}),{target:{value:'65535'}});
		expect(changed.mock.lastCall?.[0]).toMatchObject({priority:65535,isValid:true});
	});
});
