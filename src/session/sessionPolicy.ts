//---------------------------------------------------------
// UI-P6-4 — session policy constants (ES-22 / ES-27).
//
// ⚠ PROVISIONAL, pending the Phase-0 `SECURITY_PROFILE.md`, which does not
// exist yet. These follow the campaign's established pattern for an unanswered
// Phase-0 input (UI-P6-1's Q-4 lockout wording, UI-P6-3's Q-2 poll table):
// pick the conservative value, put it in ONE module so the approved numbers
// land in a single edit, and record the reasoning where a reviewer will find
// it — here and in `docs/internal/gs-cert/m1/ui-impl/evidence/UI-P6-4/`.
//
// The UI schedules UX only. The OAM remains authoritative on session lifetime:
// nothing here extends a token, and a 401 still ends the session regardless of
// what these timers believe.
//---------------------------------------------------------

/**
 * How far BEFORE the token's `exp` the UI logs the operator out.
 *
 * Rationale: large enough that a request started just before the timer cannot
 * land after the server-side expiry (the observed testbed round trip is well
 * under a second, and this leaves room for a slow WAN hop), small enough that
 * it does not meaningfully shorten the session. A decoded testbed token
 * carries `exp` only — no `iat` — so the schedule is anchored on `exp` and the
 * local clock, never on an assumed issue time.
 */
export const PROACTIVE_SKEW_MS = 30_000;

/**
 * Idle limit: no qualifying interaction for this long ends the session.
 *
 * Rationale: the OAM's own token TTL is 8 hours (`OAM_TOKEN_TTL_MINUTES`
 * default, set during the Phase-4 RBAC hardening), which is far too long to
 * leave an authenticated console open on an unattended operator terminal —
 * the ES-22 exposure this task exists to close. 15 minutes is the
 * conservative end of the range operators tolerate for an admin console and
 * matches common baseline guidance; it is deliberately shorter than any
 * plausible approved value, so adopting the real profile can only relax it.
 */
export const IDLE_LIMIT_MS = 15 * 60_000;

/**
 * Interaction events that count as activity. Deliberately NOT `mousemove` or
 * `scroll`: a resting mouse nudged by a passing cabinet, or a page that
 * auto-scrolls, would keep an abandoned session alive forever and turn the
 * idle policy into decoration.
 */
export const ACTIVITY_EVENTS = ['pointerdown', 'keydown'] as const;
