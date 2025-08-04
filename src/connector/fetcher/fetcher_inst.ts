//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {filterUnusedParams} from 'common';
import {IInstance} from 'types/oam';
import {DELETE, GET, PATCH, POST, PUT, SimpleResponse} from './fetcher_base';

//---------------------------------------------------------
// Custom Fetchers
//---------------------------------------------------------
export async function GET_INST(instance: IInstance, url: string, params?: Record<string, any>): Promise<SimpleResponse> {
	const base_url = instance.api_endpoint;
	const full_url = `${base_url}${url}`;
	return await GET(full_url, params);
}

export async function POST_INST(instance: IInstance, url: string, data?: any): Promise<SimpleResponse> {
	const base_url = instance.api_endpoint;
	const full_url = `${base_url}${url}`;

	const filteredData = filterUnusedParams(data);
	return await POST(full_url, filteredData);
}

export async function PUT_INST(instance: IInstance, url: string, data: any): Promise<SimpleResponse> {
	const base_url = instance.api_endpoint;
	const full_url = `${base_url}${url}`;
	return await PUT(full_url, data);
}

export async function PATCH_INST(instance: IInstance, url: string, data?: any, contentType?: 'application/json' | 'multipart/form-data'): Promise<SimpleResponse> {
	const base_url = instance.api_endpoint;
	const full_url = `${base_url}${url}`;
	return await PATCH(full_url, data, contentType);
}

export async function DELETE_INST(instance: IInstance, url: string, data?: any, contentType?: 'application/json' | 'multipart/form-data'): Promise<SimpleResponse> {
	const base_url = instance.api_endpoint;
	const full_url = `${base_url}${url}`;
	return await DELETE(full_url, data, contentType);
}
