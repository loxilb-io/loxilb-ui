//---------------------------------------------------------
// User Management Types
//---------------------------------------------------------

/**
 * User Creation Request (Traditional Signup)
 */
export interface ICreateUserRequest {
	username: string;
	password: string;
	email?: string; // Optional based on API but we'll make it required in UI
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
	license?: string;
	oauth_id?: string;
	oauth_provider?: string;
	oauth_token?: string;
}

/**
 * Login Request (Traditional Login)
 */
export interface ILoginRequest {
	username: string;
	password: string;
}

/**
 * Login Response (Traditional and OAuth)
 */
export interface ILoginResponse {
	id: number;
	token: string;
}

/**
 * Form Validation State
 */
export interface IAuthFormErrors {
	username?: string;
	password?: string;
	email?: string;
	confirmPassword?: string;
	general?: string;
}

/**
 * Auth Form Data
 */
export interface IAuthFormData {
	username: string;
	password: string;
	email: string;
	confirmPassword: string;
}

/**
 * Auth Mode
 */
export type AuthMode = 'login' | 'signup';

/**
 * OAuth Provider
 */
export type OAuthProvider = 'google' | 'github';

/**
 * OAuth Loading State
 */
export interface IOAuthLoadingState {
	google: boolean;
	github: boolean;
}