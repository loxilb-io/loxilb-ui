//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {
	ISNICertificateEntry,
	ISNICertificateDeleteRequest,
	ISNICertificateListItem,
	ISNICertificatesResponse,
} from 'types/security';
import {IInstance} from 'types/oam';
import {ApiResult, assertOk, createDetailedErrorMessage, SimpleResponse} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------

// The gateway's SNI handlers report load/lookup failures inside a 200
// response body ({"result":"Error: …"}) instead of a non-2xx status, so a
// status-code check alone reports success while no certificate was actually
// loaded/removed — the result text must be inspected too.
function sniSoftError(resp: SimpleResponse): boolean {
	const result = (resp.data as any)?.result;
	return typeof result === 'string' && result.trim().startsWith('Error');
}

/**
 * List all global SNI certificates
 * Returns all SNI certificates in the global certificate store (shared by all proxies)
 */
export async function query_get_sni_certificates(instance: IInstance): Promise<ISNICertificatesResponse> {
	const resp = await GET_INST<GwGetResp<'/sni/certificates'>>(instance, `/sni/certificates`);
	assertOk(resp, 'Get SNI Certificates');
	// The gateway list key differs across builds: older ones return
	// {certificates, totalCertificates}, newer ones {sniAttr} (observed live
	// 2026-08-04; reading only `certificates` left the page permanently empty).
	// Normalize both shapes here, and default the optional refCount — the
	// sniAttr shape omits it and the table/detail render .toString() on it.
	const data = (resp.data ?? {}) as any;
	const items: any[] = data.certificates ?? data.sniAttr ?? [];
	const certificates = items.map(c => ({...c, refCount: c.refCount ?? 0})) as ISNICertificateListItem[];
	return {certificates, totalCertificates: data.totalCertificates ?? certificates.length};
}

/**
 * Register SNI certificate globally
 * Register an SNI certificate in the global certificate store.
 * Multiple loadbalancer rules can share the same certificate by hostname.
 */
export async function request_register_sni_certificate(instance: IInstance, data: ISNICertificateEntry): Promise<ApiResult> {
	// The input form's onChange emits its validation state (isValid) alongside
	// the fields; build an explicit ISNICertificateEntry so that client-only key
	// can never leak into the gateway POST, and omit an empty
	// certPath so the gateway applies its default path.
	const payload: ISNICertificateEntry = {hostname: data.hostname};
	if (data.certPath && data.certPath.trim() !== '') payload.certPath = data.certPath;
	const resp = await POST_INST(instance, `/sni/certificates`, payload);
	if ((resp.code !== 200 && resp.code !== 204) || sniSoftError(resp)) {
		const errorMessage = createDetailedErrorMessage(resp, 'SNI Certificate Registration');
		return {status: 'error', error: errorMessage};
	}
	return {status: 'success'};
}

/**
 * Unregister SNI certificate globally
 * Remove SNI certificate from global store by hostname
 */
export async function request_unregister_sni_certificate(
	instance: IInstance,
	data: ISNICertificateDeleteRequest,
): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/sni/certificates`, data);
	if ((resp.code !== 200 && resp.code !== 204) || sniSoftError(resp)) {
		const errorMessage = createDetailedErrorMessage(resp, 'SNI Certificate Removal');
		return {status: 'error', error: errorMessage};
	}
	return {status: 'success'};
}
