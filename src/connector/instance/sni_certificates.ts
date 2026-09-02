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
import {assertOk, SimpleResponse} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {fromNetworkError, fromSimpleResponse} from '../fetcher/opResultAdapter';
import {STATUS_LOCALE_KEYS} from '../fetcher/opResultCodes';
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

// runOp plus this family's soft-error contract: the SNI store answers 200
// with an 'Error: ...'-prefixed result string for domain rejections — the
// generic {result:"fail"} envelope check cannot see those ( batch 5).
async function sniOp(op: string, call: () => Promise<SimpleResponse>): Promise<OpResult> {
	let resp;
	try {
		resp = await call();
	} catch (error) {
		return fromNetworkError(op, error);
	}
	const res = fromSimpleResponse(resp, op);
	if (res.status === 'confirmed' && sniSoftError(resp)) {
		return {...res, status: 'failed', code: `${op}.reported_failure`, localeKey: STATUS_LOCALE_KEYS.failed, data: undefined, rawDetail: (resp.data as any)?.result};
	}
	return res;
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
export async function request_register_sni_certificate(instance: IInstance, data: ISNICertificateEntry): Promise<OpResult> {
	// The input form's onChange emits its validation state (isValid) alongside
	// the fields; build an explicit ISNICertificateEntry so that client-only key
	// can never leak into the gateway POST, and omit an empty
	// certPath so the gateway applies its default path.
	const payload: ISNICertificateEntry = {hostname: data.hostname};
	if (data.certPath && data.certPath.trim() !== '') payload.certPath = data.certPath;
	return sniOp('sni.register', () => POST_INST(instance, `/sni/certificates`, payload));
}

/**
 * Unregister SNI certificate globally
 * Remove SNI certificate from global store by hostname
 */
export async function request_unregister_sni_certificate(
	instance: IInstance,
	data: ISNICertificateDeleteRequest,
): Promise<OpResult> {
	return sniOp('sni.unregister', () => DELETE_INST(instance, `/sni/certificates`, data));
}
