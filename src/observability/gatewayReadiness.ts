//---------------------------------------------------------
// Gateway readiness headline — "not ready" and "in maintenance", or nothing
//---------------------------------------------------------
// Input is the `ready` / `ready_reasons` / `maintenance_state` triple of
// GET /diagnostics. A ready gateway in normal operation adds nothing: this
// is a headline for the two states an operator has to act on, not a status
// row.
//
// Gateway semantics (api/restapi/handler/diagnostics.go,
// pkg/snapshot/opstate.go, pkg/maintenance/maintenance.go):
//   - `ready` is always sent, false included, and is `len(ready_reasons) == 0`.
//     So an ABSENT `ready` is a gateway that predates the field, and says
//     nothing — it is never read as "not ready".
//   - `ready_reasons` is the gateway's own prose: boot replay not settled,
//     auto-persist failing, a failed boot restore, one line per failed
//     required dependency. It is shown as written and never parsed; the
//     wording belongs to the gateway and may change.
//   - `maintenance_state` is "active" in normal operation. "maintenance" is
//     entered and left only by an operator, and while it holds the gateway
//     refuses every mutating configuration call.

/** The fields this headline reads; all optional because an older gateway omits them. */
export interface IReadinessFields {
	ready?: boolean;
	ready_reasons?: string[];
	maintenance_state?: string;
}

export interface GatewayReadiness {
	/** Present only when the gateway said `ready: false`. `reasons` may be empty. */
	notReady?: {reasons: string[]; more: number};
	maintenance: boolean;
}

/** Reasons shown before the rest is folded into a count. */
export const MAX_READY_REASONS = 3;

/** `undefined` is an unread or failed diagnostics read: nothing is known, so nothing is claimed. */
export function gatewayReadiness(diag: IReadinessFields | undefined): GatewayReadiness {
	if (!diag) return {maintenance: false};
	const readiness: GatewayReadiness = {maintenance: diag.maintenance_state === 'maintenance'};
	if (diag.ready === false) {
		const all = (Array.isArray(diag.ready_reasons) ? diag.ready_reasons : []).filter(r => typeof r === 'string' && r.trim() !== '');
		readiness.notReady = {reasons: all.slice(0, MAX_READY_REASONS), more: Math.max(0, all.length - MAX_READY_REASONS)};
	}
	return readiness;
}

/** True when there is nothing to show. */
export function isQuiet(readiness: GatewayReadiness): boolean {
	return !readiness.notReady && !readiness.maintenance;
}
