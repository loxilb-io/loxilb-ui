//---------------------------------------------------------
// The setup gate blocks the entire app until it resolves
// (components/setup/SetupHandler.tsx), so its failure modes are the app's
// failure modes. These cover the one that actually bit: a request that never
// answers — which used to hang the gate forever and render a blank page,
// because the fail-open handlers could not run on a promise that never
// settles.
//---------------------------------------------------------
import {afterEach, describe, expect, it, vi} from 'vitest';
import {SETUP_CHECK_TIMEOUT_MS, with_timeout} from './simpleSetup';

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('with_timeout', () => {
	it('passes a value through when it resolves in time', async () => {
		await expect(with_timeout(Promise.resolve('ok'), 50)).resolves.toBe('ok');
	});

	it('propagates a rejection unchanged (a real error must stay a real error)', async () => {
		await expect(with_timeout(Promise.reject(new Error('boom')), 50)).rejects.toThrow('boom');
	});

	it('rejects a promise that never settles instead of hanging forever', async () => {
		const never = new Promise(() => {}); // the hung-backend case
		await expect(with_timeout(never, 20)).rejects.toThrow(/exceeded 20ms/);
	});

	it('names the timeout so a caller can tell it apart from a transport error', async () => {
		await expect(with_timeout(new Promise(() => {}), 10)).rejects.toMatchObject({name: 'SetupCheckTimeout'});
	});

	it('does not leave a pending timer behind on the success path', async () => {
		vi.useFakeTimers();
		const settled = with_timeout(Promise.resolve('ok'), 10_000);
		await expect(settled).resolves.toBe('ok');
		// A leaked timer would keep the process (and jsdom) alive past the test.
		expect(vi.getTimerCount()).toBe(0);
	});

	it('defaults to the documented bound', () => {
		expect(SETUP_CHECK_TIMEOUT_MS).toBe(4000);
	});
});

describe('checkNeedsCredentialUpdate', () => {
	// The module reads its dependency at call time, so mock the connector.
	async function load(status_impl: () => Promise<any>) {
		vi.resetModules();
		vi.doMock('connector/oam/oam', () => ({query_setup_status: status_impl}));
		return await import('./simpleSetup');
	}

	it('reports true only when the backend says so', async () => {
		const mod = await load(async () => ({needsCredentialUpdate: true}));
		await expect(mod.checkNeedsCredentialUpdate()).resolves.toBe(true);
	});

	it('fails OPEN when the backend errors — never block login on a backend fault', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const mod = await load(async () => {
			throw new Error('network down');
		});
		await expect(mod.checkNeedsCredentialUpdate()).resolves.toBe(false);
	});

	it('fails OPEN when the backend hangs (the blank-page regression)', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const mod = await load(() => new Promise(() => {}));
		// Must settle on its own; if this ever hangs again the test times out
		// rather than passing silently.
		await expect(mod.checkNeedsCredentialUpdate()).resolves.toBe(false);
	}, 10_000);
});
