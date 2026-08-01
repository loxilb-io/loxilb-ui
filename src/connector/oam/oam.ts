//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {parse_log_lines} from 'common';
import {ILog, ILogArchiveList} from 'types/log';
import {IInstance, IInstanceInput, IUser} from 'types/oam';
import {ISetupStatus, IUpdateAdminRequest, IUpdateAdminResponse} from 'types/setup';
import {ApiResult, DOWNLOAD_FILE_STREAM, DownloadProgress} from '../fetcher/fetcher_base';
import {DELETE_OAM, GET_OAM, POST_OAM, PUT_OAM} from '../fetcher/fetcher_oam';
import type {OamGetResp, OamPostResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_me(): Promise<IUser | undefined> {
	const resp = await GET_OAM<OamGetResp<'/oam/users/me'>>(`/users/me`);
	return (resp.data ?? undefined) as IUser | undefined;
}

export async function request_health_check(): Promise<boolean> {
	const resp = await GET_OAM<OamGetResp<'/oam/health'>>(`/health`);
	return resp.code === 200;
}

// Invalidates the session server-side. Best-effort: the caller clears local
// state and redirects regardless, so a network failure here still logs the
// user out of the UI (server-side token revocation is tracked in
// docs/SECURITY_RBAC_PLAN.md H-2).
export async function request_logout(): Promise<void> {
	try {
		await POST_OAM(`/logout`, {});
	} catch {
		// ignore — local logout proceeds
	}
}

export async function query_get_instance_list(): Promise<IInstance[]> {
	const resp = await GET_OAM<OamGetResp<'/oam/loxilbs'>>(`/loxilbs`);
	return (resp.data ?? []) as IInstance[];
}

export async function request_create_instance(param: IInstanceInput): Promise<ApiResult> {
	const resp = await POST_OAM(`/loxilbs`, param);
	if (resp.code !== 201 && resp.code !== 200) return {status: 'error', error: `Failed to create instance: ${resp.message}`};
	else return {status: 'success'};
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

export async function download_oam_log_archive(filename: string, onProgress?: (p: DownloadProgress) => void): Promise<void> {
	// https://oam.example.com/oam/oam/logs/archives/loxioam.log
	const full_url = `${process.env.REACT_APP_API_URL}/logs/archives/${filename}`;
	await DOWNLOAD_FILE_STREAM(full_url, filename, onProgress);
}

export async function query_get_oam_logs(): Promise<ILog[]> {
	//[
	//	"ERROR: 2025/05/25 07:23:58 logging.go:51: main.main.func1: Reconnection failed: could not connect to database after 5 retries: %!w(<nil>)",
	//	...
	//]
	const resp = await GET_OAM<OamGetResp<'/oam/logs'>>(`/logs`);
	const log_strings = resp.data?.logs;
	if (!log_strings) return [];
	else {
		const res: ILog[] = parse_log_lines(log_strings);
		return res;
	}
}

export async function query_get_log_archives(): Promise<ILogArchiveList> {
	const resp = await GET_OAM<OamGetResp<'/oam/logs/archives'>>(`/logs/archives`);
	if (resp.code !== 200) return {archives: []};
	return (resp.data ?? {archives: []}) as ILogArchiveList;
}


//---------------------------------------------------------
// User Management API Functions
//---------------------------------------------------------
export async function query_get_all_users(): Promise<IUser[]> {
	const resp = await GET_OAM<OamGetResp<'/oam/users'>>('/users');
	return (resp.data ?? []) as IUser[];
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
	if (resp.code !== 200) {
		// Extract error message from response data if available (e.g., 403 Forbidden errors)
		const errorMessage = resp.data?.error || resp.message || 'Failed to delete user';
		return {status: 'error', error: errorMessage};
	}
	else return {status: 'success'};
}

//---------------------------------------------------------
// Setup & Onboarding API Functions (Updated for finalized backend)
//---------------------------------------------------------
export async function query_setup_status(): Promise<ISetupStatus | undefined> {
	const resp = await GET_OAM<OamGetResp<'/oam/setup/status'>>('/setup/status');
	return (resp.data ?? undefined) as ISetupStatus | undefined;
}

export async function request_update_admin_credentials(payload: IUpdateAdminRequest): Promise<IUpdateAdminResponse> {
	const resp = await POST_OAM<OamPostResp<'/oam/setup/update-admin'>>('/setup/update-admin', payload);
	if (resp.code !== 200 && resp.code !== 201) {
		return {
			success: false, 
			message: resp.data?.message || resp.message || 'Failed to update admin credentials'
		};
	}
	return (resp.data ?? {success: false, message: 'Empty response from server'}) as IUpdateAdminResponse;
}
