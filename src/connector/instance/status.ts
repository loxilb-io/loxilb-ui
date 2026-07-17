//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {clean_string, format_uptime, parse_log_lines} from 'common';
import {ApiResult, createDetailedErrorMessage, DOWNLOAD_FILE_STREAM, DownloadProgress} from 'connector/fetcher/fetcher_base';
import {t} from 'i18next';
import {ISystemInfo} from 'types/device';
import {IFilesystemAttribute} from 'types/filesystem';
import {IVipAttribute} from 'types/ha';
import {ILog, ILogArchiveList, LevelType} from 'types/log';
import {IInstance} from 'types/oam';
import {IProcessAttribute} from 'types/process';
import {GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import { getApiBaseUrl } from 'utils/apiProxy';
import type {GwGetResp, GwSchema} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_filesystem_status(instance: IInstance): Promise<IFilesystemAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/status/filesystem'>>(instance, `/status/filesystem`);
	return (resp.data?.filesystemAttr ?? []) as IFilesystemAttribute[];
}

export async function query_get_process_status(instance: IInstance): Promise<IProcessAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/status/process'>>(instance, `/status/process`);
	return (resp.data?.processAttr ?? []) as IProcessAttribute[];
}

export async function query_get_device_status(instance: IInstance): Promise<ISystemInfo> {
	const resp = await GET_INST<GwGetResp<'/status/device'>>(instance, `/status/device`);

	if (resp.data) {
		const system_info = resp.data as ISystemInfo;

		const system_info_cleaned: ISystemInfo = {
			hostName: clean_string(system_info.hostName),
			kernel: clean_string(system_info.kernel),
			machineID: system_info.machineID ? clean_string(system_info.machineID) : t('Unknown'),
			architecture: clean_string(system_info.architecture),
			bootID: clean_string(system_info.bootID),
			uptime: format_uptime(system_info.uptime),
			OS: clean_string(system_info.OS),
		};

		return system_info_cleaned;
	} else {
		return {
			hostName: t('Unknown'),
			kernel: t('Unknown'),
			machineID: t('Unknown'),
			architecture: t('Unknown'),
			bootID: t('Unknown'),
			uptime: t('Unknown'),
			OS: t('Unknown'),
		};
	}
}

export async function query_get_ha_state_all(instance: IInstance): Promise<IVipAttribute[]> {
	const resp = await GET_INST<GwGetResp<'/config/cistate/all'>>(instance, `/config/cistate/all`);
	return (resp.data?.Attr ?? []) as IVipAttribute[];
}

// not for frontend use, only for backend to update HA state
export async function request_update_ha_state(instance: IInstance, data: IVipAttribute): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/cistate`, data);
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'Update HA State');
		return {status: 'error', error: errorMessage};
	} else {
		return {status: 'success'};
	}
}

export async function query_get_metadata(instance: IInstance): Promise<any> {
	const resp = await GET_INST<GwGetResp<'/meta'>>(instance, `/meta`);
	return resp.data ?? {};
}

export async function request_post_log_level(instance: IInstance, level: LevelType): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/params`, {logLevel: level});
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'Status Operation');
		return {status: 'error', error: errorMessage};
	}
	else return {status: 'success'};
}

export async function query_get_log_level(instance: IInstance): Promise<Partial<GwSchema<'OperParams'>>> {
	const resp = await GET_INST<GwGetResp<'/config/params'>>(instance, `/config/params`);
	return resp.data ?? {};
}

// Map UI level names to API level codes
function mapLevelToApiCode(level: string): string {
	switch (level.toLowerCase()) {
		case 'debug': return 'DBG';
		case 'info': return 'INFO';
		case 'error': return 'ERR';
		case 'warning': return 'WARN';
		case 'critical': return 'CRITICAL';
		default: return level.toUpperCase();
	}
}

export async function query_get_inst_logs(instance: IInstance, options?: {
	lines?: number;
	level?: string;
	keyword?: string;
	cursor?: string;
	enableAutoRefresh?: boolean;
}): Promise<{logs: ILog[], next_cursor?: string, has_more: boolean, count?: number}> {
	// Build query parameters for single request
	const params = new URLSearchParams();
	// Default to 1000 logs per request
	params.append('lines', (options?.lines || 1000).toString());
	// Convert UI level to API level code
	if (options?.level) params.append('level', mapLevelToApiCode(options.level));
	if (options?.keyword) params.append('keyword', options.keyword);
	if (options?.cursor) params.append('cursor', options.cursor);
	
	const queryString = params.toString();
	const endpoint = `/logs${queryString ? `?${queryString}` : ''}`;
	
	const resp = await GET_INST<GwGetResp<'/logs'>>(instance, endpoint);

	const log_strings = resp.data?.logs;
	if (!log_strings) return {logs: [], has_more: false};
	
	const logs: ILog[] = parse_log_lines(log_strings);
	
	// Get pagination info from response body
	const next_cursor = resp.data?.next_cursor || undefined;
	const has_more = resp.data?.has_more || false;
	const count = resp.data?.log_count || undefined;
	
	return {
		logs,
		next_cursor,
		has_more,
		count
	};
}

export async function query_get_inst_log_archives(instance: IInstance): Promise<ILogArchiveList> {
	const resp = await GET_INST<GwGetResp<'/log-archives'>>(instance, `/log-archives`);
	if (resp.code !== 200 && resp.code !== 204) return {archives: []};
	return (resp.data ?? {archives: []}) as ILogArchiveList;
}

export async function download_inst_log_archive(
	instance: IInstance | null,
	filename: string,
	onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
	if (!instance) return;

	// Use OAM Proxy pattern
	const oam_base_url = getApiBaseUrl();
	const proxied_url = `${oam_base_url}/loxilbs/${instance.id}/netlox/v1/log-archives/${filename}`;
	await DOWNLOAD_FILE_STREAM(proxied_url, filename, onProgress);
}

export async function query_instance_health(instance: IInstance): Promise<{isHealthy: boolean; error?: string}> {
	try {
		// Use proxy API pattern instead of direct endpoint call
		const response = await GET_INST<GwGetResp<'/version'>>(instance, '/version');
		
		// Check if the response indicates success (status code 200-299)
		if (response.code >= 200 && response.code < 300) {
			return {isHealthy: true};
		} else {
			// Non-success status codes indicate unhealthy instance
			return {
				isHealthy: false, 
				error: `Server responded with status ${response.code}: ${response.message}`
			};
		}
	} catch (error) {
		// Handle errors gracefully
		if (error instanceof Error) {
			return {isHealthy: false, error: error.message};
		}
		return {isHealthy: false, error: 'Unknown error'};
	}
}
