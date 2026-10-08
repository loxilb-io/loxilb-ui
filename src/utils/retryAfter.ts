//---------------------------------------------------------
// Retry-After (RFC 9110 §10.2.3): delay-seconds, or an HTTP-date
//---------------------------------------------------------
// Returns whole seconds to wait, or null when the value says nothing usable —
// a caller must then show no wait at all, not a guessed one.

/** `nowMs` is a parameter so a date-form value is judged against a known clock. */
export function retryAfterSeconds(value: string | null | undefined, nowMs: number = Date.now()): number | null {
	const raw = value?.trim();
	if (!raw) return null;
	if (/^\d+$/.test(raw)) {
		const seconds = Number(raw);
		return Number.isSafeInteger(seconds) ? seconds : null;
	}
	// Only the fixed HTTP-date form: Date.parse alone also accepts "1.5" and "-1".
	if (!/^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(raw)) return null;
	const at = Date.parse(raw);
	if (Number.isNaN(at)) return null;
	return Math.max(0, Math.ceil((at - nowMs) / 1000));
}
