//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {useEffect, useState} from 'react';

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

export default function useLocalStorageState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
	const [state, setState] = useState<T>(() => {
		const storedValue = localStorage.getItem(key);
		if (storedValue === null) return defaultValue;

		try {
			return JSON.parse(storedValue) as T;
		} catch {
			return storedValue as unknown as T;
		}
	});

	useEffect(() => {
		localStorage.setItem(key, JSON.stringify(state));
		eventBus.emit(`localStorage:${key}`, state);
	}, [key, state]);

	useEffect(() => {
		const handleStorageChange = (e: StorageEvent) => {
			if (e.key === key && e.newValue !== null) {
				try {
					const newValue = JSON.parse(e.newValue) as T;
					setState(newValue);
				} catch {
					setState(e.newValue as unknown as T);
				}
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
