// Neither jsdom 29 (which defers WebStorage to the runtime) nor Node's
// experimental localStorage (undefined without --localstorage-file) provides a
// working global localStorage under vitest. Production code uses bare
// `localStorage`, so back it with a simple in-memory Storage for tests.
function memoryStorage(): Storage {
	let store = new Map<string, string>();
	return {
		get length() {
			return store.size;
		},
		clear: () => {
			store = new Map();
		},
		getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
		setItem: (k: string, v: string) => {
			store.set(k, String(v));
		},
		removeItem: (k: string) => {
			store.delete(k);
		},
		key: (i: number) => Array.from(store.keys())[i] ?? null,
	};
}

for (const target of [globalThis, typeof window !== 'undefined' ? window : undefined]) {
	if (target && !target.localStorage) {
		Object.defineProperty(target, 'localStorage', {value: memoryStorage(), writable: true, configurable: true});
	}
}

// jsdom implements no layout engine and therefore no ResizeObserver, but
// several shared components (ScrollableBox, and anything measuring itself)
// construct one in a mount effect and throw without it. A no-op observer is
// the honest stand-in: with no layout there is nothing to report, and a test
// that needs real measurements belongs in Playwright.
if (typeof globalThis.ResizeObserver === 'undefined') {
	globalThis.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof ResizeObserver;
}
