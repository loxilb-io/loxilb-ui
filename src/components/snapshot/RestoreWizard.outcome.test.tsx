//---------------------------------------------------------
// What the wizard says about a dry-run and a commit
//---------------------------------------------------------
// A restore wipes the live configuration, so each panel has to say exactly
// what the gateway said and no more:
//   - a commit that applied but was not written to the boot configuration is
//     not "succeeded" — a restart undoes it, and the gateway's reason is in
//     `errors`, which the success panel used to leave out;
//   - an answer that contradicts itself is not a success and not "nothing
//     changed";
//   - a gateway that is busy has said nothing about the snapshot.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {CommitResult, DryRunResult} from './RestoreWizard';
import {IRestoreOutcomeParsed} from 'types/snapshot';

afterEach(() => {
	cleanup();
});

const PLAN = [{domain: 'loadbalancer', to_delete: 1, to_apply: 3}];
const PERSIST_FAILED = 'warning: write-through persist failed (restore applied but will not survive restart): disk full';
const BUSY = {code: 409, message: 'Resource conflict', result: 'another snapshot or restore operation is in progress'};

const outcome = (gateway_status: number, gateway_response: unknown, extra: Partial<IRestoreOutcomeParsed> = {}): IRestoreOutcomeParsed =>
	({gateway_status, gateway_response, ...extra}) as IRestoreOutcomeParsed;
const committed = (gateway_status: number, gw: Record<string, unknown>) =>
	outcome(gateway_status, {mode: 'commit', compatible: true, plan: PLAN, errors: null, ...gw});

const commit = (o: IRestoreOutcomeParsed) => render(<CommitResult outcome={o} oamError={null} instanceName="gw-1" />);

describe('a commit that applied', () => {
	it('is a success when the gateway also wrote it to the boot configuration', () => {
		commit(committed(200, {result: 'ok', persisted: true}));
		expect(screen.getByText('Restore succeeded')).toBeTruthy();
	});

	it('is not called a success when the gateway could not write it for restart', () => {
		commit(committed(200, {result: 'ok', persisted: false, errors: [PERSIST_FAILED]}));
		expect(screen.queryByText(/Restore succeeded/)).toBeNull();
		expect(screen.getByText('Restore applied, but not saved for restart')).toBeTruthy();
		// The gateway's reason, verbatim.
		expect(screen.getByText(PERSIST_FAILED)).toBeTruthy();
		expect(screen.getByRole('alert').className).toContain('MuiAlert-colorWarning');
	});

	it('does not claim durability a gateway never reported', () => {
		commit(committed(200, {result: 'ok'}));
		expect(screen.queryByText(/Restore succeeded/)).toBeNull();
		expect(screen.getByText('Restore applied; the gateway did not say whether it was saved for restart')).toBeTruthy();
	});

	it('never hides errors that came with a success', () => {
		commit(committed(200, {result: 'ok', persisted: true, errors: ['something the gateway wanted read']}));
		expect(screen.getByText('something the gateway wanted read')).toBeTruthy();
	});
});

describe('a commit answer that cannot be believed', () => {
	it('is unconfirmed when the status and the result disagree', () => {
		commit(committed(500, {result: 'ok', persisted: true}));
		expect(screen.queryByText(/Restore succeeded/)).toBeNull();
		expect(screen.getByText('Restore outcome unconfirmed (gateway HTTP 500)')).toBeTruthy();
		expect(screen.getByText(/Read the configuration of gw-1 before doing anything else/)).toBeTruthy();
	});

	it('shows the body it could not classify', () => {
		commit(outcome(500, {code: 500, message: 'Internal service error', result: 'restore engine: boom'}));
		expect(screen.getByText(/Restore outcome unconfirmed/)).toBeTruthy();
		expect(screen.getByText(/restore engine: boom/)).toBeTruthy();
	});
});

describe('a commit the gateway did not start', () => {
	it('says so with the gateway sentence and how long to wait', () => {
		commit(outcome(409, BUSY, {gateway_retry_after: '5'}));
		expect(screen.getByText('Restore did not complete (gateway HTTP 409)')).toBeTruthy();
		expect(screen.getByText(/another snapshot or restore operation is in progress/)).toBeTruthy();
		expect(screen.getByText('Try again in 5 s.')).toBeTruthy();
	});

	it('names no wait the gateway did not give', () => {
		commit(outcome(409, BUSY));
		expect(screen.queryByText(/Try again in/)).toBeNull();
	});
});

describe('the dry-run panel', () => {
	const dryRun = (o: IRestoreOutcomeParsed) => render(<DryRunResult outcome={o} />);
	const passed = {mode: 'dry-run', compatible: true, schema_version: '1.8', plan: PLAN, errors: null, result: 'ok'};

	it('passes a dry-run the gateway passed', () => {
		dryRun(outcome(200, passed));
		expect(screen.getByText('Dry-run passed — the snapshot is applicable')).toBeTruthy();
		expect(screen.getByText('loadbalancer')).toBeTruthy();
	});

	it('refuses with the gateway errors', () => {
		dryRun(outcome(400, {mode: 'dry-run', compatible: true, plan: null, errors: ['validate: unknown field']}));
		expect(screen.getByText('This snapshot cannot be restored')).toBeTruthy();
		expect(screen.getByText('validate: unknown field')).toBeTruthy();
	});

	it('does not blame the snapshot while the gateway is busy', () => {
		dryRun(outcome(409, BUSY, {gateway_retry_after: '5'}));
		expect(screen.queryByText('This snapshot cannot be restored')).toBeNull();
		expect(screen.getByText('The gateway cannot run a restore right now (HTTP 409)')).toBeTruthy();
		expect(screen.getByText(/another snapshot or restore operation is in progress/)).toBeTruthy();
		expect(screen.getByText('Try again in 5 s.')).toBeTruthy();
		// An error envelope has no schema and no compatibility to report.
		expect(screen.queryByText(/compatible/)).toBeNull();
	});

	it('says it could not read an answer that neither passed nor refused', () => {
		dryRun(outcome(200, {}));
		expect(screen.queryByText(/Dry-run passed/)).toBeNull();
		expect(screen.getByText('The dry-run answer could not be read')).toBeTruthy();
		expect(screen.queryByText(/compatible/)).toBeNull();
	});
});

describe('a commit that produced no outcome object', () => {
	const UNKNOWN_TEXT = 'No answer came back, so it is not known whether this change was applied.';

	it('is "failed before reaching the gateway" when the backend answered and refused', () => {
		render(<CommitResult outcome={null} oamError="snapshot integrity check failed" instanceName="gw-1" />);
		expect(screen.getByText('Restore failed before reaching the gateway')).toBeTruthy();
		expect(screen.queryByText('Restore outcome unknown')).toBeNull();
	});

	// A commit that timed out or lost its connection may have restored. Saying
	// it failed before the gateway invites a second restore on top of the first.
	it('is "outcome unknown" when no answer came back, and never says it failed', () => {
		render(<CommitResult outcome={null} oamError={UNKNOWN_TEXT} outcomeUnknown instanceName="gw-1" />);
		expect(screen.getByText('Restore outcome unknown')).toBeTruthy();
		expect(screen.getByText(UNKNOWN_TEXT)).toBeTruthy();
		expect(screen.queryByText(/Restore failed/)).toBeNull();
		expect(screen.queryByText(/Restore succeeded/)).toBeNull();
	});

	it('an outcome object is never overridden by the flag', () => {
		render(<CommitResult outcome={committed(200, {result: 'ok', persisted: true})} oamError={null} outcomeUnknown instanceName="gw-1" />);
		expect(screen.getByText('Restore succeeded')).toBeTruthy();
		expect(screen.queryByText('Restore outcome unknown')).toBeNull();
	});
});
