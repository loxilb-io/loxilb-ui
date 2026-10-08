//---------------------------------------------------------
// Names that cannot travel in a URL path
//---------------------------------------------------------
// The management backend refuses a proxied request whose path segment holds an
// encoded `/`, `\`, `?` or `#`: once decoded, each one changes which Gateway
// route the request means. It answers 400 "Invalid gateway path" and forwards
// nothing. A delete or an update addresses its target by name IN the path, so a
// target whose name holds one of these cannot be reached through the backend
// at all.
//
// Refused here, before sending, because the backend's 400 reads as "the
// request was rejected as invalid" about a request the operator did not write:
// they clicked Delete on a row. The sentence below names the cause and the way
// out.

import {OpResult} from './opResult';

/** The four characters, shown to the operator as they are. */
export const UNSENDABLE_PATH_CHARS = '/ \\ ? #';

export const UNSENDABLE_PATH_KEY =
	'This name contains one of the characters / \\ ? #, which cannot be sent through the management service. Change or remove this item with the gateway API or command line.';

/** True when any value holds a character the backend refuses in a path segment. */
export function unsendableInPath(...values: readonly unknown[]): boolean {
	return values.some(value => typeof value === 'string' && /[/\\?#]/.test(value));
}

/** The refusal for `op`: an input problem, not sent, nothing to retry. */
export function pathRefusal(op: string): OpResult<never> {
	return {status: 'invalid', code: `${op}.client_invalid_path`, localeKey: UNSENDABLE_PATH_KEY, retryable: false};
}
