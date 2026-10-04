// GET /status/capabilities connector.
//
// The endpoint is newer than the gateways this UI supports, so the shape of a
// FAILURE matters as much as the shape of a success: a 404 is a fact about the
// build ("no capability surface here") and must reach the caller as data,
// while anything else is a real failure that must not be laundered into
// "unknown" — a gateway we cannot reach is not a gateway that answered.
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {IInstance} from 'types/oam';
import {CAP_KV_EXACT_VLLM, capabilityVerdict} from 'types/capability_status';
import {ApiError} from '../fetcher/fetcher_base';
import {GET_INST} from '../fetcher/fetcher_inst';
import {query_get_capability_status} from './status';

vi.mock('../fetcher/fetcher_inst', () => ({
	GET_INST: vi.fn(),
	POST_INST: vi.fn(),
}));

const instance = {id: 3, name: 'gateway'} as IInstance;
const get = vi.mocked(GET_INST);

// ⚠️ BRACES ARE LOAD-BEARING. `beforeEach(() => get.mockReset())` returns the
// mock (mockReset returns it for chaining), and Vitest treats a function
// returned from a hook as that hook's TEARDOWN — so it calls GET_INST itself
// after every test. Harmless while the mock resolves; once a test installs a
// rejecting implementation, the teardown call creates a rejected promise nobody
// awaits, and the run fails with that error attributed to the test whose body
// passed. Cost an hour: the symptom is "→ boom" on an assertion that is correct.
beforeEach(() => {
	get.mockReset();
});

describe('capability status read connector', () => {
	it('reads /status/capabilities and unwraps the array', async () => {
		const entry = {name: CAP_KV_EXACT_VLLM, ready: false, reason_code: 'KV_EXACT_SEED_UNSET', reason: 'seed missing'};
		get.mockResolvedValue({code: 200, data: {capabilities: [entry]}, message: 'OK'});

		expect(await query_get_capability_status(instance)).toEqual([entry]);
		expect(get).toHaveBeenCalledWith(instance, '/status/capabilities');
	});

	// "An empty array means this build gates no capability on its environment."
	// Distinct from 404, and it must not collapse into it: the build HAS the
	// surface and reported nothing gated.
	it('passes an empty list through as an empty list', async () => {
		get.mockResolvedValue({code: 200, data: {capabilities: []}, message: 'OK'});
		expect(await query_get_capability_status(instance)).toEqual([]);
	});

	it('defaults a truncated body to an empty list rather than throwing', async () => {
		get.mockResolvedValue({code: 200, data: {}, message: 'OK'});
		expect(await query_get_capability_status(instance)).toEqual([]);
	});

	// ⭐⭐ The compatibility contract. An older gateway has no such route; that
	// is a build fact of the same kind as an empty list, not an error state for
	// every form that consults readiness.
	it('answers 404 with null — an older gateway has no capability surface', async () => {
		get.mockResolvedValue({code: 404, data: {message: 'not found'}, message: 'Not Found'});
		expect(await query_get_capability_status(instance)).toBeNull();
		// And the verdict layer turns that into `unknown`, which offers the
		// control — the pre-endpoint behaviour, unchanged.
		expect(capabilityVerdict(null, CAP_KV_EXACT_VLLM)).toEqual({kind: 'unknown', why: 'endpoint-absent'});
	});

	// ⚠️ Everything else throws. Swallowing a 401/403/503 here would report
	// "unknown" for a gateway that is merely unreachable or a session that has
	// expired, hiding a problem the page needs to show.
	it.each([401, 403, 500, 503])('re-throws HTTP %i instead of reporting unknown', async code => {
		get.mockResolvedValue({code, data: {message: 'nope'}, message: 'err'});
		await expect(query_get_capability_status(instance)).rejects.toMatchObject({status: code});
	});

	it('re-throws a transport failure untouched', async () => {
		get.mockRejectedValue(new ApiError('boom', 0));
		await expect(query_get_capability_status(instance)).rejects.toMatchObject({status: 0, message: 'boom'});
	});
});
