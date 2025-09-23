//---------------------------------------------------------
// Setup Detection Utilities (Updated for finalized backend)
//---------------------------------------------------------
import {query_setup_status} from 'connector/oam/oam';
import {ISetupStatus} from 'types/setup';

/**
 * Check if credential update is needed
 */
export async function checkNeedsCredentialUpdate(): Promise<boolean> {
	try {
		const status = await query_setup_status();
		return status?.needsCredentialUpdate === true;
	} catch (error) {
		console.warn('Credential update check failed:', error);
		// On API error, assume no setup needed to avoid blocking normal login
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
		const status = await query_setup_status();
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