import {describe, expect, it} from 'vitest';
import {MENU_LIST} from './menu';

// OSS menu absence is a launch requirement of the observability surface:
// the whole group must be flavor-gated so SideMenu's `requiresFlavor`
// filter (which answers false while unresolved — fail-narrow) hides it on
// plain loxilb and during the probe window. Route-level protection is
// RequireFeature's, tested with the guards; this pins the menu side.
describe('Observability menu group', () => {
	const group = MENU_LIST.find(m => m.path === 'observability');

	it('exists with the three launch pages', () => {
		expect(group).toBeDefined();
		expect(group!.items!.map(i => i.path)).toEqual(['ai', 'workers', 'pdkv']);
	});

	it('is gated on the gateway flavor at the GROUP level', () => {
		expect(group!.requiresFlavor).toBe('inference-gateway');
		// No item may weaken the group gate by omitting its own requirement
		// AND being reachable another way — the group gate covers them, but a
		// future common (OSS-visible) observability item must be a deliberate
		// act: moving it OUT of this flavor-gated group, not editing this pin.
	});
});
