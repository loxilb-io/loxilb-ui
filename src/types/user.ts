//---------------------------------------------------------
// User Management Types
//---------------------------------------------------------
import { ILicenseStatusResponse } from './license';

/**
 * User Creation Request (Traditional Signup)
 */
export interface ICreateUserRequest {
	username: string;
	password: string;
	email: string; // Make required based on new API
	license_key?: string; // Optional license assignment
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
 * Enhanced Login Response (with license information)
 */
export interface IEnhancedLoginResponse {
	id: number;
	token: string;
	has_valid_license: boolean;
	license_expiring: boolean;
	days_left: number;
	license_status: ILicenseStatusResponse;
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