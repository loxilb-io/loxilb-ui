//---------------------------------------------------------
// Setup Detection Utilities
//---------------------------------------------------------
import { query_setup_status } from 'connector/oam/oam';
import { get_local_storage, save_local_storage } from 'common';
import { ISetupState, ISetupStatus } from 'types/setup';

/**
 * Check if this is a first-time setup
 */
export async function detectFirstTimeSetup(): Promise<boolean> {
	try {
		// First check localStorage for quick response
		const localSetupCompleted = get_local_storage('setup_completed');
		if (localSetupCompleted === 'true') {
			return false; // Setup already completed
		}

		// Check backend for authoritative answer
		const setupStatus = await query_setup_status();
		if (!setupStatus) {
			// If API call fails, assume first time setup is needed
			return true;
		}

		return setupStatus.isFirstTime;
	} catch (error) {
		console.error('Failed to detect first-time setup:', error);
		// On error, err on the side of caution and assume first-time setup
		return true;
	}
}

/**
 * Check setup completion status
 */
export async function checkSetupCompletion(): Promise<ISetupState> {
	const defaultState: ISetupState = {
		isFirstTime: true,
		currentStep: 0,
		completedSteps: [],
		adminConfigured: false,
		passwordPolicyEnforced: false,
		loxilbConnected: false,
		setupCompleted: false,
	};

	try {
		// Try to get current setup progress from backend - using simplified API
		const setupStatus = await query_setup_status();
		if (setupStatus) {
			return {
				isFirstTime: setupStatus.needsCredentialUpdate,
				currentStep: 0, // Simplified setup has no steps
				completedSteps: [],
				adminConfigured: !setupStatus.needsCredentialUpdate,
				passwordPolicyEnforced: false, // Simplified setup doesn't track this
				loxilbConnected: false, // Simplified setup doesn't track this
				setupCompleted: !setupStatus.needsCredentialUpdate,
			};
		}

		// Fallback to localStorage for migration scenarios
		const localSetupState = get_local_storage('setup_state');
		if (localSetupState) {
			return JSON.parse(localSetupState) as ISetupState;
		}

		return defaultState;
	} catch (error) {
		console.error('Failed to check setup completion:', error);
		return defaultState;
	}
}

/**
 * Check for admin user existence and default passwords
 */
export async function checkAdminConfiguration(): Promise<{
	adminExists: boolean;
	hasDefaultCredentials: boolean;
	needsPasswordChange: boolean;
}> {
	try {
		const setupStatus = await query_setup_status();
		// Note: simplified API doesn't have separate credential check endpoint

		return {
			adminExists: setupStatus?.adminExists ?? false,
			hasDefaultCredentials: setupStatus?.hasDefaultCredentials ?? false,
			needsPasswordChange: setupStatus?.needsCredentialUpdate ?? false,
		};
	} catch (error) {
		console.error('Failed to check admin configuration:', error);
		return {
			adminExists: false,
			hasDefaultCredentials: true,
			needsPasswordChange: true,
		};
	}
}

/**
 * Check LoxiLB configuration status
 */
export async function checkLoxilbConfiguration(): Promise<boolean> {
	try {
		const setupStatus = await query_setup_status();
		// Simplified setup doesn't track LoxiLB configuration separately
		return !(setupStatus?.needsCredentialUpdate ?? true);
	} catch (error) {
		console.error('Failed to check LoxiLB configuration:', error);
		return false;
	}
}

/**
 * Save setup completion status to localStorage for quick access
 */
export function saveSetupCompletionStatus(completed: boolean): void {
	save_local_storage('setup_completed', completed.toString());
}

/**
 * Get setup completion status from localStorage
 */
export function getLocalSetupCompletionStatus(): boolean {
	const status = get_local_storage('setup_completed');
	return status === 'true';
}

/**
 * Clear setup-related localStorage data
 */
export function clearSetupLocalStorage(): void {
	localStorage.removeItem('setup_completed');
	localStorage.removeItem('setup_state');
	localStorage.removeItem('admin_password_changed');
	localStorage.removeItem('loxilb_configured');
}

/**
 * Comprehensive setup validation
 */
export async function validateCompleteSetup(): Promise<{
	isValid: boolean;
	missingSteps: string[];
	warnings: string[];
}> {
	const missingSteps: string[] = [];
	const warnings: string[] = [];

	try {
		const setupStatus = await query_setup_status();
		const adminConfig = await checkAdminConfiguration();

		// Check admin configuration
		if (!adminConfig.adminExists) {
			missingSteps.push('Admin user configuration');
		}

		// Check for default passwords
		if (adminConfig.hasDefaultCredentials) {
			missingSteps.push('Default password change');
		}

		// Check for users needing password changes
		if (adminConfig.needsPasswordChange) {
			warnings.push('Some users still need to change their passwords');
		}

		// Check LoxiLB configuration (optional but recommended)
		if (!setupStatus?.loxilbConfigured) {
			warnings.push('LoxiLB connection not configured');
		}

		return {
			isValid: missingSteps.length === 0,
			missingSteps,
			warnings,
		};
	} catch (error) {
		console.error('Failed to validate setup:', error);
		return {
			isValid: false,
			missingSteps: ['Setup validation failed - please complete setup manually'],
			warnings: ['Unable to verify current setup status'],
		};
	}
}

/**
 * Determine if user should be redirected to setup wizard
 */
export async function shouldRedirectToSetup(): Promise<{
	shouldRedirect: boolean;
	reason: string;
	redirectPath: string;
}> {
	try {
		const isFirstTime = await detectFirstTimeSetup();
		
		if (isFirstTime) {
			return {
				shouldRedirect: true,
				reason: 'First-time setup required',
				redirectPath: '/setup',
			};
		}

		const adminConfig = await checkAdminConfiguration();
		
		if (adminConfig.needsPasswordChange) {
			return {
				shouldRedirect: true,
				reason: 'Password change required',
				redirectPath: '/setup/password',
			};
		}

		const validation = await validateCompleteSetup();
		
		if (!validation.isValid) {
			return {
				shouldRedirect: true,
				reason: `Incomplete setup: ${validation.missingSteps.join(', ')}`,
				redirectPath: '/setup',
			};
		}

		return {
			shouldRedirect: false,
			reason: 'Setup is complete',
			redirectPath: '',
		};
	} catch (error) {
		console.error('Failed to determine setup redirect:', error);
		return {
			shouldRedirect: true,
			reason: 'Setup verification failed',
			redirectPath: '/setup',
		};
	}
}