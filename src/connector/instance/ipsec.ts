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
	IIPsecPeerConfig,
	IIPsecSA,
	IIPsecStats,
	IIPsecTunnel,
	IIPsecTunnelAction,
	IIPsecTunnelMod,
} from 'types/ipsec';
import {IInstance} from 'types/oam';
import {assertOk} from '../fetcher/fetcher_base';
import {DELETE_INST, GET_INST, POST_INST, PUT_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {runOp} from '../fetcher/opResultAdapter';

//---------------------------------------------------------
// Global configuration (/config/ipsec)
//---------------------------------------------------------

export async function query_get_ipsec_config(instance: IInstance): Promise<IIPsecConfig | null> {
	const resp = await GET_INST<IIPsecConfig>(instance, `/config/ipsec`);
	return resp.code === 200 ? resp.data : null;
}

export async function request_set_ipsec_config(instance: IInstance, data: IIPsecConfigMod): Promise<OpResult> {
	return runOp('ipsec.set_ipsec_config', () => POST_INST(instance, `/config/ipsec`, data));
}

//---------------------------------------------------------
// Tunnels (/config/ipsec/tunnels)
//---------------------------------------------------------

export async function query_get_ipsec_tunnel_all(instance: IInstance): Promise<IIPsecTunnel[]> {
	const resp = await GET_INST<{ipsecTunnelAttr: IIPsecTunnel[] | null}>(instance, `/config/ipsec/tunnels/all`);
	assertOk(resp, 'Get IPsec Tunnels');
	return resp.data?.ipsecTunnelAttr ?? [];
}

export async function request_create_ipsec_tunnel(instance: IInstance, data: IIPsecTunnelMod): Promise<OpResult> {
	return runOp('ipsec.create_ipsec_tunnel', () => POST_INST(instance, `/config/ipsec/tunnels`, data));
}

/**
 * In-place tunnel update (PUT) — single config regen + strongSwan reload on
 * the gateway, no delete/recreate window. PSK may be omitted when unchanged
 * (the gateway keeps the stored one).
 */
export async function request_update_ipsec_tunnel(instance: IInstance, name: string, data: IIPsecTunnelMod): Promise<OpResult> {
	return runOp('ipsec.update_ipsec_tunnel', () => PUT_INST(instance, `/config/ipsec/tunnels/${encodeURIComponent(name)}`, data));
}

/** Initiate (ipsec up), terminate (ipsec down), or restart the tunnel connection. */
export async function request_ipsec_tunnel_action(instance: IInstance, name: string, action: IIPsecTunnelAction): Promise<OpResult> {
	return runOp(`ipsec.tunnel_${action}`, () => POST_INST(instance, `/config/ipsec/tunnels/${encodeURIComponent(name)}/action`, {action}));
}

/**
 * Mirrored strongSwan configuration for the REMOTE peer of the tunnel
 * (ipsec.conf conn block + secrets entry). PSK tunnels include the key.
 */
export async function query_get_ipsec_tunnel_peerconfig(instance: IInstance, name: string): Promise<IIPsecPeerConfig | null> {
	const resp = await GET_INST<IIPsecPeerConfig>(instance, `/config/ipsec/tunnels/${encodeURIComponent(name)}/peerconfig`);
	return resp.code === 200 ? resp.data : null;
}

export async function request_delete_ipsec_tunnel(instance: IInstance, name: string): Promise<OpResult> {
	return runOp('ipsec.delete_ipsec_tunnel', () => DELETE_INST(instance, `/config/ipsec/tunnels/${encodeURIComponent(name)}`));
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
	assertOk(resp, 'Get IPsec Certificates');
	return resp.data?.ipsecCertificateAttr ?? [];
}

export async function request_upload_ipsec_certificate(instance: IInstance, data: IIPsecCertificateMod): Promise<OpResult> {
	return runOp('ipsec.upload_ipsec_certificate', () => POST_INST(instance, `/config/ipsec/certificates`, data));
}

export async function request_delete_ipsec_certificate(instance: IInstance, name: string): Promise<OpResult> {
	return runOp('ipsec.delete_ipsec_certificate', () => DELETE_INST(instance, `/config/ipsec/certificates/${encodeURIComponent(name)}`));
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
	assertOk(resp, 'Get IPsec CA Certificates');
	return resp.data?.ipsecCACertificateAttr ?? [];
}

export async function request_upload_ipsec_ca_certificate(instance: IInstance, data: IIPsecCACertificateMod): Promise<OpResult> {
	return runOp('ipsec.upload_ipsec_ca_certificate', () => POST_INST(instance, `/config/ipsec/ca-certificates`, data));
}

export async function request_delete_ipsec_ca_certificate(instance: IInstance, name: string): Promise<OpResult> {
	return runOp('ipsec.delete_ipsec_ca_certificate', () => DELETE_INST(instance, `/config/ipsec/ca-certificates/${encodeURIComponent(name)}`));
}
