//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useEffect, useRef, useState} from 'react';

//---------------------------------------------------------
// Hook
//---------------------------------------------------------
const eventBus = {
	listeners: new Map<string, Set<(value: any) => void>>(),

	subscribe(key: string, callback: (value: any) => void) {
		if (!this.listeners.has(key)) {
			this.listeners.set(key, new Set());
		}
		this.listeners.get(key)?.add(callback);

		return () => {
			this.listeners.get(key)?.delete(callback);
		};
	},

	emit(key: string, value: any) {
		this.listeners.get(key)?.forEach(callback => callback(value));
	},
};

/**
 * Turns a stored string into a trusted value, or falls back to the default.
 *
 * A stored preference is operator-writable input. It survives upgrades, it can
 * be hand-edited, and an older build may have written a different shape — so
 * it gets validated like any other input rather than trusted because it came
 * from our own origin. The previous behaviour was to adopt whatever was there:
 * on a parse error the raw string became the state, which left the component
 * holding a value outside its declared type (a density of '{broken') without
 * throwing anything that would say so.
 *
 * The lenient path is kept where it is actually load-bearing: a caller with no
 * validator and a string default still accepts a raw non-JSON value, because
 * `save_local_storage` writes some keys (language) unquoted. A caller that
 * passes a validator gets no such benefit of the doubt.
 */
const UNTRUSTED = Symbol('untrusted stored value');

function coerceStored<T>(raw: string, defaultValue: T, isValid?: (value: unknown) => value is T): T | typeof UNTRUSTED {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		// Not JSON. Only a string-typed preference can legitimately be stored
		// raw; for anything else this is corruption, not a format.
		if (!isValid) return typeof defaultValue === 'string' ? (raw as unknown as T) : UNTRUSTED;
		return isValid(raw) ? raw : UNTRUSTED;
	}

	if (!isValid) return parsed as T;
	return isValid(parsed) ? parsed : UNTRUSTED;
}

function readStored<T>(key: string, defaultValue: T, isValid?: (value: unknown) => value is T): T {
	const storedValue = localStorage.getItem(key);
	if (storedValue === null) return defaultValue;

	const value = coerceStored(storedValue, defaultValue, isValid);
	return value === UNTRUSTED ? defaultValue : value;
}

export default function useLocalStorageState<T>(
	key: string,
	defaultValue: T,
	isValid?: (value: unknown) => value is T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
	const [state, setState] = useState<T>(() => readStored(key, defaultValue, isValid));

	useEffect(() => {
		localStorage.setItem(key, JSON.stringify(state));
		eventBus.emit(`localStorage:${key}`, state);
	}, [key, state]);

	// Read through refs so the subscription below does not have to list the
	// default and the validator as dependencies: a caller passing an inline
	// arrow validator would otherwise re-subscribe on every render.
	const defaultRef = useRef(defaultValue);
	const isValidRef = useRef(isValid);
	defaultRef.current = defaultValue;
	isValidRef.current = isValid;

	useEffect(() => {
		const handleStorageChange = (e: StorageEvent) => {
			if (e.key === key && e.newValue !== null) {
				const value = coerceStored(e.newValue, defaultRef.current, isValidRef.current);
				// Another tab writing something we cannot trust must not reset
				// this tab: the value here is already valid, so ignoring the
				// event preserves it, where falling back to the default would
				// silently discard the operator's actual preference.
				if (value !== UNTRUSTED) setState(value);
			}
		};

		const unsubscribe = eventBus.subscribe(`localStorage:${key}`, (value: T) => {
			if (JSON.stringify(value) !== JSON.stringify(state)) {
				setState(value);
			}
		});

		window.addEventListener('storage', handleStorageChange);
		return () => {
			window.removeEventListener('storage', handleStorageChange);
			unsubscribe();
		};
	}, [key, state]);

	return [state, setState];
}
