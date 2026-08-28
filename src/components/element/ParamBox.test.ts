import {describe, expect, it} from 'vitest';

import {shouldAutoSelectEnumDefault} from './ParamBox';

const options = [{id: 0, name: 'default', send_value: 'default'}];

describe('shouldAutoSelectEnumDefault', () => {
	it('announces the first enum option for an enabled empty field', () => {
		expect(shouldAutoSelectEnumDefault(options, undefined, false)).toBe(true);
		expect(shouldAutoSelectEnumDefault(options, '', false)).toBe(true);
		expect(shouldAutoSelectEnumDefault(options, null, false)).toBe(true);
	});

	it('does not mutate form state for a disabled field', () => {
		expect(shouldAutoSelectEnumDefault(options, undefined, true)).toBe(false);
	});

	it('does not replace an existing value or select from an empty enum', () => {
		expect(shouldAutoSelectEnumDefault(options, 'selected', false)).toBe(false);
		expect(shouldAutoSelectEnumDefault([], undefined, false)).toBe(false);
	});
});
