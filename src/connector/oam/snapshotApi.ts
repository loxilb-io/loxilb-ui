//---------------------------------------------------------
// Instance snapshot orchestration API (docs/SNAPSHOT_UI_DESIGN.md §6).
//
// All endpoints are OAM's — the UI never talks to the gateway's
// /config/snapshot|restore directly; OAM proxies, stores and audits.
// Reads throw through assertOk (inline error banner); mutations return
// ApiResult with createDetailedErrorMessage payloads.
//---------------------------------------------------------
import type {OamGetResp, OamPostResp} from 'api';
import {ISnapshot, ISnapshotList, ISnapshotSchedule, IRestoreOutcomeParsed} from 'types/snapshot';
import {ApiResult, assertOk, createDetailedErrorMessage, DOWNLOAD_FILE_STREAM, DownloadProgress} from '../fetcher/fetcher_base';
import {DELETE_OAM, GET_OAM, PATCH_OAM, POST_OAM, PUT_OAM, UPLOAD_FILE_OAM} from '../fetcher/fetcher_oam';
import {getApiBaseUrl} from 'utils/apiProxy';

//---------------------------------------------------------
// Reads
//---------------------------------------------------------
export async function query_get_snapshots(instanceId: number, params?: {page?: number; limit?: number}): Promise<ISnapshotList> {
	const resp = await GET_OAM<OamGetResp<'/oam/instances/{id}/snapshots'>>(`/instances/${instanceId}/snapshots`, params);
	assertOk(resp, 'Get Snapshots');
	return (resp.data ?? {data: []}) as ISnapshotList;
}

export async function query_get_snapshot(sid: string): Promise<ISnapshot | undefined> {
	const resp = await GET_OAM<OamGetResp<'/oam/snapshots/{sid}'>>(`/snapshots/${sid}`);
	assertOk(resp, 'Get Snapshot');
	return (resp.data ?? undefined) as ISnapshot | undefined;
}

export async function query_get_snapshot_schedule(instanceId: number): Promise<ISnapshotSchedule | undefined> {
	const resp = await GET_OAM<OamGetResp<'/oam/instances/{id}/snapshot-schedule'>>(`/instances/${instanceId}/snapshot-schedule`);
	assertOk(resp, 'Get Snapshot Schedule');
	return (resp.data ?? undefined) as ISnapshotSchedule | undefined;
}

//---------------------------------------------------------
// Mutations
//---------------------------------------------------------
export type SnapshotMutationResult = ApiResult & {snapshot?: ISnapshot};

// fetch_data RETHROWS network-level failures (OAM host unreachable) instead
// of returning a SimpleResponse. An uncaught rejection here would strand the
// UI mid-flow — the restore wizard's non-dismissable "committing" screen
// being the worst case (found by §9.3 case 3). Every mutation converts a
// thrown error into an honest ApiResult instead.
function caught(operation: string, e: unknown): {status: 'error'; error: string} {
	const msg = e instanceof Error ? e.message : String(e);
	return {status: 'error', error: `${operation} failed: ${msg} (server unreachable)`};
}

export async function request_take_snapshot(
	instanceId: number,
	data: {name: string; description?: string; trigger_type?: string},
): Promise<SnapshotMutationResult> {
	try {
		const resp = await POST_OAM<OamPostResp<'/oam/instances/{id}/snapshots'>>(`/instances/${instanceId}/snapshots`, data);
		if (resp.code !== 201) return {status: 'error', error: createDetailedErrorMessage(resp, 'Take Snapshot')};
		return {status: 'success', snapshot: (resp.data ?? undefined) as ISnapshot | undefined};
	} catch (e) {
		return caught('Take Snapshot', e);
	}
}

export async function request_upload_snapshot(
	instanceId: number,
	file: File,
	meta?: {name?: string; description?: string},
): Promise<SnapshotMutationResult> {
	try {
		const extra: Record<string, string> = {};
		if (meta?.name) extra.name = meta.name;
		if (meta?.description) extra.description = meta.description;
		const resp = await UPLOAD_FILE_OAM(`/instances/${instanceId}/snapshots/upload`, file, extra);
		if (resp.code !== 201) return {status: 'error', error: createDetailedErrorMessage(resp, 'Upload Snapshot')};
		return {status: 'success', snapshot: (resp.data ?? undefined) as ISnapshot | undefined};
	} catch (e) {
		return caught('Upload Snapshot', e);
	}
}

// OAM answers 200 with the outcome even when the gateway restore itself
// failed or rolled back — the truth is in outcome.gateway_status and
// outcome.gateway_response (rendered verbatim by the wizard). Non-200 here
// means OAM refused before reaching the apply stage (integrity 422, gateway
// unreachable 502, pre-restore snapshot failure 502, …).
export type RestoreCallResult = {status: 'success'; outcome: IRestoreOutcomeParsed} | {status: 'error'; error: string};

export async function request_restore_snapshot(
	sid: string,
	mode: 'dry-run' | 'commit',
	targetInstanceId?: number,
): Promise<RestoreCallResult> {
	try {
		const body: {mode: string; target_instance_id?: number} = {mode};
		if (targetInstanceId !== undefined) body.target_instance_id = targetInstanceId;
		const resp = await POST_OAM<OamPostResp<'/oam/snapshots/{sid}/restore'>>(`/snapshots/${sid}/restore`, body);
		if (resp.code !== 200 || !resp.data) return {status: 'error', error: createDetailedErrorMessage(resp, `Restore Snapshot (${mode})`)};
		return {status: 'success', outcome: resp.data as IRestoreOutcomeParsed};
	} catch (e) {
		return caught(`Restore Snapshot (${mode})`, e);
	}
}

export async function request_patch_snapshot(
	sid: string,
	data: {name?: string; description?: string; pinned?: boolean},
): Promise<SnapshotMutationResult> {
	try {
		const resp = await PATCH_OAM(`/snapshots/${sid}`, data);
		if (resp.code !== 200) return {status: 'error', error: createDetailedErrorMessage(resp, 'Update Snapshot')};
		return {status: 'success', snapshot: (resp.data ?? undefined) as ISnapshot | undefined};
	} catch (e) {
		return caught('Update Snapshot', e);
	}
}

// The UI deliberately has no force=true path: deleting a pinned snapshot is
// blocked until the user unpins it (design §5.3 — mirror the API's force
// semantics instead of silently overriding them).
export async function request_delete_snapshot(sid: string): Promise<ApiResult> {
	try {
		const resp = await DELETE_OAM(`/snapshots/${sid}`);
		if (resp.code !== 200) return {status: 'error', error: createDetailedErrorMessage(resp, 'Delete Snapshot')};
		return {status: 'success'};
	} catch (e) {
		return caught('Delete Snapshot', e);
	}
}

export async function request_put_snapshot_schedule(
	instanceId: number,
	data: {enabled: boolean; interval_hours: number; retain_count: number},
): Promise<ApiResult & {schedule?: ISnapshotSchedule}> {
	try {
		const resp = await PUT_OAM(`/instances/${instanceId}/snapshot-schedule`, data);
		if (resp.code !== 200) return {status: 'error', error: createDetailedErrorMessage(resp, 'Update Snapshot Schedule')};
		return {status: 'success', schedule: (resp.data ?? undefined) as ISnapshotSchedule | undefined};
	} catch (e) {
		return caught('Update Snapshot Schedule', e);
	}
}

//---------------------------------------------------------
// Download
//---------------------------------------------------------
// Streams GET /oam/snapshots/{sid}/download to the browser's save dialog.
// DOWNLOAD_FILE_STREAM THROWS on HTTP errors with the server body — callers
// must catch and surface it (honest failures; the legacy page's silent
// console.error download bug is the anti-pattern). The server's
// Content-Disposition filename wins when readable; fall back to the
// snapshot name.
export async function request_download_snapshot(sid: string, snapshotName: string, onProgress?: (p: DownloadProgress) => void): Promise<void> {
	const full_url = `${getApiBaseUrl()}/snapshots/${sid}/download`;
	await DOWNLOAD_FILE_STREAM(full_url, `${snapshotName || sid}.json`, onProgress);
}
