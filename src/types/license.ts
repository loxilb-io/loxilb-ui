//---------------------------------------------------------
// License Management Types
//---------------------------------------------------------

export type LicenseType = 'trial' | 'enterprise';

export interface IActiveLicense {
	id: number;
	user_id: number;
	username: string;
	license_type: LicenseType;
	is_active: boolean;
	installed_at: string;
	expires_at: string;
	license_key_hash: string;
}

export interface ILicenseStatusResponse {
	is_valid: boolean;
	is_expiring: boolean; // < 7 days
	days_left: number;
	message: string;
	upgrade_url: string;
	license: IActiveLicense;
}

export interface IInstallLicenseRequest {
	license_key: string;
}

export interface IUpdateLicenseRequest {
	license_key: string;
}

export interface ILicensePayload {
	username: string;
	expiry: string;
}

export interface ISuccessResponse {
	message: string;
}

/**
 * User Licenses Response (for /api/users/licenses endpoint)
 */
export interface IUserLicensesResponse {
	licenses: IActiveLicense[];
	total_count: number;
	valid_count: number;
	expired_count: number;
}

/**
 * Deactivate License Request (for /api/users/licenses/deactivate endpoint)
 */
export interface IDeactivateLicenseRequest {
	license_id: number;
}

/**
 * Message Response (general response type)
 */
export interface IMessageResponse {
	message: string;
}
