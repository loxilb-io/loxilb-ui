//---------------------------------------------------------
// Console guard — which errors a test may leave behind
//---------------------------------------------------------
// Every product spec fails on an uncaught console error. Most of those errors
// are the browser's own `Failed to load resource: the server responded with a
// status of 404 (Not Found)` — and that sentence does not say WHICH request
// failed. Two things followed from that:
//
//   1. An allowance could only be written against the sentence, so the common
//      one — `/Failed to load resource/` — lets EVERY failed request through
//      for the rest of that test, including the one that would have exposed a
//      regression.
//   2. A violation could not say what failed. A gateway build without
//      `/status/capabilities` failed 68 specs with the identical bare
//      sentence, and it took a trace to learn which URL it was.
//
// Chrome does report the request's URL, as the message's location. This keeps
// it: a violation now names the request, and `allowRequest` allows exactly one
// kind of failed request instead of all of them.
//
// ⚠️ `allow(regex)` still matches the ORIGINAL message text only. Appending the
// URL to the text it matches would quietly widen every existing allowance —
// `/403/` or `/timeout/i` would start matching paths.
//---------------------------------------------------------
import type {ConsoleMessage, Page} from '@playwright/test';

export interface RequestAllowance {
	status: number;
	/** Matched against the request's pathname, never its host. */
	path: RegExp;
}

export interface ConsoleGuard {
	/** Allowlist an expected error by its message text (e.g. a deliberate 4xx in a V-case). */
	allow(pattern: RegExp): void;
	/** Allowlist one failed request by status AND path — prefer this for resource errors. */
	allowRequest(allowance: RequestAllowance): void;
	violations(): string[];
}

export interface ConsoleError {
	text: string;
	/** Present only for a failed resource load: the request's pathname and status. */
	request?: {path: string; status: number};
}

// Ambient dev-server / browser noise that is not an app defect.
export const GLOBAL_ALLOW: RegExp[] = [
	/Download the React DevTools/i,
	/WebSocket connection .* failed/i,
	/manifest\.json/i,
	/favicon/i,
	// Transient TCP resets on the WAN path to the live testbed (observed
	// killing otherwise-green specs across runs). App-level failures surface
	// as 4xx/5xx or in-page error banners — both still guarded.
	/net::ERR_CONNECTION_RESET/,
];

export const GLOBAL_ALLOWED_REQUESTS: RequestAllowance[] = [
	// A gateway that predates the capability surface answers 404, and the
	// contract reads that as `unknown` — the KV-exact options stay offered
	// (pinned by kvexact-readiness B-03). A supported deployment, not a defect;
	// on a gateway that has the endpoint this entry never matches.
	{status: 404, path: /\/netlox\/v1\/status\/capabilities$/},
];

const RESOURCE_FAILURE = /^Failed to load resource: .*status of (\d{3})/;

/** Pure: turn a console error into what the guard records. */
export function toConsoleError(text: string, locationUrl: string | undefined): ConsoleError {
	const m = RESOURCE_FAILURE.exec(text);
	if (!m || !locationUrl) return {text};
	let path: string;
	try {
		path = new URL(locationUrl).pathname;
	} catch {
		return {text};
	}
	return {text, request: {path, status: Number(m[1])}};
}

/** Pure: is this error allowed by any text pattern or request allowance? */
export function isAllowed(err: ConsoleError, patterns: RegExp[], requests: RequestAllowance[]): boolean {
	if (patterns.some(p => p.test(err.text))) return true;
	const r = err.request;
	return !!r && requests.some(a => a.status === r.status && a.path.test(r.path));
}

/** Pure: the line a violation is reported as — names the request when known. */
export function describeError(err: ConsoleError): string {
	return err.request ? `${err.text} — ${err.request.path}` : err.text;
}

/** Start collecting a page's console errors. */
export function attachConsoleGuard(page: Page): ConsoleGuard {
	const patterns = [...GLOBAL_ALLOW];
	const requests = [...GLOBAL_ALLOWED_REQUESTS];
	const errors: ConsoleError[] = [];
	page.on('console', (msg: ConsoleMessage) => {
		if (msg.type() === 'error') errors.push(toConsoleError(msg.text(), msg.location().url));
	});
	page.on('pageerror', err => errors.push({text: `pageerror: ${err.message}`}));
	return {
		allow: p => patterns.push(p),
		allowRequest: a => requests.push(a),
		violations: () => errors.filter(e => !isAllowed(e, patterns, requests)).map(describeError),
	};
}
