//---------------------------------------------------------
// User Management Connector Functions
//---------------------------------------------------------
import { POST_OAM } from './fetcher/fetcher_oam';
import type { OamPostResp } from 'api';
import { ICreateUserRequest, IUserIdResponse, ILoginRequest, IEnhancedLoginResponse } from 'types/user';

/**
 * Create a new user account (Traditional Signup)
 * @param userData - User creation data
 */
export async function create_user(userData: ICreateUserRequest): Promise<IUserIdResponse> {
	try {
		const response = await POST_OAM<OamPostResp<'/oam/users'>>('/users', userData);

		// Accept both 200 and 201 as success (some APIs return 200 instead of 201)
		if (response.code !== 200 && response.code !== 201) {
			// Parse error message from API response
			let errorMessage = 'Unknown error';

			// non-2xx bodies are models.ErrorResponse, not the success type
			const errBody = response.data as {error?: string} | null;
			if (errBody && typeof errBody === 'object' && errBody.error) {
				errorMessage = errBody.error;
			} else if (response.message) {
				errorMessage = response.message;
			}
			
			throw new Error(errorMessage);
		}

		// For successful creation, return the response data
		// Some APIs might return the user ID directly or in a nested structure
		if (response.data && typeof response.data === 'object') {
			return response.data as IUserIdResponse;
		} else if (response.data) {
			// If response.data is just the ID number
			return { id: response.data as unknown as number } as IUserIdResponse;
		} else {
			// If no data returned but status is success, assume creation worked
			return { id: 0 } as IUserIdResponse; // Placeholder ID
		}
	} catch (error) {
		throw error;
	}
}

/**
 * Login user with username and password
 * @param credentials - Login credentials
 */
export async function login_user(credentials: ILoginRequest): Promise<IEnhancedLoginResponse> {
	try {
		const response = await POST_OAM<OamPostResp<'/oam/login'>>('/login', credentials);

		if (response.code !== 200) {
			// Parse error message from API response
			let errorMessage = 'Login failed';

			// non-2xx bodies are models.ErrorResponse, not the success type
			const errBody = response.data as {error?: string} | null;
			if (errBody && typeof errBody === 'object' && errBody.error) {
				errorMessage = errBody.error;
			} else if (response.message) {
				errorMessage = response.message;
			}
			
			throw new Error(errorMessage);
		}

		if (!response.data) {
			throw new Error('No authentication data returned from server');
		}

		return response.data as IEnhancedLoginResponse;
	} catch (error) {
		throw error;
	}
}

/**
 * Validate email format
 * @param email - Email to validate
 */
export function validate_email(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param password - Password to validate
 */
export function validate_password(password: string): { isValid: boolean; message?: string } {
	if (password.length < 9) {
		return { isValid: false, message: 'Password must be at least 9 characters long' };
	}
	
	if (!/(?=.*[a-z])/.test(password)) {
		return { isValid: false, message: 'Password must contain at least one lowercase letter' };
	}
	
	if (!/(?=.*[A-Z])/.test(password)) {
		return { isValid: false, message: 'Password must contain at least one uppercase letter' };
	}
	
	if (!/(?=.*\d)/.test(password)) {
		return { isValid: false, message: 'Password must contain at least one number' };
	}
	
	if (!/(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/.test(password)) {
		return { isValid: false, message: 'Password must contain at least one special character' };
	}
	
	return { isValid: true };
}

/**
 * Validate username format
 * @param username - Username to validate
 */
export function validate_username(username: string): { isValid: boolean; message?: string } {
	if (username.length < 3) {
		return { isValid: false, message: 'Username must be at least 3 characters long' };
	}
	
	if (username.length > 50) {
		return { isValid: false, message: 'Username must be no more than 50 characters long' };
	}
	
	if (!/^[a-zA-Z0-9_]+$/.test(username)) {
		return { isValid: false, message: 'Username can only contain letters, numbers, and underscores' };
	}
	
	if (/^[0-9]/.test(username)) {
		return { isValid: false, message: 'Username cannot start with a number' };
	}
	
	return { isValid: true };
}