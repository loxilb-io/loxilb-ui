//---------------------------------------------------------
// OpResult → locale-key mapping table 
//---------------------------------------------------------
// Keys are English source strings (this repo's i18n convention) and must
// exist in ALL of src/locales/{en,ko,ja}.json — opResult.test.ts enforces
// that, since the static locale:check gate cannot see dynamically-selected
// keys.

import {OpStatus} from './opResult';

/** Default message per status; specific operations may override with a more precise key. */
export const STATUS_LOCALE_KEYS: Record<OpStatus, string> = {
	confirmed: 'Operation completed successfully.',
	submitted: 'The request was submitted and is awaiting confirmation.',
	pending: 'The operation is still in progress.',
	denied: 'Permission denied',
	invalid: 'The request was rejected as invalid.',
	unavailable: 'The service is temporarily unavailable. Please try again later.',
	unknown: 'No answer came back, so it is not known whether this change was applied. Check the current state before sending it again.',
	failed: 'The operation could not be completed.',
};

/** 429 everywhere except login (login uses LOGIN_LOCKED_KEY). */
export const RATE_LIMITED_KEY = 'Too many requests. Please try again later.';

/** 409 — the request conflicts with existing server state (duplicates etc.). */
export const CONFLICT_KEY = 'The request conflicts with an existing item.';

/** 501 — the gateway build/launch config does not enable this feature (e.g. --userservice off). */
export const NOT_ENABLED_KEY = 'This feature is not enabled on this instance.';

/**
 * 412 — the request was well-formed and valid, and THIS gateway is not
 * provisioned to serve it. A sibling of 501 rather than of 400: nothing the
 * operator can change in the form will help, so the message must not send them
 * back to the fields. The gateway's own sentence — which names the setting and
 * the required relationship — arrives separately in `rawDetail`, and that is
 * the actionable half; this string exists to say whose problem it is.
 */
export const PRECONDITION_KEY = 'This gateway is not configured to accept this request. The request is valid; its deployment must change.';

// 503 refusals that name their cause. All three are answered BEFORE the
// request is acted on, so each says the request was not carried out. The
// wording fits a read as well as a change: a read can be refused the same way.

/** 503 — the Gateway could not record the request in its audit trail, so it refused it. */
export const AUDIT_UNAVAILABLE_KEY = 'The gateway refused this request because it cannot write its audit record right now. Nothing was changed.';

/** 503 — boot replay, a restore in progress, or maintenance an operator turned on. */
export const MAINTENANCE_KEY = 'The gateway is in maintenance mode and is not accepting changes. Nothing was changed.';

/** 503 — the management backend holds no usable credential for this Gateway; the request never left it. */
export const IDENTITY_UNAVAILABLE_KEY = 'The management service cannot authenticate to this gateway right now, so the request was not sent to it.';

// Login-specific keys. The lockout text deliberately does NOT
// disclose attempt counts or the retry-after countdown — conservative
// default until SECURITY_PROFILE.md decides otherwise.
export const LOGIN_LOCKED_KEY = 'Too many failed sign-in attempts. Please try again later.';
export const LOGIN_INVALID_KEY = 'Invalid username or password.';
export const LOGIN_FAILED_KEY = 'Login failed';
