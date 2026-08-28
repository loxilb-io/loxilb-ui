import {describe, expect, it} from 'vitest';
import {identifyFdbEntries} from './fdb_identity';

describe('identifyFdbEntries', () => {
	it('gives exact duplicate device/MAC records unique deterministic row IDs', () => {
		const entries = [
			{dev: 'eth1', macAddress: '02:00:00:00:00:01'},
			{dev: 'eth1', macAddress: '02:00:00:00:00:01'},
			{dev: 'eth2', macAddress: '02:00:00:00:00:01'},
		];

		const identified = identifyFdbEntries(entries);

		expect(new Set(identified.map(item => item.id)).size).toBe(3);
		expect(identified.map(item => item.entry)).toEqual(entries);
		expect(identifyFdbEntries(entries).map(item => item.id)).toEqual(identified.map(item => item.id));
	});

	it('does not collide when tuple values contain separators', () => {
		const identified = identifyFdbEntries([
			{dev: 'a_b', macAddress: 'c'},
			{dev: 'a', macAddress: 'b_c'},
		]);

		expect(identified[0].id).not.toBe(identified[1].id);
	});
});
