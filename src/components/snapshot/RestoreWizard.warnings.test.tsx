//---------------------------------------------------------
// The gateway's warnings must reach the operator
//---------------------------------------------------------
// `snapshots.spec.ts` states the first honesty invariant of this feature:
// "the page never reports success the server didn't return". The restore
// result carries `warnings[]` — populated by the gateway for inbound secrets
// it had to re-encrypt, for OPTIONAL recovery dependencies it does not
// verify, and for items APPLY skipped as already-existing duplicates — and
// the UI modelled none of it. A qualified success rendered as an
// unqualified one.
//
// Dry-run matters as much as commit: dependency verification deliberately
// runs there, so these are the operator's only warning BEFORE committing.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {CommitResult} from './RestoreWizard';
import {IRestoreOutcomeParsed} from 'types/snapshot';

afterEach(() => {
	cleanup();
});

const SECRET_WARN = 'inbound secrets re-encrypted under this node secret';
const DEP_WARN = 'optional dependency kv-model-profile not verified';

// The gateway pairs each result with one status (ok → 200, rolled-back → 500,
// none → 400); a success is also `persisted`.
function outcomeOf(gw: Partial<IRestoreOutcomeParsed['gateway_response']>): IRestoreOutcomeParsed {
	const gateway_status = gw?.result === 'ok' ? 200 : gw?.result ? 500 : 400;
	const persisted = gw?.result === 'ok' ? {persisted: true} : {};
	return {gateway_status, gateway_response: {mode: 'commit', compatible: true, plan: [], errors: null, ...persisted, ...gw}} as IRestoreOutcomeParsed;
}

describe('a successful restore that the gateway qualified', () => {
	it('shows the warnings instead of an unqualified success', () => {
		render(
			<CommitResult
				outcome={outcomeOf({result: 'ok', warnings: [SECRET_WARN, DEP_WARN]})}
				oamError={null}
				instanceName="gw-1"
			/>,
		);
		// Both sentences, verbatim — the gateway's words, not a count.
		expect(screen.getByText(SECRET_WARN)).toBeTruthy();
		expect(screen.getByText(DEP_WARN)).toBeTruthy();
	});

	it('says so in the headline, so the caveat is not buried below the fold', () => {
		render(<CommitResult outcome={outcomeOf({result: 'ok', warnings: [SECRET_WARN]})} oamError={null} instanceName="gw-1" />);
		expect(screen.getByText(/succeeded with warnings/i)).toBeTruthy();
	});

	it('still reads as a clean success when the gateway sent none', () => {
		// The counterpart that stops "always warn" from being the fix.
		render(<CommitResult outcome={outcomeOf({result: 'ok', warnings: []})} oamError={null} instanceName="gw-1" />);
		expect(screen.getByText('Restore succeeded')).toBeTruthy();
		expect(screen.queryByText(/succeeded with warnings/i)).toBeNull();
	});
});

describe('warnings on the failure branches', () => {
	it('survives a rollback — the reason it rolled back is not the only thing worth reading', () => {
		render(
			<CommitResult
				outcome={outcomeOf({result: 'rolled-back', errors: ['apply failed'], warnings: [DEP_WARN]})}
				oamError={null}
				instanceName="gw-1"
			/>,
		);
		expect(screen.getByText('apply failed')).toBeTruthy();
		expect(screen.getByText(DEP_WARN)).toBeTruthy();
	});

	it('survives a restore that stopped before APPLY, where the gateway may have said nothing else', () => {
		render(<CommitResult outcome={outcomeOf({result: '', warnings: [SECRET_WARN]})} oamError={null} instanceName="gw-1" />);
		expect(screen.getByText(SECRET_WARN)).toBeTruthy();
	});

	it('survives an answer that cannot be confirmed', () => {
		const o = {...outcomeOf({result: 'ok', warnings: [SECRET_WARN]}), gateway_status: 500};
		render(<CommitResult outcome={o} oamError={null} instanceName="gw-1" />);
		expect(screen.getByText(SECRET_WARN)).toBeTruthy();
	});
});
