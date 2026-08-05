//---------------------------------------------------------
// Setup Detection Utilities (Updated for finalized backend)
//---------------------------------------------------------
import {query_setup_status} from 'connector/oam/oam';
import {ISetupStatus} from 'types/setup';

// The setup check gates the WHOLE app (SetupHandler renders nothing until it
// resolves), so it must be bounded. An unreachable OAM rejects quickly, but a
// *hung* one — a TCP connection that is accepted and then never answered, the
// normal failure mode of a flaky link or a wedged proxy — leaves fetch pending
// for as long as the OS lets it. That turned into a permanently blank page:
// the fail-open handlers below could not run because the promise never
// settled. Bounding it converts that into the login page + its own
// "can't reach the management API" banner, which is the honest state.
//
// Same rationale as preflight_oam's 4s AbortController (connector/oam/oam.ts).
export const SETUP_CHECK_TIMEOUT_MS = 4000;

class SetupCheckTimeout extends Error {
	constructor(ms: number) {
		super(`setup status check exceeded ${ms}ms`);
		this.name = 'SetupCheckTimeout';
	}
}

/**
 * Resolves with `promise`, or rejects with SetupCheckTimeout after `ms`.
 * Exported for testing — the timeout is the whole point of this module's
 * fail-open behaviour, so it is covered directly.
 */
export function with_timeout<T>(promise: Promise<T>, ms = SETUP_CHECK_TIMEOUT_MS): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new SetupCheckTimeout(ms)), ms);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/**
 * Check if credential update is needed
 */
export async function checkNeedsCredentialUpdate(): Promise<boolean> {
	try {
		const status = await with_timeout(query_setup_status());
		return status?.needsCredentialUpdate === true;
	} catch (error) {
		console.warn('Credential update check failed:', error);
		// On API error OR timeout, assume no setup needed rather than blocking
		// login behind an unanswerable request.
		return false;
	}
}

/**
 * Check if user should be redirected to setup
 */
export async function shouldRedirectToSetup(): Promise<boolean> {
	return await checkNeedsCredentialUpdate();
}

/**
 * Get detailed setup status information
 * @returns Promise<ISetupStatus | null> - setup status or null on error
 */
export async function getSetupStatus(): Promise<ISetupStatus | null> {
	try {
		const status = await with_timeout(query_setup_status());
		return status || null;
	} catch (error) {
		console.warn('Failed to get setup status:', error);
		return null;
	}
}

/**
 * Check if this is likely a first-time setup scenario
 * @returns Promise<boolean> - true if appears to be first-time setup
 */
export async function isFirstTimeSetup(): Promise<boolean> {
	try {
		const status = await getSetupStatus();
		return status?.hasDefaultCredentials === true &&
		       status?.credentialsUpdated === false;
	} catch (error) {
		console.warn('Failed to check first-time setup:', error);
		return false;
	}
}