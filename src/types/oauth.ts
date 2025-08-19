//---------------------------------------------------------
// OAuth Authentication Types
//---------------------------------------------------------

/**
 * OAuth Provider Information
 */
export interface IOAuthProvider {
	name: 'google' | 'github';
	displayName: string;
	color: string;
	icon: string;
	buttonStyle: {
		backgroundColor: string;
		color: string;
		hoverColor: string;
	};
}

/**
 * OAuth Configuration
 */
export interface IOAuthConfig {
	google: IOAuthProvider;
	github: IOAuthProvider;
}

/**
 * OAuth State Parameters
 */
export interface IOAuthState {
	provider: string;
	timestamp: number;
	returnUrl?: string;
}

/**
 * OAuth Callback Parameters
 */
export interface IOAuthCallbackParams {
	code: string;
	state: string;
	error?: string;
	error_description?: string;
}

/**
 * OAuth Error Response
 */
export interface IOAuthError {
	error: string;
	error_description?: string;
	provider: string;
}