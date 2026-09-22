//---------------------------------------------------------
// Intercepting the gateway capability surface
//---------------------------------------------------------
// ONE definition on purpose, mirroring the gateway's own reasoning for
// `KvExactSeedPrecondition`: rule admission and the capability surface call
// the same predicate there so a client's readiness answer cannot drift from
// the refusal it would actually receive. The same argument applies to the
// fixtures — a second, private copy of this stub is how a spec file ends up
// silently depending on the testbed's deployment state.
//
// ⚠️⚠️ WHY A MOCK CONTRACT SPEC MUST STUB THIS AT ALL.
// `AIGatewaySettingsForm` asks `GET /status/capabilities` whether the gateway
// can serve KV-exact, and WITHDRAWS the exact topology options when the answer
// is a positive `ready:false`. A spec that mocks the LB endpoints but not this
// one therefore inherits whatever the live testbed happens to be deployed as.
//
// That is not hypothetical: it took out 13 specs on 2026-09-22. The testbed
// gateway used to 404 this endpoint, which reads as `unknown`, and unknown
// still offers the options — so the omission was invisible. Once the gateway
// was upgraded it answered honestly (`ready:false`, KV_EXACT_SEED_UNSET,
// because the deployment has no LLB_KV_NONE_HASH_SEED) and every spec that
// clicks an exact topology began timing out on a control the UI had correctly
// removed.
//
// A mock contract spec exists to pin the option matrix itself. Its subject is
// the form's logic, not the deployment, so it must state which deployment it
// is testing against instead of inheriting one.
import type {Page, Route} from '@playwright/test';

/** The capability name the gateway publishes for vLLM KV-exact admission. */
export const CAP_KV_EXACT_VLLM = 'kv_exact_vllm';

const CAPS_RE = /\/netlox\/v1\/status\/capabilities(\?.*)?$/;

/**
 * The gateway's real refusal sentence, read off the live testbed gateway on
 * 2026-09-22 (`v0.9.8.9-rc.1-738-g144118b5`). Kept verbatim so a spec that
 * asserts on it is asserting what an operator would actually see.
 */
export const KV_EXACT_SEED_SENTENCE =
	'vllm kvExactMode requires non-empty Gateway LLB_KV_NONE_HASH_SEED matching engine PYTHONHASHSEED';

export interface CapsHarness {
	/** How many times the page has asked for capabilities. */
	count: () => number;
}

/** Intercept the capability read. `body` undefined ⇒ an empty 404 envelope. */
export async function mockCapabilities(page: Page, opts: {status?: number; body?: unknown}): Promise<CapsHarness> {
	let calls = 0;
	await page.route(CAPS_RE, (route: Route) => {
		calls += 1;
		return route.fulfill({
			status: opts.status ?? 200,
			contentType: 'application/json',
			body: JSON.stringify(opts.body ?? {message: 'not found'}),
		});
	});
	return {count: () => calls};
}

/** A capability list carrying exactly one entry for `kv_exact_vllm`. */
export function capsBody(entry: Record<string, unknown>) {
	return {capabilities: [entry]};
}

/**
 * State plainly that this spec tests a gateway which CAN serve KV-exact.
 *
 * Use it in any spec that drives the exact topology options. It is the
 * deliberate counterpart to inheriting the testbed's deployment: the spec is
 * about the option matrix, so it fixes readiness rather than discovering it.
 */
export async function mockKvExactReady(page: Page): Promise<CapsHarness> {
	return mockCapabilities(page, {body: capsBody({name: CAP_KV_EXACT_VLLM, ready: true})});
}
