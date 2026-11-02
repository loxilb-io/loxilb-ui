//---------------------------------------------------------
// BGP defined-set prefix rendering
// (npm test src/components/table/networks/BGPDefinedSetTable.test.ts)
//
// The table used `masklengthRange.replace('..', '-')`, which converts only
// the first separator: a range carrying more than one rendered half-converted
// ("1-2..3"). Code scanning flagged it as js/incomplete-sanitization.
//---------------------------------------------------------
import {describe, expect, it} from 'vitest';
import {formatPrefix} from './BGPDefinedSetTable';

describe('formatPrefix', () => {
	it('shows a gobgp mask-length range with a dash', () => {
		expect(formatPrefix({ipPrefix: '10.0.0.0/16', masklengthRange: '21..24'})).toBe('10.0.0.0/16 (21-24)');
	});

	it('converts every separator, not only the first', () => {
		expect(formatPrefix({ipPrefix: '10.0.0.0/16', masklengthRange: '1..2..3'})).toBe('10.0.0.0/16 (1-2-3)');
	});

	it('shows the bare prefix when no range is set', () => {
		expect(formatPrefix({ipPrefix: '10.0.0.0/16', masklengthRange: ''})).toBe('10.0.0.0/16');
	});
});
