//---------------------------------------------------------
// Pure decision logic of the restore wizard (docs/SNAPSHOT_UI_DESIGN.md §5.2),
// extracted for unit testing (§9.1): whether a dry-run outcome permits
// continuing to commit, and which of the three §5.2 result branches a commit
// outcome renders as. Keeping this out of the component makes the honesty
// rules testable without a DOM.
//---------------------------------------------------------
import {IRestoreOutcomeParsed} from 'types/snapshot';

// Commit is allowed ONLY when the dry-run reached the gateway (OAM 200),
// the gateway accepted it (HTTP 200), the document is compatible, and the
// plan produced zero errors. Anything else blocks Step 2.
export function isDryRunBlocked(outcome: IRestoreOutcomeParsed | null, oamError: string | null): boolean {
	if (oamError !== null) return true;
	if (outcome === null) return false; // still loading — not blocked, just not ready
	const gw = outcome.gateway_response;
	return outcome.gateway_status !== 200 || gw?.compatible === false || (gw?.errors?.length ?? 0) > 0;
}

export function canContinueToCommit(outcome: IRestoreOutcomeParsed | null, oamError: string | null, loading: boolean): boolean {
	return !loading && outcome !== null && !isDryRunBlocked(outcome, oamError);
}

export type TCommitBranch = 'oam-error' | 'ok' | 'rolled-back' | 'rollback-failed' | 'incomplete';

// The three result branches (+ the pre-gateway failure and the
// stopped-before-APPLY case). Rendered verbatim — never soft-pedaled.
export function classifyCommitResult(outcome: IRestoreOutcomeParsed | null, oamError: string | null): TCommitBranch {
	if (oamError !== null) return 'oam-error';
	const result = outcome?.gateway_response?.result ?? '';
	if (result === 'ok') return 'ok';
	if (result === 'rolled-back') return 'rolled-back';
	if (result === 'ROLLBACK-FAILED') return 'rollback-failed';
	return 'incomplete';
}
