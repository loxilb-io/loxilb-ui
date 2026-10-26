import {expect, it} from 'vitest';
import {networkPrefixKey, validGatewayCidr} from './network_prefix';
it('compares network identity rather than spelling or host bits', () => {
 expect(networkPrefixKey('192.0.2.17/24')).toBe(networkPrefixKey('192.0.2.0/24'));
 expect(networkPrefixKey('192.0.2.1')).toBe(networkPrefixKey('192.0.2.1/32'));
 expect(networkPrefixKey('2001:0DB8:0:0:0:0:0:1/64')).toBe(networkPrefixKey('2001:db8::/64'));
 expect(networkPrefixKey('::ffff:192.0.2.1/128')).toBe(networkPrefixKey('192.0.2.1/32'));
 expect(networkPrefixKey('::ffff:c000:0201/120')).toBe(networkPrefixKey('192.0.2.0/24'));
 expect(networkPrefixKey('::/0')).toBe('v6:0:0:0:0:0:0:0:0/0');
});
it('rejects inputs Go would reject instead of silently treating them as a default', () => {
 for (const value of ['999.0.0.1', '010.0.0.1/32', '192.0.2.1/33', '2001:db8::/129', 'fe80::1%eth0/64', '192.0.2.1/24/1', '2001:db8::g/64', '1::2::3/64', '192.0.2.1/-1', '127.1', 'localhost']) expect(networkPrefixKey(value)).toBeUndefined();
 expect(validGatewayCidr('192.0.2.1')).toBe(false);
 expect(validGatewayCidr('::ffff:192.0.2.1/128')).toBe(true);
});
