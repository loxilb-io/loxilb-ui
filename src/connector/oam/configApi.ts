//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {
  ExportRequest,
  ExportListResponse,
  FileListResponse
} from 'types/config';
import {ApiResult} from '../fetcher/fetcher_base';
import {GET_OAM, POST_OAM, DELETE_OAM, UPLOAD_FILE_OAM, DOWNLOAD_FILE_OAM} from '../fetcher/fetcher_oam';
import type {OamGetResp} from 'api';

//---------------------------------------------------------
// Configuration Export Functions
//---------------------------------------------------------
export async function request_export_config(request: ExportRequest): Promise<ApiResult> {
  const resp = await POST_OAM('/config/export', request);
  if (resp.code === 200) {
    return {status: 'success'};
  }
  return {status: 'error', error: `Failed to export configuration: ${resp.message}`};
}

export async function query_get_config_exports(): Promise<ExportListResponse | undefined> {
  const resp = await GET_OAM<OamGetResp<'/oam/config/exports'>>('/config/exports');
  if (resp.code === 200) {
    return {
      exports: (resp.data?.exports ?? []) as ExportListResponse['exports'],
      count: resp.data?.count || 0,
      message: resp.data?.message || 'Success'
    };
  }
  return undefined;
}

//---------------------------------------------------------
// Configuration Import Functions  
//---------------------------------------------------------
export async function request_import_config(file: File): Promise<ApiResult> {
  try {
    const resp = await UPLOAD_FILE_OAM('/config/import', file);
    if (resp.code === 200) {
      return {status: 'success'};
    }
    return {status: 'error', error: resp.message || 'Import failed'};
  } catch (error) {
    console.error('Import config error:', error);
    return {status: 'error', error: `Import failed: ${error}`};
  }
}

// Shape of the OAM dry-run response (models.ConfigImportResponseOAM)
export interface ImportDryRunResult {
  success: boolean;
  dry_run?: boolean;
  message?: string;
  errors?: {type?: string; field?: string; message: string; record?: string; record_index?: number}[];
  import_summary?: {
    instances_imported?: number;
    instances_skipped?: number;
    users_imported?: number;
    users_skipped?: number;
    settings_updated?: number;
    trial_history_imported?: number;
    trial_history_skipped?: number;
  };
}

export async function request_validate_import_config(file: File): Promise<ApiResult & {result?: ImportDryRunResult}> {
  try {
    const resp = await UPLOAD_FILE_OAM('/config/import/dry-run', file);
    if (resp.code === 200) {
      // Response body is {message, result: ConfigImportResponseOAM}
      const result = (resp.data?.result ?? resp.data) as ImportDryRunResult;
      return {status: 'success', result};
    }
    return {status: 'error', error: resp.message || 'Validation failed'};
  } catch (error) {
    console.error('Validate import error:', error);
    return {status: 'error', error: `Validation failed: ${error}`};
  }
}

//---------------------------------------------------------
// Configuration File Management Functions
//---------------------------------------------------------
export async function query_get_config_files(params?: {
  limit?: number;
  offset?: number; 
  exported_by?: string;
}): Promise<FileListResponse | undefined> {
  let url = '/config/files';
  
  if (params) {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    if (params.exported_by) searchParams.set('exported_by', params.exported_by);
    
    if (searchParams.toString()) {
      url += `?${searchParams.toString()}`;
    }
  }

  const resp = await GET_OAM<OamGetResp<'/oam/config/files'>>(url);
  if (resp.code === 200) {
    return (resp.data ?? undefined) as FileListResponse | undefined;
  }
  return undefined;
}

export async function request_delete_config_file(exportId: string): Promise<ApiResult> {
  const resp = await DELETE_OAM(`/config/files/${exportId}`);
  if (resp.code === 200 || resp.code === 204) {
    return {status: 'success'};
  }
  return {status: 'error', error: resp.data?.error || resp.message || 'Failed to delete configuration file'};
}

export async function request_download_config_file(exportId: string): Promise<{blob: Blob, filename: string} | undefined> {
  try {
    const result = await DOWNLOAD_FILE_OAM(`/config/download/${exportId}`);
    if (result) {
      // If the filename is still the generic "download", use a better fallback
      if (result.filename === 'download') {
        result.filename = `config-${exportId}.json`;
      }
      return result;
    }
  } catch (error) {
    console.error('Download config file error:', error);
  }
  
  return undefined;
}
