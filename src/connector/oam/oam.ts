//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {parse_log_lines} from 'common';
import {ILog, ILogArchiveList} from 'types/log';
import {IInstance, IInstanceInput, IUser} from 'types/oam';
import {ILicenseStatusResponse, IInstallLicenseRequest, IUpdateLicenseRequest, ILicensePayload, IUserLicensesResponse} from 'types/license';
import {ISetupStatus, IUpdateAdminRequest, IUpdateAdminResponse} from 'types/setup';
import {ApiResult, load_token, SimpleResponse} from '../fetcher/fetcher_base';
import {DELETE_OAM, GET_OAM, POST_OAM, PUT_OAM} from '../fetcher/fetcher_oam';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_me(): Promise<IUser | undefined> {
	const resp = await GET_OAM(`/users/me`);
	return resp.data as IUser;
}

export async function request_health_check(): Promise<boolean> {
	const resp: SimpleResponse = await GET_OAM(`/health`);
	return resp.code === 200;
}

export async function query_get_instance_list(): Promise<IInstance[]> {
	const resp = await GET_OAM(`/loxilbs`);
	return (resp.data as IInstance[]) ?? [];
}

export async function request_create_instance(param: IInstanceInput): Promise<ApiResult> {
	const resp = await POST_OAM(`/loxilbs`, param);
	if (resp.code !== 201 && resp.code !== 200) return {status: 'error', error: `Failed to create instance: ${resp.message}`};
	else return {status: 'success'};
}

export async function request_get_instance_by_id(id: number): Promise<IInstance | undefined> {
	const resp = await GET_OAM(`/loxilbs/${id}`);
	return resp.data as IInstance;
}

export async function request_update_instance(id: number, param: IInstanceInput): Promise<ApiResult> {
	const resp = await PUT_OAM(`/loxilbs/${id}`, param);
	if (resp.code !== 200) return {status: 'error', error: `Failed to update instance with id ${id}: ${resp.message}`};
	else return {status: 'success'};
}

export async function request_delete_instance(id: number): Promise<ApiResult> {
	const resp = await DELETE_OAM(`/loxilbs/${id}`);
	if (resp.code !== 200) return {status: 'error', error: `Failed to delete instance with id ${id}: ${resp.message}`};
	else return {status: 'success'};
}

export async function request_upload_firmware(id: number): Promise<ApiResult> {
	const resp = await PUT_OAM(`/loxilbs/${id}/firmware`);
	if (resp.code !== 200) return {status: 'error', error: `Failed to upload firmware to instance ${id}: ${resp.message}`};
	else return {status: 'success'};
}

export async function request_firmware_install_start(id: number): Promise<ApiResult> {
	const resp = await PUT_OAM(`/loxilbs/${id}/firmware/start`);
	if (resp.code !== 200) return {status: 'error', error: `Failed to start firmware installation for instance ${id}: ${resp.message}`};
	else return {status: 'success'};
}

export async function request_firmware_install_stop(id: number): Promise<ApiResult> {
	const resp = await PUT_OAM(`/loxilbs/${id}/firmware/stop`);
	if (resp.code !== 200) return {status: 'error', error: `Failed to stop firmware installation for instance ${id}: ${resp.message}`};
	else return {status: 'success'};
}

export async function download_oam_log_archive(filename: string): Promise<void> {
	// https://oam-1.loxilb.io/oam/oam/logs/archives/loxioam.log
	const url = `/logs/archives/${filename}`;
	const base_url = process.env.REACT_APP_API_URL;
	const full_url = `${base_url}${url}`;

	const access_token = load_token();
	const response = await fetch(full_url, {method: 'GET', headers: {Authorization: `Bearer ${access_token}`}});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Failed to download log: ${text}`);
	}

	const blob = await response.blob();
	const downloadUrl = URL.createObjectURL(blob);

	const a = document.createElement('a');
	a.href = downloadUrl;
	a.download = filename;
	a.click();

	URL.revokeObjectURL(downloadUrl);
}

export async function query_get_oam_logs(): Promise<ILog[]> {
	//[
	//	"ERROR: 2025/05/25 07:23:58 logging.go:51: main.main.func1: Reconnection failed: could not connect to database after 5 retries: %!w(<nil>)",
	//	...
	//]
	const resp = await GET_OAM(`/logs`);
	const log_strings = resp.data.logs as string[] | undefined;
	if (!log_strings) return [];
	else {
		const res: ILog[] = parse_log_lines(log_strings);
		return res;
	}
}

export async function query_get_log_archives(): Promise<ILogArchiveList> {
	const resp = await GET_OAM(`/logs/archives`);
	if (resp.code !== 200) return {archives: []};
	return (resp.data as ILogArchiveList) ?? {archives: []};
}

//---------------------------------------------------------
// License Management API Functions
//---------------------------------------------------------
// DEPRECATED - use query_get_user_license_status instead
export async function query_get_license_status(): Promise<ILicenseStatusResponse | undefined> {
	// Updated to use new user licenses endpoint - returns status of first active license
	const userLicenses = await query_get_user_licenses();
	if (!userLicenses?.licenses?.length) return undefined;
	
	const firstActiveLicense = userLicenses.licenses.find(license => license.is_active);
	if (!firstActiveLicense) return undefined;
	
	return await query_get_user_license_status(firstActiveLicense.id);
}

export async function request_install_license(param: IInstallLicenseRequest): Promise<ApiResult> {
	const resp = await POST_OAM('/license/install', param);
	if (resp.code !== 201 && resp.code !== 200) {
		const errorMsg = resp.data?.error || resp.data?.message || resp.message || 'Unknown error';
		throw new Error(errorMsg);
	}
	return {status: 'success'};
}

// DEPRECATED - use request_update_user_license instead
export async function request_upgrade_license(param: IUpdateLicenseRequest): Promise<ApiResult> {
	// Updated to use new user license endpoint - updates first active license
	const userLicenses = await query_get_user_licenses();
	if (!userLicenses?.licenses?.length) {
		return {status: 'error', error: 'No licenses found for user'};
	}
	
	const firstActiveLicense = userLicenses.licenses.find(license => license.is_active);
	if (!firstActiveLicense) {
		return {status: 'error', error: 'No active license found to upgrade'};
	}
	
	return await request_update_user_license(firstActiveLicense.id, param);
}

export async function request_validate_license(param: IInstallLicenseRequest): Promise<ILicensePayload | undefined> {
	const resp = await POST_OAM('/license/validate', param);
	if (resp.code !== 200) return undefined;
	return resp.data as ILicensePayload;
}

export async function query_check_feature_access(feature: string): Promise<boolean> {
	const resp = await GET_OAM('/license/feature-access', {feature});
	return resp.code === 200;
}

//---------------------------------------------------------
// User License Management API Functions (New endpoints)
//---------------------------------------------------------
export async function query_get_user_licenses(): Promise<IUserLicensesResponse | undefined> {
	const resp = await GET_OAM('/users/licenses');
	return resp.data as IUserLicensesResponse;
}

export async function request_update_user_license(licenseId: number, param: IUpdateLicenseRequest): Promise<ApiResult> {
	const resp = await PUT_OAM(`/users/licenses/${licenseId}`, param);
	if (resp.code !== 200) {
		const errorMsg = resp.data?.error || resp.data?.message || resp.message || 'Unknown error';
		throw new Error(errorMsg);
	}
	return {status: 'success'};
}

export async function query_get_user_license_status(licenseId: number): Promise<ILicenseStatusResponse | undefined> {
	const resp = await GET_OAM(`/users/licenses/${licenseId}/status`);
	return resp.data as ILicenseStatusResponse;
}

export async function request_deactivate_user_license(licenseId: number): Promise<ApiResult> {
	const resp = await DELETE_OAM(`/users/licenses/${licenseId}`);
	if (resp.code !== 200) {
		const errorMsg = resp.data?.error || resp.data?.message || resp.message || 'Unknown error';
		throw new Error(errorMsg);
	}
	return {status: 'success'};
}

//---------------------------------------------------------
// User Management API Functions
//---------------------------------------------------------
export async function query_get_all_users(): Promise<IUser[]> {
	const resp = await GET_OAM('/users');
	return (resp.data as IUser[]) ?? [];
}

export async function request_update_user(id: number, userData: Partial<IUser>): Promise<ApiResult> {
	const resp = await PUT_OAM(`/users/${id}`, userData);
	if (resp.code !== 200) {
		// Extract error message from response data if available
		const errorMessage = resp.data?.error || resp.message || 'Failed to update user';
		return {status: 'error', error: errorMessage};
	}
	else return {status: 'success'};
}

export async function request_delete_user(id: number): Promise<ApiResult> {
	const resp = await DELETE_OAM(`/users/${id}`);
	if (resp.code !== 200) return {status: 'error', error: `Failed to delete user: ${resp.message}`};
	else return {status: 'success'};
}

//---------------------------------------------------------
// Setup & Onboarding API Functions (Updated for finalized backend)
//---------------------------------------------------------
export async function query_setup_status(): Promise<ISetupStatus | undefined> {
	const resp = await GET_OAM('/setup/status');
	return resp.data as ISetupStatus;
}

export async function request_update_admin_credentials(payload: IUpdateAdminRequest): Promise<IUpdateAdminResponse> {
	const resp = await POST_OAM('/setup/update-admin', payload);
	if (resp.code !== 200 && resp.code !== 201) {
		return {
			success: false, 
			message: resp.data?.message || resp.message || 'Failed to update admin credentials'
		};
	}
	return resp.data as IUpdateAdminResponse;
}
