//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {forced_relocation_to_login, get_local_storage, move_404, move_403, move_402, move_500, move_503, move_cors, remove_local_storage} from 'common';

//---------------------------------------------------------
// Interfaces
//---------------------------------------------------------
export interface RequestOptions {
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	body?: any;
	headers?: Record<string, string>;
}

// T is the expected 2xx JSON body shape — pass a generated type from
// src/api (e.g. GwGetResp<'/config/loadbalancer/all'>). data is null when
// the body is not parseable JSON, and may be an error body on non-2xx codes.
export interface SimpleResponse<T = any> {
	code: number;
	data: T | null;
	message: string;
	headers?: Headers;
}

export type ApiResult = {
	status: 'success' | 'error';
	error?: string;
};

//---------------------------------------------------------
// Common Error Formatting Function
//---------------------------------------------------------
export function createDetailedErrorMessage(resp: any, operation: string): string {
	const primaryMessage = resp.data?.result || resp.data?.message || resp.data?.error || resp.message || 'Unknown error';

	let message = primaryMessage + '.' + '\n\n';
	message += `Operation is \[${operation}\].\n\n`;
	message += `HTTP Code is \[${resp.code}\].\n\n`;

	if (resp.data?.fields) {
		message += `Fields are : \[${JSON.stringify(resp.data.fields)}\].\n\n`;
	}

	if (resp.data?.message && resp.data.message !== primaryMessage) {
		message += `Message is \[${resp.data.message}\].\n\n`;
	}

	if (resp.data?.result && resp.data.result !== primaryMessage) {
		message += `Result is \[${resp.data.result}\].\n\n`;
	}

	return message;
}

//---------------------------------------------------------
// Functions
//---------------------------------------------------------
export function load_token(): string {
	const access_token = get_local_storage('access_token') ?? '';
	return access_token;
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

		// Gateway pass-through reads (OAM proxy → LoxiLB / inference-gateway;
		// URL .../loxilbs/{id}/netlox/...) must NOT trigger a full-app error-page
		// redirect on 404/5xx. An optional or unimplemented gateway endpoint
		// (e.g. 501 Not Implemented, or 404) would otherwise take down the whole
		// UI instead of letting the feature page degrade to an empty / inline
		// error state (F15). OAM control-plane failures still redirect as before.
		const isGatewayPassthrough = typeof url === 'string' && /\/loxilbs\/\d+\/netlox\//.test(url);
		// if (resp.status === 401 || resp.status === 403) {
		if (resp.status === 401) {
			// Do not force-redirect when the request itself is for the login endpoint,
			// so we can surface server error messages (e.g., Invalid credentials) in the UI.
			const isLoginRequest = typeof url === 'string' && /\/login(?:\b|\/)/.test(url);
			if (!isLoginRequest) {
				remove_token();
				forced_relocation_to_login();
			}
			return resp;
		} else if (resp.status === 403) {
			// Forbidden - user is authenticated but lacks permission or action is forbidden
			// Return response so caller can handle the error message
			return resp;
		} else if (resp.status === 402) move_402();
		else if (resp.status === 404) {
			if (!isGatewayPassthrough) move_404();
		}
		else if (resp.status === 503) {
			if (!isGatewayPassthrough) move_503();
		}
		else if (resp.status >= 500 && resp.status < 600 && resp.status !== 502 && resp.status !== 503) {
			if (!isGatewayPassthrough) {
				const resp_json = await resp.json();
				const code = resp.status;
				const message = resp_json.message || resp.statusText;
				const result = resp_json.result || '';

				// Filter for "not running" messages and redirect to move_503
				if (message.includes('not running') || result.includes('not running')) {
					move_503(code, message);
				} else {
					move_500(code, message);
				}
			}
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

async function handle_response<T = any>(response: any): Promise<SimpleResponse<T>> {
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

async function fetch_json<T = any>(url: string, options?: RequestOptions): Promise<SimpleResponse<T>> {
	const resp = await fetch_data(url, options);
	return await handle_response<T>(resp);
}

export async function GET<T = any>(url: string, params?: Record<string, any>): Promise<SimpleResponse<T>> {
	return await fetch_json<T>(url, {method: 'GET', body: params});
}

// For plain-text endpoints (e.g. Prometheus exposition format) where the
// response body is not JSON; data carries the raw text.
// Note: the gateway's /metrics endpoint returns 406 for `Accept: text/plain`
// (its declared `produces` does not include text/plain) but serves the text
// body for `Accept: */*`, so request that.
export async function GET_TEXT(url: string, params?: Record<string, any>): Promise<SimpleResponse<string>> {
	const resp = await fetch_data(url, {method: 'GET', body: params, headers: {Accept: '*/*'}});
	const text = await resp.text();
	return {
		code: resp.status,
		data: text,
		message: resp.statusText,
		headers: resp.headers,
	};
}

export async function POST<T = any>(url: string, data?: any, contentType?: 'application/json' | 'multipart/form-data'): Promise<SimpleResponse<T>> {
	const headers = contentType ? {'Content-Type': contentType} : undefined;
	return await fetch_json<T>(url, {method: 'POST', body: data, headers});
}

export async function PUT<T = any>(url: string, data: any): Promise<SimpleResponse<T>> {
	return await fetch_json<T>(url, {method: 'PUT', body: data});
}

export async function PATCH<T = any>(url: string, data?: any, contentType?: 'application/json' | 'multipart/form-data'): Promise<SimpleResponse<T>> {
	const headers = contentType ? {'Content-Type': contentType} : undefined;
	return await fetch_json<T>(url, {method: 'PATCH', body: data, headers});
}

export async function DELETE<T = any>(url: string, data?: any, contentType?: 'application/json' | 'multipart/form-data'): Promise<SimpleResponse<T>> {
	const headers = contentType ? {'Content-Type': contentType} : undefined;
	return await fetch_json<T>(url, {method: 'DELETE', body: data, headers});
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

export interface DownloadProgress {
	receivedBytes: number;
	totalBytes: number | null; // null when the server sends no Content-Length
}

// Streams a file download and reports progress, then hands the finished blob
// to the browser's save dialog. Content-Length is CORS-safelisted, so a
// determinate percentage works even for cross-origin OAM/proxy downloads.
// Throws on HTTP errors so callers can surface them.
export async function DOWNLOAD_FILE_STREAM(url: string, fallbackFilename: string, onProgress?: (p: DownloadProgress) => void): Promise<void> {
	const access_token = load_token();
	// Accept must be */*: the gateway's go-swagger negotiator only knows the
	// operation's declared produces (application/json for /log-archives) and
	// returns 406 for application/octet-stream even though the handler streams
	// exactly that — same failure class as the /metrics 406.
	const headers: Record<string, string> = {Accept: '*/*'};
	if (access_token) headers['Authorization'] = `Bearer ${access_token}`;

	const response = await fetch(url, {method: 'GET', headers});
	if (!response.ok) {
		const text = await response.text().catch(() => '');
		throw new Error(`Download failed (${response.status}): ${text || response.statusText}`);
	}

	const lengthHeader = Number(response.headers.get('Content-Length'));
	const totalBytes = Number.isFinite(lengthHeader) && lengthHeader > 0 ? lengthHeader : null;

	// Content-Disposition is not CORS-safelisted, so it may be unreadable on
	// cross-origin downloads — fall back to the caller-provided name.
	let filename = fallbackFilename;
	const contentDisposition = response.headers.get('Content-Disposition');
	const cdMatch = contentDisposition?.match(/filename\s*=\s*"?([^";]+)"?/);
	if (cdMatch?.[1]) filename = cdMatch[1].trim();

	const chunks: BlobPart[] = [];
	let receivedBytes = 0;
	if (response.body) {
		const reader = response.body.getReader();
		for (;;) {
			const {done, value} = await reader.read();
			if (done) break;
			chunks.push(value);
			receivedBytes += value.byteLength;
			onProgress?.({receivedBytes, totalBytes});
		}
	} else {
		const blob = await response.blob();
		chunks.push(blob);
		onProgress?.({receivedBytes: blob.size, totalBytes});
	}

	const blob = new Blob(chunks);
	const downloadUrl = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = downloadUrl;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(downloadUrl);
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
