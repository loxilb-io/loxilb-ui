//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {IInstance} from 'types/oam';
import {getApiBaseUrl} from 'utils/apiProxy';
import {DELETE, GET, GET_TEXT, PATCH, POST, PUT, SimpleResponse} from './fetcher_base';

//---------------------------------------------------------
// Custom Fetchers
//---------------------------------------------------------
export async function GET_INST<T = any>(instance: IInstance, url: string, params?: Record<string, any>): Promise<SimpleResponse<T>> {
	// Use the OAM proxy pattern directly
	const oam_base_url = getApiBaseUrl(); // Gets from REACT_APP_API_URL
	const proxied_url = `${oam_base_url}/loxilbs/${instance.id}/netlox/v1${url}`;
	return await GET<T>(proxied_url, params);
}

export async function GET_INST_TEXT(instance: IInstance, url: string, params?: Record<string, any>): Promise<SimpleResponse<string>> {
	// Use the OAM proxy pattern directly
	const oam_base_url = getApiBaseUrl(); // Gets from REACT_APP_API_URL
	const proxied_url = `${oam_base_url}/loxilbs/${instance.id}/netlox/v1${url}`;
	return await GET_TEXT(proxied_url, params);
}

export async function POST_INST<T = any>(instance: IInstance, url: string, data?: any, contentType?: 'application/json' | 'multipart/form-data'): Promise<SimpleResponse<T>> {
	// Use the OAM proxy pattern directly
	const oam_base_url = getApiBaseUrl(); // Gets from REACT_APP_API_URL
	const proxied_url = `${oam_base_url}/loxilbs/${instance.id}/netlox/v1${url}`;
	return await POST<T>(proxied_url, data, contentType);
}

export async function PUT_INST<T = any>(instance: IInstance, url: string, data: any): Promise<SimpleResponse<T>> {
	// Use the OAM proxy pattern directly
	const oam_base_url = getApiBaseUrl(); // Gets from REACT_APP_API_URL
	const proxied_url = `${oam_base_url}/loxilbs/${instance.id}/netlox/v1${url}`;
	return await PUT<T>(proxied_url, data);
}

export async function PATCH_INST<T = any>(instance: IInstance, url: string, data?: any, contentType?: 'application/json' | 'multipart/form-data'): Promise<SimpleResponse<T>> {
	// Use the OAM proxy pattern directly
	const oam_base_url = getApiBaseUrl(); // Gets from REACT_APP_API_URL
	const proxied_url = `${oam_base_url}/loxilbs/${instance.id}/netlox/v1${url}`;
	return await PATCH<T>(proxied_url, data, contentType);
}

export async function DELETE_INST<T = any>(instance: IInstance, url: string, data?: any, contentType?: 'application/json' | 'multipart/form-data'): Promise<SimpleResponse<T>> {
	// Use the OAM proxy pattern directly
	const oam_base_url = getApiBaseUrl(); // Gets from REACT_APP_API_URL
	const proxied_url = `${oam_base_url}/loxilbs/${instance.id}/netlox/v1${url}`;
	return await DELETE<T>(proxied_url, data, contentType);
}
