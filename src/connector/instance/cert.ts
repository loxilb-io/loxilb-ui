//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {ICert} from 'types/security';
import {IInstance} from 'types/oam';
import {DELETE_INST, POST_INST, PUT_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {runOp} from '../fetcher/opResultAdapter';

//---------------------------------------------------------
// Inline-PEM certificate store (/config/cert, certId-keyed)
//---------------------------------------------------------

/** Upload inline PEM material; the server mints a certId when none is given
 *  and auto-registers the leaf cert's SAN/CN hostnames into the SNI store. */
export async function request_upload_cert_pem(instance: IInstance, data: ICert): Promise<OpResult> {
	return runOp('cert.upload_cert_pem', () => POST_INST(instance, `/config/cert`, data));
}

/** Zero-downtime rotation: swap new PEM material under the SAME certId. */
export async function request_rotate_cert_pem(instance: IInstance, certId: string, data: ICert): Promise<OpResult> {
	return runOp('cert.rotate_cert_pem', () => PUT_INST(instance, `/config/cert/${encodeURIComponent(certId)}`, data));
}

/** Delete the managed material and unregister its derived hostnames. */
export async function request_delete_cert_pem(instance: IInstance, certId: string): Promise<OpResult> {
	return runOp('cert.delete_cert_pem', () => DELETE_INST(instance, `/config/cert/${encodeURIComponent(certId)}`));
}
