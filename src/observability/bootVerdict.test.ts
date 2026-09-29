import {describe, expect, it} from 'vitest';
import {bootVerdict} from './bootVerdict';

const boot = (b: Record<string, unknown>) => ({profile: 'strict', snapshot_found: false, succeeded: false, degraded: false, legacy_fallback: false, ...b});

describe('bootVerdict', () => {
	it('restored only when a found snapshot was fully applied', () => {
		expect(bootVerdict(boot({snapshot_found: true, succeeded: true}), 0)).toEqual({kind: 'restored', profile: 'strict'});
	});

	it('⭐ no snapshot found is "not restored", never a failure', () => {
		expect(bootVerdict(boot({}), 0)).toEqual({kind: 'not-restored', profile: 'strict'});
		// Found but neither applied nor degraded: vanished before the read.
		expect(bootVerdict(boot({snapshot_found: true}), 0).kind).toBe('not-restored');
	});

	it('degraded outranks everything, carrying the fallback and the quarantine path', () => {
		expect(bootVerdict(boot({snapshot_found: true, degraded: true, legacy_fallback: true, quarantine_path: '/etc/loxilb/snapshot.json.failed-1'}), 1)).toEqual({
			kind: 'degraded',
			legacyFallback: true,
			quarantinePath: '/etc/loxilb/snapshot.json.failed-1',
		});
		expect(bootVerdict(boot({snapshot_found: true, degraded: true}), undefined)).toEqual({kind: 'degraded', legacyFallback: false, quarantinePath: undefined});
	});

	it('a conflict warns over an otherwise clean boot, even without diagnostics', () => {
		expect(bootVerdict(boot({snapshot_found: true, succeeded: true}), 1)).toEqual({kind: 'conflict'});
		expect(bootVerdict(undefined, 1)).toEqual({kind: 'conflict'});
	});

	it('an absent conflict family is not zero and never decides alone', () => {
		expect(bootVerdict(undefined, undefined)).toEqual({kind: 'unknown'});
		expect(bootVerdict(undefined, 0)).toEqual({kind: 'unknown'});
	});

	it('an omitted profile stays omitted, not an empty name', () => {
		expect(bootVerdict(boot({profile: ''}), 0)).toEqual({kind: 'not-restored', profile: undefined});
	});
});
