//---------------------------------------------------------
// User Management Types
//---------------------------------------------------------

/**
 * User Creation Request (Traditional Signup)
 */
export interface ICreateUserRequest {
	username: string;
	password: string;
	email: string; // Make required based on new API
	role?: string; // Optional role assignment
}

/**
 * User Creation Response
 */
export interface IUserIdResponse {
	id: number;
}

/**
 * User Model (Complete User Information)
 */
export interface IUser {
	id: number;
	username: string;
	password?: string; // Usually not returned in responses
	email?: string;
	created_at?: string;
}

/**
 * Login Request (Traditional Login)
 */
export interface ILoginRequest {
	username: string;
	password: string;
}

/**
 * Login Response
 */
export interface ILoginResponse {
	id: number;
	token: string;
}

/**
 * Login Response returned by login_user.
 */
export interface IEnhancedLoginResponse {
	id: number;
	token: string;
}

/**
 * User Update Request (for profile editing)
 */
export interface IUserUpdateRequest {
	username?: string;
	email?: string;
	password?: string;
	role?: string;
}

/**
 * Password Change Request
 */
export interface IPasswordChangeRequest {
	current_password: string;
	new_password: string;
	confirm_password: string;
}