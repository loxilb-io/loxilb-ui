//---------------------------------------------------------
// Pure decision logic of the restore wizard (docs/SNAPSHOT_UI_DESIGN.md §5.2),
// extracted for unit testing (§9.1): whether a dry-run outcome permits
// continuing to commit, and which result branch a commit outcome renders as.
// Keeping this out of the component makes the honesty rules testable without
// a DOM.
//
// OAM answers 200 whenever the gateway answered, so the gateway's own status
// (`gateway_status`) and body (`gateway_response`) are judged here, together:
// neither is trusted alone.
//---------------------------------------------------------
import {IGatewayRestoreResult, IRestoreOutcomeParsed} from 'types/snapshot';

/**
 * The restore route answers either a restore result or the gateway's error
 * envelope (`{code, message, result}`), whose `result` is a sentence. Only a
 * restore result carries `mode`, so that is what tells them apart — reading
 * `result` first would take an error's sentence for an unknown outcome.
 */
export function asRestoreResult(body: unknown): IGatewayRestoreResult | null {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
	const mode = (body as {mode?: unknown}).mode;
	return mode === 'dry-run' || mode === 'commit' ? (body as IGatewayRestoreResult) : null;
}

const hasErrors = (gw: IGatewayRestoreResult): boolean => (gw.errors?.length ?? 0) > 0;

// 409: another snapshot or restore operation holds the gateway. 503: the
// configuration is frozen (boot replay, maintenance) or the audit trail could
// not record the request. Neither says anything about the snapshot.
const isBusyStatus = (status: number | undefined): boolean => status === 409 || status === 503;

export type TDryRunVerdict = 'pending' | 'oam-error' | 'pass' | 'refused' | 'busy' | 'unreadable';

// Commit is allowed ONLY on `pass`: the gateway answered 200 with a dry-run
// result that says compatible, says ok, carries a plan and no errors. The
// dry-run is the one check before a configuration wipe, so an answer that
// does not positively pass never enables it.
export function classifyDryRun(outcome: IRestoreOutcomeParsed | null, oamError: string | null): TDryRunVerdict {
	if (oamError !== null) return 'oam-error';
	if (outcome === null) return 'pending';
	const gw = asRestoreResult(outcome.gateway_response);
	if (gw === null) {
		if (isBusyStatus(outcome.gateway_status)) return 'busy';
		return outcome.gateway_status === 200 ? 'unreadable' : 'refused';
	}
	if (outcome.gateway_status !== 200 || gw.compatible === false || hasErrors(gw)) return 'refused';
	const passed = gw.mode === 'dry-run' && gw.compatible === true && gw.result === 'ok' && Array.isArray(gw.plan);
	return passed ? 'pass' : 'unreadable';
}

export function canContinueToCommit(outcome: IRestoreOutcomeParsed | null, oamError: string | null, loading: boolean): boolean {
	return !loading && classifyDryRun(outcome, oamError) === 'pass';
}

export type TCommitBranch =
	| 'oam-error'
	| 'ok'
	| 'ok-not-durable'
	| 'ok-durability-unreported'
	| 'rolled-back'
	| 'rollback-failed'
	| 'incomplete'
	| 'unconfirmed';

// The gateway pairs each result with one status: ok → 200, rolled-back and
// ROLLBACK-FAILED → 500, no result (stopped before APPLY) → 400. A pairing it
// does not produce is `unconfirmed`: the instance must be read before anyone
// believes either half. Rendered verbatim — never soft-pedaled.
export function classifyCommitResult(outcome: IRestoreOutcomeParsed | null, oamError: string | null): TCommitBranch {
	if (oamError !== null) return 'oam-error';
	const status = outcome?.gateway_status;
	const gw = asRestoreResult(outcome?.gateway_response);
	// The gateway refused before starting: nothing was changed.
	if (gw === null) return status === 400 || isBusyStatus(status) ? 'incomplete' : 'unconfirmed';
	// The one state that needs manual recovery is never argued away by the
	// status that came with it.
	if (gw.result === 'ROLLBACK-FAILED') return 'rollback-failed';
	if (gw.mode !== 'commit') return 'unconfirmed';
	if (gw.result === 'ok' && status === 200) {
		if (gw.persisted === true) return 'ok';
		return gw.persisted === false ? 'ok-not-durable' : 'ok-durability-unreported';
	}
	if (gw.result === 'rolled-back' && status === 500) return 'rolled-back';
	if (!gw.result && status === 400) return 'incomplete';
	return 'unconfirmed';
}

/** The gateway's own sentence from an error envelope or a bare text body. */
export function gatewayRefusalText(body: unknown): string | undefined {
	if (typeof body === 'string') return body.trim() || undefined;
	if (typeof body !== 'object' || body === null || asRestoreResult(body) !== null) return undefined;
	const {result, message} = body as {result?: unknown; message?: unknown};
	for (const v of [result, message]) if (typeof v === 'string' && v.trim() !== '') return v.trim();
	return undefined;
}
