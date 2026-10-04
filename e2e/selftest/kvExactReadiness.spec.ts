//---------------------------------------------------------
// Self-tests for the KV-exact readiness gate (design doc cases A-01..A-12).
//---------------------------------------------------------
// This gate decides whether the KV-exact specs RUN. Every other spec in the
// suite reports its own failure; this one cannot — a defect here does not turn
// a run red, it turns it green with fewer tests, and the report still says
// "passed". So it gets its own tests, and they are the reason the decision was
// split out of the fetch (e2e/helpers/kvExactVerdict.ts).
//
// No app, no testbed, no auth, no network: both functions under test are pure
// (status, bodyText) -> verdict.
//
// ⭐ A-11 and A-12 are the point of this file. They pin the SAFETY PROPERTY:
// an unrecognised refusal must never silence a spec. Confirm-red-first, both
// verified before this file was committed:
//   - invert the `status === 412` check in kvExactVerdictFromRefusal → A-09 red
//   - widen the fallback to "any non-ok status" → A-11 and A-12 red
//   - drop the `typeof entry.ready !== 'boolean'` guard → A-06 red
import {expect, test} from '@playwright/test';
import {kvExactVerdictFromCapabilities, kvExactVerdictFromRefusal} from '../helpers/kvExactVerdict';

/** A `GET /status/capabilities` body carrying one capability entry. */
function caps(...entries: unknown[]): string {
	return JSON.stringify({capabilities: entries});
}

//---------------------------------------------------------
// A-01..A-08 — the capability read
//---------------------------------------------------------

test('A-01 a ready capability is a ready verdict', () => {
	const v = kvExactVerdictFromCapabilities(200, caps({name: 'kv_exact_vllm', ready: true}));
	expect(v).toEqual({ready: true, reason: 'Gateway reports KV-exact readiness'});
});

test("A-02 a not-ready capability quotes the gateway's own sentence verbatim", () => {
	// The sentence is what an operator reads in the skip reason, so it must
	// survive unedited — paraphrasing it here would turn a contract field back
	// into a guess, which is the thing PR #125 removed.
	const sentence = 'LLB_KV_NONE_HASH_SEED is not set; KV-exact routing cannot be admitted.';
	const v = kvExactVerdictFromCapabilities(200, caps({
		name: 'kv_exact_vllm', ready: false, reason: sentence, reason_code: 'hash_seed_unset',
	}));
	expect(v?.ready).toBe(false);
	expect(v?.reason).toContain(sentence);
});

test('A-03 a not-ready capability with no reason falls back to the reason_code', () => {
	const v = kvExactVerdictFromCapabilities(200, caps({
		name: 'kv_exact_vllm', ready: false, reason_code: 'hash_seed_unset',
	}));
	expect(v?.ready).toBe(false);
	expect(v?.reason).toContain('reason_code=hash_seed_unset');
});

test('A-04 a not-ready capability with neither field still names itself', () => {
	// A skip whose reason is an empty string is indistinguishable from a bug in
	// the gate, so there is always something to read.
	const v = kvExactVerdictFromCapabilities(200, caps({name: 'kv_exact_vllm', ready: false}));
	expect(v?.ready).toBe(false);
	expect(v?.reason).toContain('reason_code=unspecified');
});

test('A-05 a capability list without the entry is not an answer', () => {
	// Not-listed means "this build does not know the capability", which the
	// contract distinguishes from "not ready". Falls through to the probe.
	expect(kvExactVerdictFromCapabilities(200, caps())).toBeNull();
	expect(kvExactVerdictFromCapabilities(200, caps({name: 'some_other_capability', ready: false}))).toBeNull();
});

test('A-06 a malformed `ready` is not a refusal', () => {
	// Garbage must not be read as "not ready" — that would skip the specs on a
	// gateway bug instead of reporting one.
	for (const entry of [
		{name: 'kv_exact_vllm'},
		{name: 'kv_exact_vllm', ready: 'false'},
		{name: 'kv_exact_vllm', ready: 0},
		{name: 'kv_exact_vllm', ready: null},
	]) {
		expect(kvExactVerdictFromCapabilities(200, caps(entry)), JSON.stringify(entry)).toBeNull();
	}
});

test('A-07 a gateway that cannot serve the endpoint is not an answer', () => {
	for (const status of [400, 401, 403, 404, 500, 503]) {
		expect(kvExactVerdictFromCapabilities(status, caps({name: 'kv_exact_vllm', ready: false})), `HTTP ${status}`).toBeNull();
	}
});

test('A-08 an unreadable body is not an answer', () => {
	// Including the JSON scalars: reading `.capabilities` off `null` throws
	// rather than falling through, so the guard is load-bearing.
	for (const body of ['', '<html>404</html>', '{oops', 'null', '[]', '42', '{}', '{"capabilities":"nope"}']) {
		expect(kvExactVerdictFromCapabilities(200, body), JSON.stringify(body)).toBeNull();
	}
});

//---------------------------------------------------------
// A-09..A-12 — the legacy write probe's refusal
//---------------------------------------------------------

test('A-09 a 412 is a precondition refusal on its status alone', () => {
	// ⭐ No string matching: the gateway classified it. Bodies that name nothing
	// relevant — and no body at all — must land on the same verdict, or the
	// structural classification 412 exists to provide is not being used.
	for (const body of ['', 'anything at all', '{"result":"nope"}', '{}']) {
		const v = kvExactVerdictFromRefusal(412, body);
		expect(v.ready, JSON.stringify(body)).toBe(false);
		expect(v.reason).toContain('server precondition');
	}
	expect(kvExactVerdictFromRefusal(412, '{"result":"seed missing"}').reason).toContain('seed missing');
});

test('A-10 a legacy 400 naming the launch precondition is a refusal', () => {
	for (const body of [
		'{"result":"LLB_KV_NONE_HASH_SEED must match the engine PYTHONHASHSEED"}',
		'kv-exact requires PYTHONHASHSEED to be pinned',
		'tokenizer mismatch prevents KV-exact admission',
	]) {
		expect(kvExactVerdictFromRefusal(400, body), body).toMatchObject({ready: false});
	}
});

test('A-11 ⭐ an unrecognised 400 leaves the specs RUNNING', () => {
	// THE SAFETY PROPERTY. A 400 about the payload is a UI defect the KV specs
	// exist to catch. Reading it as "not ready" would skip them and report the
	// run green — the one failure a test suite cannot tell you about.
	for (const body of [
		'{"result":"invalid externalIP"}',
		'{"result":"port already in use"}',
		'',
	]) {
		expect(kvExactVerdictFromRefusal(400, body), body).toMatchObject({ready: true});
	}
});

test('A-12 ⭐ any other refusal status leaves the specs RUNNING', () => {
	// Same property, and the reason names the status so a spec that then fails
	// can be traced back to what the probe actually saw.
	for (const status of [409, 422, 500, 502, 503]) {
		const v = kvExactVerdictFromRefusal(status, '{"result":"LLB_KV_NONE_HASH_SEED"}');
		expect(v.ready, `HTTP ${status}`).toBe(true);
		expect(v.reason).toContain(`HTTP ${status}`);
	}
});
