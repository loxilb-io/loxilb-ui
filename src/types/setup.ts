//---------------------------------------------------------
// Initial Setup & Onboarding Types
//---------------------------------------------------------

/**
 * Setup Status Response (matches finalized backend API)
 */
export interface ISetupStatus {
	needsCredentialUpdate: boolean;
	adminExists: boolean;
	hasDefaultCredentials: boolean;
	credentialsUpdated: boolean;
	systemInfo?: {
		version: string;
		installationId: string;
		adminUserId: number;
	};
}

/**
 * Update Admin Credentials Request (for credential update flow)
 */
export interface IUpdateAdminRequest {
	currentUsername: string;
	currentPassword: string;
	newUsername: string;
	newPassword: string;
	newEmail: string;
	confirmPassword: string;
}

/**
 * Update Admin Credentials Response
 */
export interface IUpdateAdminResponse {
	success: boolean;
	message: string;
	newAccessToken?: string;
}

/**
 * Setup State Interface (for comprehensive wizard setup)
 */
export interface ISetupState {
	isFirstTime: boolean;
	currentStep: number;
	completedSteps: number[];
	adminConfigured: boolean;
	passwordPolicyEnforced: boolean;
	loxilbConnected: boolean;
	setupCompleted: boolean;
}

/**
 * Setup Status Response
 */
export interface ISetupStatus {
	isFirstTime: boolean;
	adminExists: boolean;
	defaultPasswordInUse: boolean;
	loxilbConfigured: boolean;
	setupCompleted: boolean;
}

/**
 * Initial Setup Request
 */
export interface IInitialSetupRequest {
	adminUsername: string;
	adminPassword: string;
	adminEmail: string;
	securityPolicyEnabled: boolean;
	loxilbEndpoint?: string;
	skipLoxilbConfig?: boolean;
}

/**
 * Admin Credentials Validation Request
 */
export interface IAdminCredentialsValidationRequest {
	username: string;
	password: string;
}

/**
 * Admin Credentials Validation Response
 */
export interface IAdminCredentialsValidationResponse {
	isDefaultPassword: boolean;
	passwordStrengthValid: boolean;
	usernameAvailable: boolean;
}

/**
 * LoxiLB Connection Test Request
 */
export interface ILoxilbConnectionTestRequest {
	endpoint: string;
}

/**
 * LoxiLB Connection Test Response
 */
export interface ILoxilbConnectionTestResponse {
	connectionSuccessful: boolean;
	version?: string;
	error?: string;
}

/**
 * Setup Progress Request
 */
export interface ISetupProgressRequest {
	currentStep: number;
	completedSteps: number[];
	adminConfigured: boolean;
	passwordPolicyEnforced: boolean;
	loxilbConnected: boolean;
}

/**
 * Setup Progress Response
 */
export interface ISetupProgressResponse {
	currentStep: number;
	completedSteps: number[];
	adminConfigured: boolean;
	passwordPolicyEnforced: boolean;
	loxilbConnected: boolean;
	setupCompleted: boolean;
}

/**
 * Default Credentials Check Response
 */
export interface IDefaultCredentialsCheckResponse {
	hasDefaultAdmin: boolean;
	defaultUsers: Array<{
		id: number;
		username: string;
		needsPasswordChange: boolean;
	}>;
}

/**
 * Setup Step Configuration
 */
export interface ISetupStepConfig {
	id: number;
	title: string;
	description: string;
	component: string;
	required: boolean;
	canSkip: boolean;
	order: number;
}

/**
 * Setup Wizard State
 */
export interface ISetupWizardState {
	currentStep: number;
	totalSteps: number;
	canGoNext: boolean;
	canGoPrevious: boolean;
	isComplete: boolean;
	steps: ISetupStepConfig[];
}

/**
 * Password Policy Configuration
 */
export interface IPasswordPolicyConfig {
	minLength: number;
	requireUppercase: boolean;
	requireLowercase: boolean;
	requireNumbers: boolean;
	requireSpecialChars: boolean;
	preventCommonPasswords: boolean;
	preventUsernameInPassword: boolean;
	maxRepeatedChars: number;
	preventConsecutiveChars: boolean;
}

/**
 * Security Configuration
 */
export interface ISecurityConfig {
	passwordPolicy: IPasswordPolicyConfig;
	sessionTimeout: number;
	maxLoginAttempts: number;
	lockoutDuration: number;
	requirePasswordChange: boolean;
	passwordExpiration: number;
}

/**
 * LoxiLB Configuration
 */
export interface ILoxilbConfig {
	endpoint: string;
	username?: string;
	password?: string;
	useSSL: boolean;
	verifySSL: boolean;
	timeout: number;
	retryAttempts: number;
}

/**
 * Setup Completion Response
 */
export interface ISetupCompletionResponse {
	success: boolean;
	message: string;
	adminUserId: number;
	nextSteps: string[];
	warnings: string[];
}