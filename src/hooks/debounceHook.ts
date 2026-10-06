import {useEffect, useState} from 'react';

/**
 * `value`, once it has stopped changing for `delayMs`. The first value is
 * returned at once; only later changes wait.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
	const [settled, setSettled] = useState(value);
	useEffect(() => {
		const id = setTimeout(() => setSettled(value), delayMs);
		return () => clearTimeout(id);
	}, [value, delayMs]);
	return settled;
}
