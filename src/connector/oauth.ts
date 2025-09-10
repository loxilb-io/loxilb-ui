//---------------------------------------------------------
// OAuth Authentication Connector Functions
//---------------------------------------------------------
import { SimpleResponse } from './fetcher/fetcher_base';
import { IEnhancedLoginResponse } from 'types/user';
import { IOAuthCallbackParams } from 'types/oauth';
import { OAuthProvider } from 'types/user';

/**
 * OAuth Configuration
 */
export const OAUTH_CONFIG = {
	google: {
		name: 'google' as const,
		displayName: 'Google',
		color: '#db4437',
		icon: '🔴',
		buttonStyle: {
			backgroundColor: '#db4437',
			color: 'white',
			hoverColor: '#c23321'
		}
	},
	github: {
		name: 'github' as const,
		displayName: 'GitHub',
		color: '#333',
		icon: '⚫',
		buttonStyle: {
			backgroundColor: '#24292e',
			color: 'white',
			hoverColor: '#1a1e22'
		}
	}
} as const;

/**
 * Initiate OAuth login flow
 * Redirects user to OAuth provider authorization page
 * @param provider - OAuth provider (google or github)
 */
export async function oauth_initiate_login(provider: OAuthProvider): Promise<void> {
	try {
		// Generate state parameter for security
		const state = btoa(JSON.stringify({
			provider,
			timestamp: Date.now(),
			returnUrl: window.location.origin + '/oauth/callback'
		}));

		// Store state and provider in sessionStorage for validation
		sessionStorage.setItem('oauth_state', state);
		sessionStorage.setItem('oauth_provider', provider);

		// Open OAuth in a popup window instead of redirect
		const apiUrl = process.env.REACT_APP_API_URL || '/oam';
		const redirectUri = encodeURIComponent(window.location.origin + '/oauth/callback');
		const oauthUrl = `${apiUrl}/oauth/${provider}?state=${encodeURIComponent(state)}&redirect_uri=${redirectUri}`;
		
		// Open popup window for OAuth
		console.log('Opening OAuth popup with URL:', oauthUrl);
		const popup = window.open(
			oauthUrl,
			'oauth_popup',
			'width=500,height=600,scrollbars=yes,resizable=yes'
		);

		if (!popup) {
			throw new Error('Popup blocked. Please allow popups for OAuth authentication.');
		}
		
		console.log('Popup opened successfully');

		// Poll for popup completion
		const checkPopup = setInterval(() => {
			try {
				if (popup.closed) {
					clearInterval(checkPopup);
					// Check if authentication was successful by looking for stored token
					const token = sessionStorage.getItem('oauth_temp_token');
					if (token) {
						// Save the token and redirect
						localStorage.setItem('access_token', token);
						sessionStorage.removeItem('oauth_temp_token');
						sessionStorage.removeItem('oauth_state');
						sessionStorage.removeItem('oauth_provider');
						window.location.href = '/instance';
					} else {
						throw new Error('OAuth authentication was cancelled or failed.');
					}
				}
			} catch (err) {
				// Handle cross-origin errors by checking if popup is closed
				if (popup.closed) {
					clearInterval(checkPopup);
				}
			}
		}, 1000);

		// Timeout after 5 minutes
		setTimeout(() => {
			if (!popup.closed) {
				popup.close();
				clearInterval(checkPopup);
				throw new Error('OAuth authentication timed out.');
			}
		}, 300000);

	} catch (error) {
		console.error(`OAuth initiation failed for ${provider}:`, error);
		throw error;
	}
}

/**
 * Handle OAuth callback and complete authentication
 * @param provider - OAuth provider
 * @param params - Callback parameters from OAuth provider
 */
export async function oauth_handle_callback(
	provider: OAuthProvider, 
	params: IOAuthCallbackParams
): Promise<IEnhancedLoginResponse> {
	try {
		// Validate state parameter
		const storedState = sessionStorage.getItem('oauth_state');
		if (!storedState || storedState !== params.state) {
			throw new Error('Invalid OAuth state parameter');
		}

		// Clear stored state
		sessionStorage.removeItem('oauth_state');

		// Handle OAuth errors
		if (params.error) {
			throw new Error(params.error_description || params.error);
		}

		// Make callback request to backend
		const apiUrl = process.env.REACT_APP_API_URL || '/oam';
		const callbackUrl = `${apiUrl}/oauth/${provider}/callback?code=${encodeURIComponent(params.code)}&state=${encodeURIComponent(params.state)}`;
		
		const response = await fetch(callbackUrl, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`OAuth callback failed: ${errorText}`);
		}

		const result: SimpleResponse = await response.json();
		
		if (result.code !== 200) {
			throw new Error(`OAuth authentication failed: ${result.message}`);
		}

		// Handle both legacy and enhanced login responses
	const loginData = result.data;
	
	// Check if it's enhanced response with license data
	if (loginData.license_status) {
		return loginData as IEnhancedLoginResponse;
	} else {
		// Legacy response - convert to enhanced format
		return {
			...loginData,
			has_valid_license: false,
			license_expiring: false,
			days_left: 0,
			license_status: null as any
		} as IEnhancedLoginResponse;
	}
	} catch (error) {
		console.error(`OAuth callback failed for ${provider}:`, error);
		throw error;
	}
}

/**
 * Check if current URL is an OAuth callback
 */
export function is_oauth_callback(): boolean {
	const urlParams = new URLSearchParams(window.location.search);
	return urlParams.has('code') && urlParams.has('state');
}

/**
 * Extract OAuth callback parameters from current URL
 */
export function get_oauth_callback_params(): IOAuthCallbackParams | null {
	const urlParams = new URLSearchParams(window.location.search);
	const code = urlParams.get('code');
	const state = urlParams.get('state');
	const error = urlParams.get('error');
	const error_description = urlParams.get('error_description');

	if (!code || !state) {
		return null;
	}

	return {
		code,
		state,
		error: error || undefined,
		error_description: error_description || undefined,
	};
}

/**
 * Determine OAuth provider from callback state
 */
export function get_oauth_provider_from_state(state: string): OAuthProvider | null {
	try {
		const decoded = JSON.parse(atob(state));
		return decoded.provider || null;
	} catch {
		return null;
	}
}