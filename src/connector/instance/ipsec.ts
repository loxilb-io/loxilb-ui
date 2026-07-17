//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {
	IIPsecCACertificate,
	IIPsecCACertificateMod,
	IIPsecCertValidation,
	IIPsecCertificate,
	IIPsecCertificateMod,
	IIPsecConfig,
	IIPsecConfigMod,
	IIPsecSA,
	IIPsecStats,
	IIPsecTunnel,
	IIPsecTunnelMod,
} from 'types/ipsec';
import {IInstance} from 'types/oam';
import {ApiResult, createDetailedErrorMessage} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST} from '../fetcher/fetcher_inst';

//---------------------------------------------------------
// Global configuration (/config/ipsec)
//---------------------------------------------------------

export async function query_get_ipsec_config(instance: IInstance): Promise<IIPsecConfig | null> {
	const resp = await GET_INST<IIPsecConfig>(instance, `/config/ipsec`);
	return resp.code === 200 ? resp.data : null;
}

export async function request_set_ipsec_config(instance: IInstance, data: IIPsecConfigMod): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/ipsec`, data);
	if (resp.code !== 200 && resp.code !== 204) {
		return {status: 'error', error: createDetailedErrorMessage(resp, 'IPsec Configuration')};
	}
	return {status: 'success'};
}

//---------------------------------------------------------
// Tunnels (/config/ipsec/tunnels)
//---------------------------------------------------------

export async function query_get_ipsec_tunnel_all(instance: IInstance): Promise<IIPsecTunnel[]> {
	const resp = await GET_INST<{ipsecTunnelAttr: IIPsecTunnel[] | null}>(instance, `/config/ipsec/tunnels/all`);
	return resp.data?.ipsecTunnelAttr ?? [];
}

export async function request_create_ipsec_tunnel(instance: IInstance, data: IIPsecTunnelMod): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/ipsec/tunnels`, data);
	if (resp.code !== 200 && resp.code !== 204) {
		return {status: 'error', error: createDetailedErrorMessage(resp, 'IPsec Tunnel Create')};
	}
	return {status: 'success'};
}

export async function request_delete_ipsec_tunnel(instance: IInstance, name: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/ipsec/tunnels/${encodeURIComponent(name)}`);
	if (resp.code !== 200 && resp.code !== 204) {
		return {status: 'error', error: createDetailedErrorMessage(resp, 'IPsec Tunnel Delete')};
	}
	return {status: 'success'};
}

//---------------------------------------------------------
// SAs + stats (read-only)
//---------------------------------------------------------

export async function query_get_ipsec_sa_all(instance: IInstance): Promise<IIPsecSA[]> {
	const resp = await GET_INST<{ipsecSaAttr: IIPsecSA[] | null}>(instance, `/config/ipsec/sas/all`);
	return resp.data?.ipsecSaAttr ?? [];
}

export async function query_get_ipsec_stats(instance: IInstance): Promise<IIPsecStats | null> {
	const resp = await GET_INST<IIPsecStats>(instance, `/config/ipsec/stats`);
	return resp.code === 200 ? resp.data : null;
}

//---------------------------------------------------------
// Certificates (/config/ipsec/certificates)
//---------------------------------------------------------

export async function query_get_ipsec_certificate_all(instance: IInstance): Promise<IIPsecCertificate[]> {
	const resp = await GET_INST<{ipsecCertificateAttr: IIPsecCertificate[] | null}>(instance, `/config/ipsec/certificates/all`);
	return resp.data?.ipsecCertificateAttr ?? [];
}

export async function request_upload_ipsec_certificate(instance: IInstance, data: IIPsecCertificateMod): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/ipsec/certificates`, data);
	if (resp.code !== 200 && resp.code !== 201 && resp.code !== 204) {
		return {status: 'error', error: createDetailedErrorMessage(resp, 'IPsec Certificate Upload')};
	}
	return {status: 'success'};
}

export async function request_delete_ipsec_certificate(instance: IInstance, name: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/ipsec/certificates/${encodeURIComponent(name)}`);
	if (resp.code !== 200 && resp.code !== 204) {
		return {status: 'error', error: createDetailedErrorMessage(resp, 'IPsec Certificate Delete')};
	}
	return {status: 'success'};
}

/**
 * Validate PEM material server-side WITHOUT installing it — returns parsed
 * subject/issuer/validity plus errors/warnings. Used for pre-upload feedback.
 */
export async function request_validate_ipsec_certificate(instance: IInstance, data: IIPsecCertificateMod): Promise<IIPsecCertValidation | null> {
	// The endpoint takes the full upload body (name required) but installs nothing
	const resp = await POST_INST<IIPsecCertValidation>(instance, `/config/ipsec/certificates/validate`, data);
	return resp.data ?? null;
}

//---------------------------------------------------------
// CA certificates (/config/ipsec/ca-certificates)
//---------------------------------------------------------

export async function query_get_ipsec_ca_certificate_all(instance: IInstance): Promise<IIPsecCACertificate[]> {
	const resp = await GET_INST<{ipsecCACertificateAttr: IIPsecCACertificate[] | null}>(instance, `/config/ipsec/ca-certificates/all`);
	return resp.data?.ipsecCACertificateAttr ?? [];
}

export async function request_upload_ipsec_ca_certificate(instance: IInstance, data: IIPsecCACertificateMod): Promise<ApiResult> {
	const resp = await POST_INST(instance, `/config/ipsec/ca-certificates`, data);
	if (resp.code !== 200 && resp.code !== 201 && resp.code !== 204) {
		return {status: 'error', error: createDetailedErrorMessage(resp, 'IPsec CA Certificate Upload')};
	}
	return {status: 'success'};
}

export async function request_delete_ipsec_ca_certificate(instance: IInstance, name: string): Promise<ApiResult> {
	const resp = await DELETE_INST(instance, `/config/ipsec/ca-certificates/${encodeURIComponent(name)}`);
	if (resp.code !== 200 && resp.code !== 204) {
		return {status: 'error', error: createDetailedErrorMessage(resp, 'IPsec CA Certificate Delete')};
	}
	return {status: 'success'};
}
