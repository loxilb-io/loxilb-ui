import {describe, expect, it} from 'vitest';

import {epRoleLabel, hasPdFields} from './LBEndpointTable';

describe('epRoleLabel', () => {
	it('maps the P/D role catalog ids to their names', () => {
		expect(epRoleLabel(0)).toBe('normal');
		expect(epRoleLabel(1)).toBe('prefill');
		expect(epRoleLabel(2)).toBe('decode');
	});

	it('falls back to the raw number for unknown role ids', () => {
		expect(epRoleLabel(7)).toBe('7');
	});

	it('returns undefined when the gateway omits the field', () => {
		expect(epRoleLabel(undefined)).toBeUndefined();
		expect(epRoleLabel(null)).toBeUndefined();
	});
});

describe('hasPdFields', () => {
	const base = {endpointIP: '10.0.0.7', weight: 1, targetPort: 8100, state: 'active', counter: '0:0'};

	it('is false for plain L4 endpoints (no P/D fields returned)', () => {
		expect(hasPdFields([base])).toBe(false);
		expect(hasPdFields([])).toBe(false);
		expect(hasPdFields(undefined)).toBe(false);
	});

	it('is true when any endpoint carries ep_role', () => {
		expect(hasPdFields([base, {...base, endpointIP: '10.0.0.10', ep_role: 2}])).toBe(true);
	});

	it('is true when any endpoint carries nixl_port', () => {
		expect(hasPdFields([{...base, nixl_port: 5600}])).toBe(true);
	});

	it('is true even for ep_role 0 (explicit normal, still an AI-gateway rule)', () => {
		expect(hasPdFields([{...base, ep_role: 0}])).toBe(true);
	});
});
