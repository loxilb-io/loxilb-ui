import {expect, it} from 'vitest';
import {ipFilterApplied, ipFiltersAbsent, parseIPFilterRows} from './ipfilter_policy';
const rule = {filterType: 'blacklist' as const, action: 'drop' as const, cidr: '192.0.2.17/24', priority: 0};
it('confirms canonical identity and value, never just the old row or its counters', () => {
 expect(ipFilterApplied(rule)([{...rule, cidr: '192.0.2.0/24', packets: 42}])).toBe(true);
 expect(ipFilterApplied(rule)([{...rule, priority: 100}])).toBe(false);
 expect(ipFilterApplied({...rule, priority: undefined})([{...rule, priority: 100}])).toBe(true);
 expect(ipFiltersAbsent([rule])([{...rule, cidr: '192.0.2.0/24'}])).toBe(false);
 expect(ipFiltersAbsent([rule])([{...rule, cidr: '198.51.100.0/24'}])).toBe(true);
});
it('accepts a real null empty list and rejects malformed success bodies', () => {
 expect(parseIPFilterRows(null)).toEqual([]);
 expect(parseIPFilterRows([])).toEqual([]);
 for (const body of [undefined, {}, [null], [{cidr: '192.0.2.0/24'}]]) expect(() => parseIPFilterRows(body)).toThrow();
});
