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
import {ApiResult, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------

/**
 * List all global SNI certificates
 * Returns all SNI certificates in the global certificate store (shared by all proxies)
 */
export async function query_get_sni_certificates(instance: IInstance): Promise<ISNICertificatesResponse> {
	const resp = await GET_INST(instance, `/sni/certificates`);
	return (
		(resp.data as ISNICertificatesResponse) ?? {
			certificates: [],
			totalCertificates: 0,
		}
	);
}

/**
 * Register SNI certificate globally
 * Register an SNI certificate in the global certificate store.
 * Multiple loadbalancer rules can share the same certificate by hostname.
 */
export async function request_register_sni_certificate(instance: IInstance, data: ISNICertificateEntry): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/sni/certificates`, data);
	if (resp.code !== 200 && resp.code !== 204) {
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
	if (resp.code !== 200 && resp.code !== 204) {
		const errorMessage = createDetailedErrorMessage(resp, 'SNI Certificate Removal');
		return {status: 'error', error: errorMessage};
	}
	return {status: 'success'};
}
