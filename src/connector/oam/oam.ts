//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {parse_log_lines} from 'common';
import {ILog, ILogArchiveList} from 'types/log';
import {IInstance, IInstanceInput, IUser} from 'types/oam';
import {ISetupStatus, IUpdateAdminRequest, IUpdateAdminResponse} from 'types/setup';
import {ApiResult, DOWNLOAD_FILE_STREAM, DownloadProgress} from '../fetcher/fetcher_base';
import {DELETE_OAM, GET_OAM, POST_OAM, PUT_OAM} from '../fetcher/fetcher_oam';
import {getApiBaseUrl} from 'utils/apiProxy';
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

export type OamReachability = 'ok' | 'unreachable';

// Lightweight reachability probe for the login preflight.
//
// Deliberately uses a bare fetch instead of the shared OAM fetcher: the shared
// fetcher has global side-effects (a 404/500/503 redirects the whole app to an
// error page, a network failure throws), which is exactly the wrong behaviour
// before login. Here we only want to answer "is a healthy OAM backend actually
// serving BACKEND_URL?" and surface an inline banner if not — the single most
// common misdeployment is running this UI with no OAM behind it.
//
// 'ok' requires a 200 from OAM's /oam/health. Anything else is 'unreachable':
// a non-200 catches not just an absent backend (network error / 502/503/504)
// but also a *misconfigured* one — e.g. REACT_APP_API_URL pointing at the wrong
// path segment (/api/oam vs /oam) answers 404, and OAM with a dead DB answers
// non-200 via its health middleware. All of those mean login cannot succeed.
export async function preflight_oam(timeout_ms = 4000): Promise<OamReachability> {
	const url = `${getApiBaseUrl()}/health`;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout_ms);
	try {
		const resp = await fetch(url, {method: 'GET', headers: {Accept: 'application/json'}, signal: controller.signal});
		return resp.status === 200 ? 'ok' : 'unreachable';
	} catch {
		// Connection refused, DNS failure, TLS error, CORS block, or timeout —
		// from the UI's point of view there is no reachable backend.
		return 'unreachable';
	} finally {
		clearTimeout(timer);
	}
}

// Invalidates the session server-side. Best-effort: the caller clears local
// state and redirects regardless, so a network failure here still logs the
// user out of the UI (the server additionally revokes the token so it cannot
// be replayed).
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
	const full_url = `${getApiBaseUrl()}/logs/archives/${filename}`;
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
