//---------------------------------------------------------
// Setup Detection Utilities (Updated for finalized backend)
//---------------------------------------------------------
import { query_setup_status } from 'connector/oam/oam';

/**
 * Check if credential update is needed
 */
export async function checkNeedsCredentialUpdate(): Promise<boolean> {
	try {
		const status = await query_setup_status();
		return status?.needsCredentialUpdate === true;
	} catch (error) {
		console.error('Credential update check failed:', error);
		return true; // Assume update needed on error
	}
}

/**
 * Check if user should be redirected to setup
 */
export async function shouldRedirectToSetup(): Promise<boolean> {
	return await checkNeedsCredentialUpdate();
}