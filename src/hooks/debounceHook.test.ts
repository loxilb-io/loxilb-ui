import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useDebouncedValue} from './debounceHook';

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('useDebouncedValue', () => {
	it('returns the first value at once', () => {
		const {result} = renderHook(() => useDebouncedValue('a', 600));
		expect(result.current).toBe('a');
	});

	it('holds a change until the value has rested for the whole delay', () => {
		const {result, rerender} = renderHook(({v}) => useDebouncedValue(v, 600), {initialProps: {v: 'a'}});
		rerender({v: 'b'});
		advance(599);
		expect(result.current).toBe('a');
		advance(1);
		expect(result.current).toBe('b');
	});

	it('restarts the wait on every change and skips the values in between', () => {
		const seen: string[] = [];
		const {result, rerender} = renderHook(
			({v}) => {
				const settled = useDebouncedValue(v, 600);
				if (seen[seen.length - 1] !== settled) seen.push(settled);
				return settled;
			},
			{initialProps: {v: 'a'}},
		);
		for (const v of ['b', 'c', 'd']) {
			rerender({v});
			advance(599);
		}
		expect(result.current).toBe('a');
		advance(1);
		expect(seen).toEqual(['a', 'd']);
	});

	it('leaves no timer behind after unmount', () => {
		const {rerender, unmount} = renderHook(({v}) => useDebouncedValue(v, 600), {initialProps: {v: 'a'}});
		rerender({v: 'b'});
		unmount();
		expect(vi.getTimerCount()).toBe(0);
	});
});
