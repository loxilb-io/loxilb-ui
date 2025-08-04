//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {filterUnusedParams} from 'common';
import {DELETE, GET, PATCH, POST, PUT, SimpleResponse} from './fetcher_base';

//---------------------------------------------------------
// Custom Fetchers
//---------------------------------------------------------
export async function GET_OAM(url: string, params?: Record<string, any>): Promise<SimpleResponse> {
	const full_url = `${process.env.REACT_APP_API_URL}${url}`;
	return await GET(full_url, params);
}

export async function POST_OAM(url: string, data?: any): Promise<SimpleResponse> {
	const full_url = `${process.env.REACT_APP_API_URL}${url}`;

	const filteredData = filterUnusedParams(data);
	return await POST(full_url, filteredData);
}

export async function PUT_OAM(url: string, data?: any): Promise<SimpleResponse> {
	const full_url = `${process.env.REACT_APP_API_URL}${url}`;
	return await PUT(full_url, data);
}

export async function PATCH_OAM(url: string, data?: any, contentType?: 'application/json' | 'multipart/form-data'): Promise<SimpleResponse> {
	const full_url = `${process.env.REACT_APP_API_URL}${url}`;
	return await PATCH(full_url, data, contentType);
}

export async function DELETE_OAM(url: string): Promise<SimpleResponse> {
	const full_url = `${process.env.REACT_APP_API_URL}${url}`;
	return await DELETE(full_url);
}
