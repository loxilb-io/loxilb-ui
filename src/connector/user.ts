//---------------------------------------------------------
// User Management Connector Functions
//---------------------------------------------------------
import { SimpleResponse } from './fetcher/fetcher_base';
import { POST_OAM } from './fetcher/fetcher_oam';
import { ICreateUserRequest, IUserIdResponse, ILoginRequest, IEnhancedLoginResponse } from 'types/user';

/**
 * Create a new user account (Traditional Signup)
 * @param userData - User creation data
 */
export async function create_user(userData: ICreateUserRequest): Promise<IUserIdResponse> {
	try {
		console.log('Creating user with data:', { username: userData.username, email: userData.email });
		const response: SimpleResponse = await POST_OAM('/users', userData);
		console.log('User creation API response:', response);
		
		// Accept both 200 and 201 as success (some APIs return 200 instead of 201)
		if (response.code !== 200 && response.code !== 201) {
			// Parse error message from API response
			let errorMessage = 'Unknown error';
			
			if (response.data && typeof response.data === 'object' && response.data.error) {
				errorMessage = response.data.error;
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
			return { id: response.data } as IUserIdResponse;
		} else {
			// If no data returned but status is success, assume creation worked
			console.log('User created successfully but no ID returned');
			return { id: 0 } as IUserIdResponse; // Placeholder ID
		}
	} catch (error) {
		console.error('User creation failed:', error);
		throw error;
	}
}

/**
 * Login user with username and password
 * @param credentials - Login credentials
 */
export async function login_user(credentials: ILoginRequest): Promise<IEnhancedLoginResponse> {
	try {
		console.log('Logging in user:', credentials.username);
		const response: SimpleResponse = await POST_OAM('/login', credentials);
		console.log('Login API response:', response);
		
		if (response.code !== 200) {
			// Parse error message from API response
			let errorMessage = 'Login failed';
			
			if (response.data && typeof response.data === 'object' && response.data.error) {
				errorMessage = response.data.error;
			} else if (response.message) {
				errorMessage = response.message;
			}
			
			throw new Error(errorMessage);
		}

		if (!response.data) {
			throw new Error('No authentication data returned from server');
		}

		// Handle both legacy and enhanced login responses
		const loginData = response.data;
		
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
		console.error('User login failed:', error);
		throw error;
	}
}

/**
 * Create user account and automatically log them in
 * @param userData - User creation data
 */
export async function signup_and_login(userData: ICreateUserRequest): Promise<IEnhancedLoginResponse> {
	try {
		// Step 1: Create user account
		const createResult = await create_user(userData);
		console.log('User created successfully with ID:', createResult.id);

		// Step 2: Automatically log in the new user
		const loginResult = await login_user({
			username: userData.username,
			password: userData.password,
		});

		return loginResult;
	} catch (error) {
		console.error('Signup and login failed:', error);
		throw error;
	}
}

/**
 * Validate username availability (placeholder - would need API endpoint)
 * @param username - Username to check
 */
export async function check_username_availability(username: string): Promise<boolean> {
	// Note: This would require a specific API endpoint like GET /users/check?username=xxx
	// Since it's not in the swagger spec, we'll return true for now
	// In a real implementation, you'd call the API here
	console.log('Username availability check for:', username);
	return true;
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
	
	if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) {
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