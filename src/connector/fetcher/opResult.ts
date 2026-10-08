//---------------------------------------------------------
// Normalized operation result 
//---------------------------------------------------------
// One discriminated result type for every connector operation. The binary
// legacy ApiResult ('success' | 'error') collapses denied / invalid /
// unavailable / submitted-but-unconfirmed into two states, which forces every
// consumer to invent its own mapping — or map unknown to success. OpResult
// makes the truthful state explicit and keeps raw server prose out of the
// rendering path.

// `unavailable` and `unknown` are not two words for one thing. `unavailable`
// is "not performed": the request was refused or never answered a read.
// `unknown` is only for a change whose answer was lost — it may have been
// applied, so the state must be read back before anything is sent again.
export type OpStatus = 'confirmed' | 'submitted' | 'pending' | 'denied' | 'invalid' | 'unavailable' | 'unknown' | 'failed';

/** Who produced a failure, from the marker the management backend adds. Absent when it added none. */
export type OpOrigin = 'gateway' | 'oam';

export interface OpResult<T = unknown> {
	status: OpStatus;
	/** Stable machine code, e.g. 'auth.locked_out', 'instance.create.conflict'. */
	code: string;
	/** i18n catalogue key (English source string per repo convention); NEVER raw server prose. */
	localeKey: string;
	/** Whether retrying the same operation later can reasonably succeed. */
	retryable: boolean;
	/** From the response header once the correlation-ID contract lands (optional until then). */
	correlationId?: string;
	/** Whole seconds the server asked the caller to wait. Absent when it named no wait — never a guess. */
	retryAfterSeconds?: number;
	origin?: OpOrigin;
	data?: T;
	// Diagnostics only — never rendered, never in evidence:
	httpStatus?: number;
	rawDetail?: string;
}
