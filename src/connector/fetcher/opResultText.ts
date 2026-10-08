import {t} from 'i18next';
import {OpResult} from './opResult';

//---------------------------------------------------------
// Precondition-failure rendering (412)
//---------------------------------------------------------
// The general OpResult rule keeps raw server prose out of dialogs: a mapped,
// localized sentence is almost always the better one, and an untranslated
// internal string in a popup is a defect rather than a feature.
//
// 412 is the documented exception, for the same reason the snapshot family is
// one (see snapshotOpError.ts). PRECONDITION_KEY can only say WHOSE problem it
// is — "the request is valid; its deployment must change" — because the UI
// cannot know which deployment setting the gateway is missing. The gateway's
// own sentence names it (e.g. "vllm kvExactMode requires non-empty Gateway
// LLB_KV_NONE_HASH_SEED matching engine PYTHONHASHSEED") and arrives in
// `rawDetail`. Without it the operator is told to change a deployment and not
// told what to change in it, which is the one failure class where the raw text
// is strictly more actionable than the mapped one.
//
// Scoped to this code ON PURPOSE. Widening it to every failure would put
// internal prose behind errors whose mapped message already says the right
// thing.
//---------------------------------------------------------

/** True when the gateway refused on its own launch configuration, not on the request. */
export function isPreconditionFailure(res: Pick<OpResult, 'code'>): boolean {
	return res.code.endsWith('.precondition_failed');
}

/**
 * The wait the server asked for, as a sentence — or nothing. There is no
 * default: a result with no `retryAfterSeconds` came from a response that
 * named no wait, and a number made up here would be read as the server's.
 */
export function retryAfterText(res: Pick<OpResult, 'retryAfterSeconds'>): string | undefined {
	const seconds = res.retryAfterSeconds;
	return typeof seconds === 'number' && seconds > 0 ? t('Try again in {{seconds}} s.', {seconds}) : undefined;
}

/**
 * Localized headline for a failed operation, with the gateway's verbatim
 * detail appended for precondition failures only, and the wait the server
 * named when it named one. Every other code renders the mapped message alone.
 */
export function opErrorText(res: Pick<OpResult, 'code' | 'localeKey' | 'rawDetail' | 'retryAfterSeconds'>): string {
	const detail = isPreconditionFailure(res) ? res.rawDetail?.trim() : undefined;
	return [t(res.localeKey), detail, retryAfterText(res)].filter(Boolean).join(' ');
}
