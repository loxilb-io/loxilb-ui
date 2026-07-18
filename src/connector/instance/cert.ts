//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {ICert} from 'types/security';
import {IInstance} from 'types/oam';
import {ApiResult, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST, PUT_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// Inline-PEM certificate store (/config/cert, certId-keyed)
//---------------------------------------------------------

/** Upload inline PEM material; the server mints a certId when none is given
 *  and auto-registers the leaf cert's SAN/CN hostnames into the SNI store. */
export async function request_upload_cert_pem(instance: IInstance, data: ICert): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/cert`, data);
	if (resp.code !== 200 && resp.code !== 201 && resp.code !== 204) {
		return {status: 'error', error: createDetailedErrorMessage(resp, 'Certificate Upload')};
	}
	return {status: 'success'};
}

/** Zero-downtime rotation: swap new PEM material under the SAME certId. */
export async function request_rotate_cert_pem(instance: IInstance, certId: string, data: ICert): Promise<ApiResult> {
	const resp = await PUT_INST(instance, `/config/cert/${encodeURIComponent(certId)}`, data);
	if (resp.code !== 200 && resp.code !== 204) {
		return {status: 'error', error: createDetailedErrorMessage(resp, 'Certificate Rotate')};
	}
	return {status: 'success'};
}

/** Delete the managed material and unregister its derived hostnames. */
export async function request_delete_cert_pem(instance: IInstance, certId: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/cert/${encodeURIComponent(certId)}`);
	if (resp.code !== 200 && resp.code !== 204) {
		return {status: 'error', error: createDetailedErrorMessage(resp, 'Certificate Delete')};
	}
	return {status: 'success'};
}
