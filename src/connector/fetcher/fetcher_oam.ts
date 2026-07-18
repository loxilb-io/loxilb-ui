//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {filterUnusedParams} from 'common';
import {DELETE, GET, POST, PUT, SimpleResponse, UPLOAD_FILE, DOWNLOAD_FILE} from './fetcher_base';

//---------------------------------------------------------
// Custom Fetchers
//---------------------------------------------------------
export async function GET_OAM<T = any>(url: string, params?: Record<string, any>): Promise<SimpleResponse<T>> {
	const full_url = `${process.env.REACT_APP_API_URL}${url}`;
	return await GET<T>(full_url, params);
}

export async function POST_OAM<T = any>(url: string, data?: any): Promise<SimpleResponse<T>> {
	const full_url = `${process.env.REACT_APP_API_URL}${url}`;

	const filteredData = filterUnusedParams(data);
	return await POST<T>(full_url, filteredData);
}

export async function PUT_OAM<T = any>(url: string, data?: any): Promise<SimpleResponse<T>> {
	const full_url = `${process.env.REACT_APP_API_URL}${url}`;
	return await PUT<T>(full_url, data);
}

export async function DELETE_OAM<T = any>(url: string): Promise<SimpleResponse<T>> {
	const full_url = `${process.env.REACT_APP_API_URL}${url}`;
	return await DELETE<T>(full_url);
}

//---------------------------------------------------------
// File Operations
//---------------------------------------------------------
export async function UPLOAD_FILE_OAM(url: string, file: File, additionalData?: Record<string, string>): Promise<SimpleResponse> {
	const full_url = `${process.env.REACT_APP_API_URL}${url}`;
	return await UPLOAD_FILE(full_url, file, additionalData);
}

export async function DOWNLOAD_FILE_OAM(url: string): Promise<{blob: Blob, filename: string} | undefined> {
	const full_url = `${process.env.REACT_APP_API_URL}${url}`;
	return await DOWNLOAD_FILE(full_url);
}
