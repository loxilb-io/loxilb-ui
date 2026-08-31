//---------------------------------------------------------
// OpResult → locale-key mapping table (UI-P6-1)
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
	failed: 'The operation could not be completed.',
};

/** 429 everywhere except login (login uses LOGIN_LOCKED_KEY). */
export const RATE_LIMITED_KEY = 'Too many requests. Please try again later.';

/** 409 — the request conflicts with existing server state (duplicates etc.). */
export const CONFLICT_KEY = 'The request conflicts with an existing item.';

/** 501 — the gateway build/launch config does not enable this feature (e.g. --userservice off). */
export const NOT_ENABLED_KEY = 'This feature is not enabled on this instance.';

// Login-specific keys (N-3 / ES-27). The lockout text deliberately does NOT
// disclose attempt counts or the retry-after countdown — Q-4 conservative
// default until SECURITY_PROFILE.md decides otherwise.
export const LOGIN_LOCKED_KEY = 'Too many failed sign-in attempts. Please try again later.';
export const LOGIN_INVALID_KEY = 'Invalid username or password.';
export const LOGIN_FAILED_KEY = 'Login failed';
