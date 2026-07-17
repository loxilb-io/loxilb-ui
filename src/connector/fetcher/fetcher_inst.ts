//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {filterUnusedParams} from 'common';
import {IInstance} from 'types/oam';
import {getProxiedUrl, getApiBaseUrl} from 'utils/apiProxy';
import {DELETE, GET, GET_TEXT, PATCH, POST, PUT, SimpleResponse} from './fetcher_base';

//---------------------------------------------------------
// Custom Fetchers
//---------------------------------------------------------
export async function GET_INST(instance: IInstance, url: string, params?: Record<string, any>): Promise<SimpleResponse> {
	// Use the OAM proxy pattern directly
	const oam_base_url = getApiBaseUrl(); // Gets from REACT_APP_API_URL
	const proxied_url = `${oam_base_url}/loxilbs/${instance.id}/netlox/v1${url}`;
	return await GET(proxied_url, params);
}

export async function GET_INST_TEXT(instance: IInstance, url: string, params?: Record<string, any>): Promise<SimpleResponse> {
	// Use the OAM proxy pattern directly
	const oam_base_url = getApiBaseUrl(); // Gets from REACT_APP_API_URL
	const proxied_url = `${oam_base_url}/loxilbs/${instance.id}/netlox/v1${url}`;
	return await GET_TEXT(proxied_url, params);
}

export async function POST_INST(instance: IInstance, url: string, data?: any, contentType?: 'application/json' | 'multipart/form-data'): Promise<SimpleResponse> {
	// Use the OAM proxy pattern directly
	const oam_base_url = getApiBaseUrl(); // Gets from REACT_APP_API_URL
	const proxied_url = `${oam_base_url}/loxilbs/${instance.id}/netlox/v1${url}`;
	return await POST(proxied_url, data, contentType);
}

export async function PUT_INST(instance: IInstance, url: string, data: any): Promise<SimpleResponse> {
	// Use the OAM proxy pattern directly
	const oam_base_url = getApiBaseUrl(); // Gets from REACT_APP_API_URL
	const proxied_url = `${oam_base_url}/loxilbs/${instance.id}/netlox/v1${url}`;
	return await PUT(proxied_url, data);
}

export async function PATCH_INST(instance: IInstance, url: string, data?: any, contentType?: 'application/json' | 'multipart/form-data'): Promise<SimpleResponse> {
	// Use the OAM proxy pattern directly
	const oam_base_url = getApiBaseUrl(); // Gets from REACT_APP_API_URL
	const proxied_url = `${oam_base_url}/loxilbs/${instance.id}/netlox/v1${url}`;
	return await PATCH(proxied_url, data, contentType);
}

export async function DELETE_INST(instance: IInstance, url: string, data?: any, contentType?: 'application/json' | 'multipart/form-data'): Promise<SimpleResponse> {
	// Use the OAM proxy pattern directly
	const oam_base_url = getApiBaseUrl(); // Gets from REACT_APP_API_URL
	const proxied_url = `${oam_base_url}/loxilbs/${instance.id}/netlox/v1${url}`;
	return await DELETE(proxied_url, data, contentType);
}
