//---------------------------------------------------------
// RBAC Phase 3 — role normalization (docs/SECURITY_RBAC_PLAN.md §5)
//---------------------------------------------------------
import {describe, expect, it} from 'vitest';
import {normalize_role} from './oamHooks';

describe('normalize_role', () => {
	it('passes through the 3-role model', () => {
		expect(normalize_role('admin')).toBe('admin');
		expect(normalize_role('operator')).toBe('operator');
		expect(normalize_role('viewer')).toBe('viewer');
	});

	it('maps the legacy "user" role to operator', () => {
		expect(normalize_role('user')).toBe('operator');
	});

	it('returns null while the role is unknown/loading', () => {
		expect(normalize_role(undefined)).toBeNull();
		expect(normalize_role('')).toBeNull();
	});
});
