//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {parse_log_lines} from 'common';
import {ILog, ILogArchiveList} from 'types/log';
import {IInstance, IInstanceInput, IUser} from 'types/oam';
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
