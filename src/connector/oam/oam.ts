//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {parse_log_lines} from 'common';
import {ILog, ILogArchiveList} from 'types/log';
import {IInstance, IInstanceInput, IUser} from 'types/oam';
import {ISetupStatus, IUpdateAdminRequest, IUpdateAdminResponse} from 'types/setup';
import {assertOk, DOWNLOAD_FILE_STREAM, DownloadProgress} from '../fetcher/fetcher_base';
import {DELETE_OAM, GET_OAM, POST_OAM, PUT_OAM} from '../fetcher/fetcher_oam';
import {OpResult} from '../fetcher/opResult';
import {fromNetworkError, fromSimpleResponse} from '../fetcher/opResultAdapter';
import {getApiBaseUrl} from 'utils/apiProxy';
import type {OamGetResp, OamPostResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_me(): Promise<IUser | undefined> {
	const resp = await GET_OAM<OamGetResp<'/oam/users/me'>>(`/users/me`);
	assertOk(resp, 'Get My Info');
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
	// UI-P6-5 answers the question UI-P6-6 left open below: an unusable
	// response SURFACES as an error rather than reading as "no instances".
	// A management API that is down is not the same fact as an operator who
	// has registered nothing, and the landing page said the second one.
	assertOk(resp, 'Get Instance List');
	// Array.isArray, not `?? []`: `??` only guards null/undefined, so an error
	// object — or a string, or 0, or false — used to pass straight through the
	// cast as if it were a list. Every instance page then calls .find on it
	// (useInstanceFromURL, get_instance, get_instance_name), so one odd
	// response became a TypeError during render and took the whole route to
	// RouteErrorBoundary. Seen in UI-P6-6's AFTER-run as 121 console errors
	// headed by `instance_list.find is not a function` in <LBRulePage>.
	//
	// This only guarantees the shape. Whether an unusable response should
	// SURFACE as an error instead of reading as "no instances" is UI-P6-5's
	// call — this read feeds SetupHandler and flavor probing, so making it
	// throw touches app start-up (evidence/UI-P6-5/prep-notes.md).
	return Array.isArray(resp.data) ? (resp.data as IInstance[]) : [];
}

// Instance mutations return a discriminated OpResult (UI-P6-1 batch 1) so
// consumers can distinguish denied / invalid / unavailable / failed instead
// of inventing per-site mappings — and so a 200-{result:"fail"} body or a
// parse-swallowed 200 can never render as success.
export async function request_create_instance(param: IInstanceInput): Promise<OpResult> {
	try {
		return fromSimpleResponse(await POST_OAM(`/loxilbs`, param), 'instance.create');
	} catch (error) {
		return fromNetworkError('instance.create', error);
	}
}

export async function request_update_instance(id: number, param: IInstanceInput): Promise<OpResult> {
	try {
		return fromSimpleResponse(await PUT_OAM(`/loxilbs/${id}`, param), 'instance.update');
	} catch (error) {
		return fromNetworkError('instance.update', error);
	}
}

export async function request_delete_instance(id: number): Promise<OpResult> {
	try {
		return fromSimpleResponse(await DELETE_OAM(`/loxilbs/${id}`), 'instance.delete');
	} catch (error) {
		return fromNetworkError('instance.delete', error);
	}
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
	assertOk(resp, 'Get OAM Logs');
	const log_strings = resp.data?.logs;
	if (!log_strings) return [];
	else {
		const res: ILog[] = parse_log_lines(log_strings);
		return res;
	}
}

export async function query_get_log_archives(): Promise<ILogArchiveList> {
	const resp = await GET_OAM<OamGetResp<'/oam/logs/archives'>>(`/logs/archives`);
	assertOk(resp, 'Get OAM Log Archives');
	return (resp.data ?? {archives: []}) as ILogArchiveList;
}


//---------------------------------------------------------
// User Management API Functions
//---------------------------------------------------------
export async function query_get_all_users(): Promise<IUser[]> {
	const resp = await GET_OAM<OamGetResp<'/oam/users'>>('/users');
	assertOk(resp, 'Get All Users');
	// Array.isArray for the same reason as the instance list above: this was
	// the last read casting a whole response body to an array, and
	// UserManagementPage maps over the result. A 200 carrying an unexpected
	// shape would take the page to the error boundary.
	return Array.isArray(resp.data) ? (resp.data as IUser[]) : [];
}

export async function request_update_user(id: number, userData: Partial<IUser>): Promise<OpResult> {
	try {
		return fromSimpleResponse(await PUT_OAM(`/users/${id}`, userData), 'user.update');
	} catch (error) {
		return fromNetworkError('user.update', error);
	}
}

export async function request_delete_user(id: number): Promise<OpResult> {
	try {
		return fromSimpleResponse(await DELETE_OAM(`/users/${id}`), 'user.delete');
	} catch (error) {
		return fromNetworkError('user.delete', error);
	}
}

//---------------------------------------------------------
// Setup & Onboarding API Functions (Updated for finalized backend)
//---------------------------------------------------------
export async function query_setup_status(): Promise<ISetupStatus | undefined> {
	const resp = await GET_OAM<OamGetResp<'/oam/setup/status'>>('/setup/status');
	// Its two callers in utils/simpleSetup.ts already catch and fail open, so
	// this changes no behaviour at start-up — it stops a 500 from being
	// reported to them as "setup is not needed", which is a different claim.
	assertOk(resp, 'Get Setup Status');
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
