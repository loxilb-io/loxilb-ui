//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {filterUnusedParams} from 'common';
import {IInstance} from 'types/oam';
import {getProxiedUrl} from 'utils/apiProxy';
import {DELETE, GET, PATCH, POST, PUT, SimpleResponse} from './fetcher_base';

//---------------------------------------------------------
// Custom Fetchers
//---------------------------------------------------------
export async function GET_INST(instance: IInstance, url: string, params?: Record<string, any>): Promise<SimpleResponse> {
	const base_url = instance.api_endpoint;
	const full_url = `${base_url}${url}`;
	
	// Use the new OAM proxy pattern with instance ID
	const proxied_url = getProxiedUrl(full_url, instance.id);
	return await GET(proxied_url, params);
}

export async function POST_INST(instance: IInstance, url: string, data?: any, contentType?: 'application/json' | 'multipart/form-data'): Promise<SimpleResponse> {
	const base_url = instance.api_endpoint;
	const full_url = `${base_url}${url}`;
	
	// Use the new OAM proxy pattern with instance ID
	const proxied_url = getProxiedUrl(full_url, instance.id);
	return await POST(proxied_url, data, contentType);
}

export async function PUT_INST(instance: IInstance, url: string, data: any): Promise<SimpleResponse> {
	const base_url = instance.api_endpoint;
	const full_url = `${base_url}${url}`;
	
	// Use the new OAM proxy pattern with instance ID
	const proxied_url = getProxiedUrl(full_url, instance.id);
	return await PUT(proxied_url, data);
}

export async function PATCH_INST(instance: IInstance, url: string, data?: any, contentType?: 'application/json' | 'multipart/form-data'): Promise<SimpleResponse> {
	const base_url = instance.api_endpoint;
	const full_url = `${base_url}${url}`;
	
	// Use the new OAM proxy pattern with instance ID
	const proxied_url = getProxiedUrl(full_url, instance.id);
	return await PATCH(proxied_url, data, contentType);
}

export async function DELETE_INST(instance: IInstance, url: string, data?: any, contentType?: 'application/json' | 'multipart/form-data'): Promise<SimpleResponse> {
	const base_url = instance.api_endpoint;
	const full_url = `${base_url}${url}`;
	
	// Use the new OAM proxy pattern with instance ID
	const proxied_url = getProxiedUrl(full_url, instance.id);
	return await DELETE(proxied_url, data, contentType);
}
