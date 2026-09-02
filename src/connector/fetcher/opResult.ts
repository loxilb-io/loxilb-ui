//---------------------------------------------------------
// Normalized operation result 
//---------------------------------------------------------
// One discriminated result type for every connector operation. The binary
// legacy ApiResult ('success' | 'error') collapses denied / invalid /
// unavailable / submitted-but-unconfirmed into two states, which forces every
// consumer to invent its own mapping — or map unknown to success. OpResult
// makes the truthful state explicit and keeps raw server prose out of the
// rendering path.

export type OpStatus = 'confirmed' | 'submitted' | 'pending' | 'denied' | 'invalid' | 'unavailable' | 'failed';

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
	data?: T;
	// Diagnostics only — never rendered, never in evidence:
	httpStatus?: number;
	rawDetail?: string;
}
