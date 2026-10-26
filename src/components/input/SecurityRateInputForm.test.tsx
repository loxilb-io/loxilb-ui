import 'locales/i18n';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ISecurityRateConfigMod} from 'types/security';
import SecurityRateInputForm from './SecurityRateInputForm';

afterEach(cleanup);
const onlyAggregate = {synThreshold: 0, cookieThreshold: 0, ratePerSec: 0, udpPktThreshold: 0, udpBandwidthMB: 0, aggregateSynThreshold: 10} as ISecurityRateConfigMod;

describe('security rate replacement form', () => {
	it('materializes omitted numeric zeros without installing new defaults on edit', () => {
		const changed = vi.fn();
		render(<SecurityRateInputForm supportsAggregate value={{aggregateSynThreshold: 10} as ISecurityRateConfigMod} onChange={changed} />);
		expect(changed.mock.lastCall?.[0]).toMatchObject({synEnabled: false, connRateEnabled: false, udpEnabled: false, synThreshold: 0, cookieThreshold: 0, ratePerSec: 0, udpPktThreshold: 0, udpBandwidthMB: 0, isValid: true});
	});
	it('keeps omitted false flags off on an aggregate-only readback', () => {
		const changed = vi.fn();
		render(<SecurityRateInputForm supportsAggregate value={onlyAggregate} onChange={changed} />);
		expect((screen.getByLabelText('Enable SYN Flood Protection') as HTMLInputElement).checked).toBe(false);
		expect((screen.getByLabelText('Enable Connection Rate Limiting') as HTMLInputElement).checked).toBe(false);
		expect(changed.mock.lastCall?.[0]).toMatchObject({synEnabled: false, connRateEnabled: false, udpEnabled: false, aggregateSynThreshold: 10, isValid: true});
	});
	it('rejects malformed, negative, fractional and oversized aggregate input without coercion', () => {
		const changed = vi.fn();
		render(<SecurityRateInputForm supportsAggregate value={onlyAggregate} onChange={changed} />);
		const field = screen.getByLabelText(/Aggregate SYN Packets\/s/);
		for (const raw of ['', '-1', '1.5', '16777217']) {
			fireEvent.change(field, {target: {value: raw}});
			expect(changed.mock.lastCall?.[0].isValid).toBe(false);
		}
		fireEvent.change(field, {target: {value: '0'}});
		expect(changed.mock.lastCall?.[0].isValid).toBe(false);
		fireEvent.change(field, {target: {value: '12'}});
		expect(changed.mock.lastCall?.[0]).toMatchObject({aggregateSynThreshold: 12, isValid: true});
	});
	it('does not show or submit aggregate fields to a legacy instance', () => {
		const changed = vi.fn();
		render(<SecurityRateInputForm onChange={changed} />);
		expect(screen.queryByLabelText('Aggregate SYN Packets/s')).toBeNull();
		expect(changed.mock.lastCall?.[0]).not.toHaveProperty('aggregateSynThreshold');
	});
	it('validates the whitelist and preserves an explicit empty replacement', () => {
		const changed = vi.fn();
		render(<SecurityRateInputForm supportsAggregate value={onlyAggregate} onChange={changed} />);
		const field = screen.getByLabelText('Whitelist IPs (comma-separated)');
		fireEvent.change(field, {target: {value: '999.1.1.1/32'}});
		expect(changed.mock.lastCall?.[0].isValid).toBe(false);
		fireEvent.change(field, {target: {value: '172.30.97.40/32, 2001:db8::1/128'}});
		expect(changed.mock.lastCall?.[0].isValid).toBe(true);
		fireEvent.change(field, {target: {value: ''}});
		expect(changed.mock.lastCall?.[0]).toMatchObject({whitelistIps: [], isValid: true});
	});
});
