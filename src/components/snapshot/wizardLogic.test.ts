//---------------------------------------------------------
// Wizard state-machine tests (docs/SNAPSHOT_UI_DESIGN.md §9.1): only a dry-run
// the gateway positively passed enables Commit; each commit outcome classifies
// distinctly; nothing unexpected ever classifies as success.
//
// Fixtures are the bodies the gateway serialises (see types/snapshot.ts):
// `plan` and `errors` are `null` when empty, a failed dry-run is HTTP 400 with
// no `result`, and a rolled-back commit is HTTP 500.
//---------------------------------------------------------
import {describe, expect, it} from 'vitest';
import {IRestoreOutcomeParsed} from 'types/snapshot';
import {asRestoreResult, canContinueToCommit, classifyCommitResult, classifyDryRun} from './wizardLogic';

const outcome = (gateway_status: number, gateway_response: unknown, extra: Partial<IRestoreOutcomeParsed> = {}): IRestoreOutcomeParsed =>
	({gateway_status, gateway_response, ...extra}) as IRestoreOutcomeParsed;

const PLAN = [{domain: 'loadbalancer', to_delete: 1, to_apply: 3}];
const passed = {mode: 'dry-run', compatible: true, schema_version: '1.8', plan: PLAN, errors: null, result: 'ok'};
const okDryRun = outcome(200, passed);

// The gateway's Error envelope, served by the same route. Its `result` is a
// sentence, not a restore result.
const BUSY = {code: 409, message: 'Resource conflict', result: 'another snapshot or restore operation is in progress'};
const FROZEN = {code: 503, message: 'Maintenance mode', result: 'configuration writes are rejected until the boot config replay settles'};

describe('asRestoreResult', () => {
	it('recognises a restore result by its mode', () => {
		expect(asRestoreResult(passed)).toBe(passed);
		expect(asRestoreResult({mode: 'commit', result: 'ok'})).not.toBeNull();
	});

	it('does not read an error envelope, a string, or nothing as a result', () => {
		for (const body of [BUSY, FROZEN, {}, 'upstream said no', null, undefined, [], {mode: 'boot'}]) expect(asRestoreResult(body)).toBeNull();
	});
});

describe('classifyDryRun / canContinueToCommit', () => {
	it('allows commit on a dry-run the gateway passed', () => {
		expect(classifyDryRun(okDryRun, null)).toBe('pass');
		expect(canContinueToCommit(okDryRun, null, false)).toBe(true);
	});

	it('blocks while loading', () => {
		expect(classifyDryRun(null, null)).toBe('pending');
		expect(canContinueToCommit(null, null, true)).toBe(false);
		expect(canContinueToCommit(okDryRun, null, true)).toBe(false);
	});

	it('blocks on an OAM-level error (integrity 422, gateway unreachable 502)', () => {
		expect(classifyDryRun(null, 'stored snapshot failed integrity verification')).toBe('oam-error');
		expect(canContinueToCommit(null, 'gateway unreachable', false)).toBe(false);
	});

	it('is refused when the gateway rejected the document (HTTP 400, no result)', () => {
		const rejected = outcome(400, {mode: 'dry-run', compatible: true, plan: null, errors: ['validate: unknown field']});
		expect(classifyDryRun(rejected, null)).toBe('refused');
		expect(canContinueToCommit(rejected, null, false)).toBe(false);
	});

	it('is refused on an incompatible schema', () => {
		expect(classifyDryRun(outcome(400, {mode: 'dry-run', compatible: false, plan: null, errors: ['schema 9.9 is newer']}), null)).toBe('refused');
		// Stated incompatibility blocks whatever status came with it.
		expect(classifyDryRun(outcome(200, {...passed, compatible: false}), null)).toBe('refused');
	});

	it('is refused when errors come with an otherwise passing answer', () => {
		expect(classifyDryRun(outcome(200, {...passed, errors: ['endpoint ref missing']}), null)).toBe('refused');
	});

	it('is busy, not refused, while the gateway cannot run a restore', () => {
		expect(classifyDryRun(outcome(409, BUSY), null)).toBe('busy');
		expect(classifyDryRun(outcome(503, FROZEN, {gateway_retry_after: '5'}), null)).toBe('busy');
		expect(canContinueToCommit(outcome(409, BUSY), null, false)).toBe(false);
	});

	// Shapes the gateway does not send. They are here because the dry-run is
	// the only check before a configuration wipe: an answer that does not
	// positively say "passed" must not enable Commit, whatever produced it.
	it.each([
		['an empty object', {}],
		['no compatible flag', {...passed, compatible: undefined}],
		['no result', {...passed, result: undefined}],
		['a result other than ok', {...passed, result: 'OK'}],
		['no plan', {...passed, plan: undefined}],
		['a null plan', {...passed, plan: null}],
		['a commit answer to a dry-run', {...passed, mode: 'commit'}],
		['an error envelope', BUSY],
		['a non-JSON body', 'ok'],
	])('does not continue on HTTP 200 with %s', (_name, body) => {
		const o = outcome(200, body);
		expect(classifyDryRun(o, null)).toBe('unreadable');
		expect(canContinueToCommit(o, null, false)).toBe(false);
	});
});

describe('classifyCommitResult', () => {
	const committed = (gateway_status: number, gw: Record<string, unknown>) => outcome(gateway_status, {mode: 'commit', compatible: true, plan: PLAN, errors: null, ...gw});

	it('is a success only when applied and written to the boot configuration', () => {
		expect(classifyCommitResult(committed(200, {result: 'ok', persisted: true}), null)).toBe('ok');
	});

	it('applied but not written for restart is its own outcome, not a success', () => {
		const notDurable = committed(200, {
			result: 'ok',
			persisted: false,
			errors: ['warning: write-through persist failed (restore applied but will not survive restart): disk full'],
		});
		expect(classifyCommitResult(notDurable, null)).toBe('ok-not-durable');
	});

	it('applied with no word on durability does not claim it', () => {
		// A gateway older than the `persisted` flag.
		expect(classifyCommitResult(committed(200, {result: 'ok'}), null)).toBe('ok-durability-unreported');
	});

	it('classifies a rollback and a failed rollback distinctly', () => {
		expect(classifyCommitResult(committed(500, {result: 'rolled-back', errors: ['apply: lb']}), null)).toBe('rolled-back');
		expect(classifyCommitResult(committed(500, {result: 'ROLLBACK-FAILED', errors: ['apply: lb']}), null)).toBe('rollback-failed');
	});

	it('never downgrades a failed rollback, whatever status carries it', () => {
		expect(classifyCommitResult(committed(200, {result: 'ROLLBACK-FAILED'}), null)).toBe('rollback-failed');
	});

	it('an OAM error before the gateway is its own branch', () => {
		expect(classifyCommitResult(null, 'pre-restore safety snapshot failed')).toBe('oam-error');
	});

	it('stopped before APPLY is incomplete: nothing was changed', () => {
		expect(classifyCommitResult(committed(400, {plan: null, errors: ['validate: unknown field']}), null)).toBe('incomplete');
		expect(classifyCommitResult(outcome(409, BUSY), null)).toBe('incomplete');
		expect(classifyCommitResult(outcome(503, FROZEN), null)).toBe('incomplete');
	});

	it('an answer that contradicts itself is unconfirmed — NEVER success, and never "nothing changed"', () => {
		expect(classifyCommitResult(committed(500, {result: 'ok', persisted: true}), null)).toBe('unconfirmed');
		expect(classifyCommitResult(committed(200, {result: 'rolled-back'}), null)).toBe('unconfirmed');
		expect(classifyCommitResult(committed(200, {}), null)).toBe('unconfirmed');
		expect(classifyCommitResult(committed(200, {result: ''}), null)).toBe('unconfirmed');
		expect(classifyCommitResult(committed(200, {result: 'OK', persisted: true}), null)).toBe('unconfirmed'); // case matters — do not guess
		expect(classifyCommitResult(outcome(200, {...passed, persisted: true}), null)).toBe('unconfirmed'); // a dry-run answer to a commit
		expect(classifyCommitResult(outcome(200, {}), null)).toBe('unconfirmed');
		expect(classifyCommitResult(outcome(500, {code: 500, message: 'Internal service error', result: 'restore engine: boom'}), null)).toBe('unconfirmed');
		expect(classifyCommitResult(null, null)).toBe('unconfirmed');
	});
});
