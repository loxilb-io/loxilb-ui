//---------------------------------------------------------
// UI-P6-6 — the storage hook that backs the ES-12 preferences
// (npm test src/hooks/localStorageHook.test.tsx)
//
// ES-12 verifies: change → apply → reload → verify persistence → restore.
// "Reload" is a remount reading localStorage, which is exactly this hook, so
// the persistence half of ES-12 rests entirely on the contract below.
//
// Red-first for the corrupt-value defect: on a JSON parse error the hook
// ADOPTS the raw string as state instead of falling back to the default, and
// the write effect then serialises that garbage straight back into storage.
// The component is left holding a value outside its own type — a density of
// '{broken' is neither 'comfortable' nor 'compact' — and nothing throws, so
// the operator sees a silently wrong UI with no way to explain it.
//---------------------------------------------------------
import rawUseLocalStorageState from 'hooks/localStorageHook';
import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import type {Dispatch, SetStateAction} from 'react';

// The optional third argument (a shape validator) is part of the UI-P6-6
// contract; the cast keeps `tsc` green while the tests run red against the
// pre-fix two-parameter signature.
const useLocalStorageState = rawUseLocalStorageState as unknown as <T>(
	key: string,
	defaultValue: T,
	isValid?: (value: unknown) => value is T,
) => [T, Dispatch<SetStateAction<T>>];

const DENSITY_KEY = 'table_density';
const SIDE_MENU_KEY = 'is_open_side_menu';

type Density = 'comfortable' | 'compact';
const isDensity = (value: unknown): value is Density => value === 'comfortable' || value === 'compact';
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	cleanup();
	localStorage.clear();
});

//---------------------------------------------------------
// Persistence — the ES-12 "reload" half
//---------------------------------------------------------
describe('persistence across a remount (ES-12 reload step)', () => {
	it('uses the default when nothing is stored', () => {
		const {result} = renderHook(() => useLocalStorageState<Density>(DENSITY_KEY, 'comfortable', isDensity));
		expect(result.current[0]).toBe('comfortable');
	});

	it('a changed value is written to storage and survives a remount', () => {
		const first = renderHook(() => useLocalStorageState<Density>(DENSITY_KEY, 'comfortable', isDensity));
		act(() => first.result.current[1]('compact'));
		expect(localStorage.getItem(DENSITY_KEY)).toBe(JSON.stringify('compact'));

		first.unmount();

		// A remount is what a browser reload does to this hook.
		const second = renderHook(() => useLocalStorageState<Density>(DENSITY_KEY, 'comfortable', isDensity));
		expect(second.result.current[0]).toBe('compact');
	});

	it('restoring the default persists too (ES-12 restore step)', () => {
		localStorage.setItem(DENSITY_KEY, JSON.stringify('compact'));
		const {result, unmount} = renderHook(() => useLocalStorageState<Density>(DENSITY_KEY, 'comfortable', isDensity));
		act(() => result.current[1]('comfortable'));
		unmount();

		const again = renderHook(() => useLocalStorageState<Density>(DENSITY_KEY, 'comfortable', isDensity));
		expect(again.result.current[0]).toBe('comfortable');
	});

	it('two consumers of one key stay in sync — the "global density" contract', () => {
		// DataTable.tsx documents that density is shared by every table; the
		// mechanism is this hook's event bus, and every mounted table is a
		// separate consumer of the same key.
		const a = renderHook(() => useLocalStorageState<Density>(DENSITY_KEY, 'comfortable', isDensity));
		const b = renderHook(() => useLocalStorageState<Density>(DENSITY_KEY, 'comfortable', isDensity));

		act(() => a.result.current[1]('compact'));

		expect(a.result.current[0]).toBe('compact');
		expect(b.result.current[0]).toBe('compact');
	});
});

//---------------------------------------------------------
// Corrupt / hostile stored values — RED against today's hook
//---------------------------------------------------------
describe('a stored value that cannot be trusted falls back to the default', () => {
	it('RED: unparseable JSON does not become the state (non-string default)', () => {
		localStorage.setItem(SIDE_MENU_KEY, '{broken');
		const {result} = renderHook(() => useLocalStorageState<boolean>(SIDE_MENU_KEY, true, isBoolean));
		// Today: the catch branch returns '{broken', so the side menu's `open`
		// prop is a non-empty string — truthy by accident, not by contract.
		expect(result.current[0]).toBe(true);
	});

	it('RED: unparseable JSON does not become the state (string default)', () => {
		localStorage.setItem(DENSITY_KEY, '{broken');
		const {result} = renderHook(() => useLocalStorageState<Density>(DENSITY_KEY, 'comfortable', isDensity));
		expect(result.current[0]).toBe('comfortable');
	});

	it('RED: JSON that parses but is the wrong shape does not become the state', () => {
		// The dangerous case, because nothing throws anywhere: '5' is valid
		// JSON, so the hook hands the component a number where it declared a
		// string union.
		localStorage.setItem(DENSITY_KEY, '5');
		const {result} = renderHook(() => useLocalStorageState<Density>(DENSITY_KEY, 'comfortable', isDensity));
		expect(result.current[0]).toBe('comfortable');
	});

	it('RED: a rejected value is repaired in storage, not left to poison the next reload', () => {
		localStorage.setItem(DENSITY_KEY, '{broken');
		renderHook(() => useLocalStorageState<Density>(DENSITY_KEY, 'comfortable', isDensity));
		expect(localStorage.getItem(DENSITY_KEY)).toBe(JSON.stringify('comfortable'));
	});

	it('null is a legitimate stored value and is not confused with "absent"', () => {
		// Absent → default. JSON `null` parses to null, which the validator
		// rejects, so it must also land on the default rather than on null.
		localStorage.setItem(DENSITY_KEY, 'null');
		const {result} = renderHook(() => useLocalStorageState<Density>(DENSITY_KEY, 'comfortable', isDensity));
		expect(result.current[0]).toBe('comfortable');
	});

	it('without a validator, a raw non-JSON string is still tolerated', () => {
		// Deliberate: the catch branch is not dead code. Values written by
		// `save_local_storage` (language, for one) are stored raw, so a caller
		// that has no shape to validate keeps the old lenient behaviour.
		localStorage.setItem('some_raw_key', 'ko');
		const {result} = renderHook(() => useLocalStorageState<string>('some_raw_key', 'en'));
		expect(result.current[0]).toBe('ko');
	});
});

//---------------------------------------------------------
// Cross-tab updates travel through the same trust boundary
//---------------------------------------------------------
describe('storage events from another tab', () => {
	it('a valid value from another tab is adopted', () => {
		const {result} = renderHook(() => useLocalStorageState<Density>(DENSITY_KEY, 'comfortable', isDensity));

		act(() => {
			localStorage.setItem(DENSITY_KEY, JSON.stringify('compact'));
			window.dispatchEvent(new StorageEvent('storage', {key: DENSITY_KEY, newValue: JSON.stringify('compact')}));
		});

		expect(result.current[0]).toBe('compact');
	});

	it('RED: a corrupt value from another tab is ignored, and does not reset this tab', () => {
		// Started from a NON-default value on purpose: it separates "ignored"
		// from "fell back to the default". Another tab writing garbage must
		// not discard the preference this operator actually chose.
		localStorage.setItem(DENSITY_KEY, JSON.stringify('compact'));
		const {result} = renderHook(() => useLocalStorageState<Density>(DENSITY_KEY, 'comfortable', isDensity));
		expect(result.current[0]).toBe('compact');

		act(() => {
			window.dispatchEvent(new StorageEvent('storage', {key: DENSITY_KEY, newValue: '{broken'}));
		});

		expect(result.current[0]).toBe('compact');
	});
});
