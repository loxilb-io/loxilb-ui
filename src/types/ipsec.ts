//---------------------------------------------------------
// IPsec Types (global config, tunnels, SAs, stats, certificates)
//
// Derived from the vendored gateway swagger (src/api/gen/gateway.ts)
// so they cannot drift from the live API contract.
//---------------------------------------------------------
import type {GwSchema} from 'api';

// GET /config/ipsec — global settings + supported algorithms + hw capabilities
export type IIPsecConfig = GwSchema<'IPsecConfig'>;

// POST /config/ipsec body
export type IIPsecConfigMod = GwSchema<'IPsecConfigMod'>;

// POST /config/ipsec/tunnels body
export type IIPsecTunnelMod = GwSchema<'IPsecTunnelMod'>;

// GET /config/ipsec/tunnels/all element — config + state/traffic counters
export type IIPsecTunnel = GwSchema<'IPsecTunnel'>;

// POST /config/ipsec/tunnels/{name}/action body
export type IIPsecTunnelAction = NonNullable<GwSchema<'IPsecTunnelActionMod'>['action']>;

// GET /config/ipsec/tunnels/{name}/peerconfig response — mirrored strongSwan
// config for the remote peer (ipsec.conf conn block + secrets entry)
export type IIPsecPeerConfig = GwSchema<'IPsecPeerConfig'>;

// Traffic selector / DPD sub-objects
export type IIPsecSelector = GwSchema<'IPsecSelector'>;
export type IIPsecDPD = GwSchema<'IPsecDPD'>;

// GET /config/ipsec/sas/all element (read-only)
export type IIPsecSA = GwSchema<'IPsecSA'>;

// GET /config/ipsec/stats
export type IIPsecStats = GwSchema<'IPsecStats'>;

// POST /config/ipsec/certificates body (PEM cert + key upload)
export type IIPsecCertificateMod = GwSchema<'IPsecCertificateMod'>;

// GET /config/ipsec/certificates/all element (parsed metadata, no key material)
export type IIPsecCertificate = GwSchema<'IPsecCertificate'>;

// POST /config/ipsec/certificates/validate response
export type IIPsecCertValidation = GwSchema<'IPsecCertValidation'>;

// POST /config/ipsec/ca-certificates body
export type IIPsecCACertificateMod = GwSchema<'IPsecCACertificateMod'>;

// GET /config/ipsec/ca-certificates/all element
export type IIPsecCACertificate = GwSchema<'IPsecCACertificate'>;
