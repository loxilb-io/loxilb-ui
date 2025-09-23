//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {forced_relocation_to_login, get_local_storage, move_404, move_402, move_500, move_cors, remove_local_storage, save_local_storage} from 'common';

//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface RequestOptions {
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	body?: any;
	headers?: Record<string, string>;
}

export interface SimpleResponse {
	code: number;
	data: any;
	message: string;
	headers?: Headers;
}

export type ApiResult = {
	status: 'success' | 'error';
	error?: string;
};

//---------------------------------------------------------
// Functions
//---------------------------------------------------------
export function save_token(token: string) {
	save_local_storage('access_token', token);
}

export function load_token(): string {
	const access_token = get_local_storage('access_token') ?? '';
	return access_token;
}

export function check_token(): boolean {
	const access_token = get_local_storage('access_token');
	return typeof access_token !== 'undefined';
}

export function remove_token() {
	remove_local_storage('access_token');
}

async function fetch_data(url: string, options?: RequestOptions): Promise<Response> {
	const access_token = load_token();

	const defaultOptions: RequestOptions = {method: 'GET'};

	const mergedOptions = {
		...defaultOptions,
		...options,
		headers: {
			Accept: 'application/json',
			Authorization: `Bearer ${access_token}`,
			'Content-Type': options?.headers?.['Content-Type'] || 'application/json',
			...(options?.headers || {}),
		} as Record<string, string>,
	};

	if (!access_token) delete mergedOptions.headers.Authorization;

	if (mergedOptions.body && typeof mergedOptions.body === 'object') {
		if (mergedOptions.method === 'GET') {
			const params = new URLSearchParams();
			for (const [key, value] of Object.entries(mergedOptions.body)) params.append(key, value as string);
			url += `?${params.toString()}`;
			delete mergedOptions.body;
		} else if (mergedOptions.headers['Content-Type'] === 'multipart/form-data') delete mergedOptions.headers['Content-Type'];
		else mergedOptions.body = JSON.stringify(mergedOptions.body);
	}

	try {
		const resp = await fetch(url, mergedOptions);

		if (resp.status === 204) return resp; // No content response
		if (resp.status === 401 || resp.status === 403) {
			// Do not force-redirect when the request itself is for the login endpoint,
			// so we can surface server error messages (e.g., Invalid credentials) in the UI.
			const isLoginRequest = typeof url === 'string' && /\/login(?:\b|\/)/.test(url);
			if (!isLoginRequest) {
				remove_token();
				forced_relocation_to_login();
			}
			return resp;
		} else if (resp.status === 402) move_402();
		else if (resp.status === 404) move_404();
		else if (resp.status >= 500 && resp.status < 600 && resp.status !== 502) {
			const resp_json = await resp.json();
			const code = resp.status;
			const message = resp_json.message || resp.statusText;
			move_500(code, message);
		}

		return resp;
	} catch (error: any) {
		// Only redirect to CORS page for actual CORS-related errors, not general network failures
		if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
			// Check if this is likely a CORS issue vs network issue
			// CORS errors typically happen immediately, network errors after timeout
			const isCorsError = error.message.includes('CORS') || 
							   error.message.includes('cross-origin') ||
							   error.message.includes('preflight');
			
			if (isCorsError) {
				move_cors();
			} else {
				// For network failures, don't redirect - let React Query handle retries
				console.warn('Network request failed:', error.message);
			}
		} else {
			move_500(500, error.message);
		}
		throw error; // Re-throw the error for further handling if needed
	}
}

async function handle_response(response: any): Promise<SimpleResponse> {
	if (response.status === 404) move_404();
	else {
		try {
			const cc = response.clone();
			const resp_json = await cc.json();
			return {
				code: response.status, 
				data: resp_json, 
				message: response.statusText || resp_json.result,
				headers: response.headers
			};
		} catch (error) {
			return {
				code: response.status, 
				data: null, 
				message: response.statusText,
				headers: response.headers
			};
		}
	}

	return {
		code: response.status, 
		data: null, 
		message: response.statusText,
		headers: response.headers
	};
}

async function fetch_json(url: string, options?: RequestOptions): Promise<SimpleResponse> {
	const resp = await fetch_data(url, options);
	return await handle_response(resp);
}

export async function GET(url: string, params?: Record<string, any>): Promise<SimpleResponse> {
	return await fetch_json(url, {method: 'GET', body: params});
}

export async function POST(url: string, data?: any, contentType?: 'application/json' | 'multipart/form-data'): Promise<SimpleResponse> {
	const headers = contentType ? {'Content-Type': contentType} : undefined;
	return await fetch_json(url, {method: 'POST', body: data, headers});
}

export async function PUT(url: string, data: any): Promise<SimpleResponse> {
	return await fetch_json(url, {method: 'PUT', body: data});
}

export async function PATCH(url: string, data?: any, contentType?: 'application/json' | 'multipart/form-data'): Promise<SimpleResponse> {
	const headers = contentType ? {'Content-Type': contentType} : undefined;
	return await fetch_json(url, {method: 'PATCH', body: data, headers});
}

export async function DELETE(url: string, data?: any, contentType?: 'application/json' | 'multipart/form-data'): Promise<SimpleResponse> {
	const headers = contentType ? {'Content-Type': contentType} : undefined;
	return await fetch_json(url, {method: 'DELETE', body: data, headers});
}

//---------------------------------------------------------
// File Operations
//---------------------------------------------------------
export async function UPLOAD_FILE(url: string, file: File, additionalData?: Record<string, string>): Promise<SimpleResponse> {
	const access_token = load_token();
	const formData = new FormData();
	formData.append('file', file);
	
	if (additionalData) {
		Object.entries(additionalData).forEach(([key, value]) => {
			formData.append(key, value);
		});
	}
	
	try {
		const headers: Record<string, string> = {};
		
		if (access_token) {
			headers['Authorization'] = `Bearer ${access_token}`;
		}
		
		const response = await fetch(url, {
			method: 'POST',
			headers,
			body: formData
		});
		
		return await handle_response(response);
	} catch (error: any) {
		console.error('Upload file error:', error);
		throw error;
	}
}

export async function DOWNLOAD_FILE(url: string): Promise<{blob: Blob, filename: string} | undefined> {
	try {
		const access_token = load_token();
		const headers: Record<string, string> = {
			'Accept': 'application/octet-stream'
		};
		
		if (access_token) {
			headers['Authorization'] = `Bearer ${access_token}`;
		}
		
		const response = await fetch(url, {
			method: 'GET',
			headers
		});

		if (response.ok) {
			// Check if the response is actually a file
			const contentType = response.headers.get('Content-Type');
			if (contentType && contentType.includes('text/html')) {
				console.error('Received HTML instead of file - likely a routing error or authentication issue');
				return undefined;
			}
			
			// Extract filename from Content-Disposition header
			const contentDisposition = response.headers.get('Content-Disposition');
			let filename = 'download'; // fallback filename
			
			if (contentDisposition) {
				// Try multiple patterns to extract filename
				let filenameMatch = contentDisposition.match(/filename\s*=\s*"([^"]+)"/);
				if (!filenameMatch) {
					filenameMatch = contentDisposition.match(/filename\s*=\s*([^;\s]+)/);
				}
				if (filenameMatch && filenameMatch[1]) {
					filename = filenameMatch[1].trim().replace(/['"]/g, '');
				}
			}
			
			const blob = await response.blob();
			return { blob, filename };
		} else {
			console.error('Download failed:', response.status, response.statusText);
		}
	} catch (error) {
		console.error('Download file error:', error);
	}
	
	return undefined;
}
