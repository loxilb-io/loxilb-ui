//---------------------------------------------------------
// Wizard state-machine tests (docs/SNAPSHOT_UI_DESIGN.md §9.1): dry-run
// errors disable Commit; the three commit result branches classify
// distinctly; nothing unexpected ever classifies as success.
//---------------------------------------------------------
import {describe, expect, it} from 'vitest';
import {IRestoreOutcomeParsed} from 'types/snapshot';
import {canContinueToCommit, classifyCommitResult, isDryRunBlocked} from './wizardLogic';

const okDryRun: IRestoreOutcomeParsed = {
	gateway_status: 200,
	gateway_response: {mode: 'dry-run', compatible: true, plan: [{domain: 'loadbalancer', to_delete: 1, to_apply: 3}], errors: []},
};

describe('isDryRunBlocked / canContinueToCommit', () => {
	it('allows commit on a clean dry-run', () => {
		expect(isDryRunBlocked(okDryRun, null)).toBe(false);
		expect(canContinueToCommit(okDryRun, null, false)).toBe(true);
	});

	it('blocks while loading', () => {
		expect(canContinueToCommit(null, null, true)).toBe(false);
		expect(canContinueToCommit(okDryRun, null, true)).toBe(false);
	});

	it('blocks on an OAM-level error (integrity 422, gateway unreachable 502)', () => {
		expect(isDryRunBlocked(null, 'stored snapshot failed integrity verification')).toBe(true);
		expect(canContinueToCommit(null, 'gateway unreachable', false)).toBe(false);
	});

	it('blocks when the gateway rejected the dry-run (HTTP 400)', () => {
		const rejected: IRestoreOutcomeParsed = {gateway_status: 400, gateway_response: {compatible: true, errors: ['validate: unknown field']}};
		expect(isDryRunBlocked(rejected, null)).toBe(true);
	});

	it('blocks on incompatible schema even with gateway 200', () => {
		const incompatible: IRestoreOutcomeParsed = {gateway_status: 200, gateway_response: {compatible: false, errors: []}};
		expect(isDryRunBlocked(incompatible, null)).toBe(true);
	});

	it('blocks when the plan carries errors even with gateway 200', () => {
		const withErrors: IRestoreOutcomeParsed = {gateway_status: 200, gateway_response: {compatible: true, errors: ['endpoint ref missing']}};
		expect(isDryRunBlocked(withErrors, null)).toBe(true);
	});
});

describe('classifyCommitResult (the three §5.2 branches)', () => {
	const outcomeWith = (result?: string): IRestoreOutcomeParsed => ({gateway_status: 200, gateway_response: {result}});

	it('classifies the three gateway results distinctly', () => {
		expect(classifyCommitResult(outcomeWith('ok'), null)).toBe('ok');
		expect(classifyCommitResult(outcomeWith('rolled-back'), null)).toBe('rolled-back');
		expect(classifyCommitResult(outcomeWith('ROLLBACK-FAILED'), null)).toBe('rollback-failed');
	});

	it('an OAM error before the gateway is its own branch', () => {
		expect(classifyCommitResult(null, 'pre-restore safety snapshot failed')).toBe('oam-error');
	});

	it('anything unrecognized is incomplete — NEVER success', () => {
		expect(classifyCommitResult(outcomeWith(''), null)).toBe('incomplete');
		expect(classifyCommitResult(outcomeWith(undefined), null)).toBe('incomplete');
		expect(classifyCommitResult(outcomeWith('OK'), null)).toBe('incomplete'); // case matters — render verbatim, do not guess
		expect(classifyCommitResult(null, null)).toBe('incomplete');
	});
});
