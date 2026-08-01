//---------------------------------------------------------
// NOTE: standalone SYN Flood Protection was removed from the gateway in the
// wrap-up and folded into the unified Security Rate Limiting config
// (/config/securityrate: synEnabled/synThreshold/cookieThreshold). The old
// /config/synflood endpoint and its types no longer exist.
//---------------------------------------------------------
// Unified Security Rate Limiting Types (P0-5 + P0-6 + P0-7)
//---------------------------------------------------------
export interface ISecurityRateConfigMod {
	synEnabled: boolean;
	synThreshold: number;
	cookieThreshold: number;
	connRateEnabled: boolean;
	ratePerSec: number;
	udpEnabled: boolean;
	udpPktThreshold: number;
	udpBandwidthMB: number;
	whitelistIps?: string[];
}

export interface ISecurityRateEntry {
	synEnabled: boolean;
	synThreshold: number;
	cookieThreshold: number;
	connRateEnabled: boolean;
	ratePerSec: number;
	udpEnabled: boolean;
	udpPktThreshold: number;
	udpBandwidthMB: number;
	whitelistIps: string[];
	synBlocked: number;
	synPassed: number;
	synCookies: number;
	connBlocked: number;
	connPassed: number;
	concurrentBlocked: number;
	udpBlocked: number;
	udpPassed: number;
	udpBytesBlocked: number;
	udpBytesPassed: number;
	uniqueIps: number;
}

export interface ISecurityRateResponse {
	securityrateAttr: ISecurityRateEntry[];
}

//---------------------------------------------------------
// SNI Certificate Types
//---------------------------------------------------------
export interface ISNICertificateEntry {
	hostname: string;
	certPath?: string;
}

export interface ISNICertificateListItem {
	hostname: string;
	certPath: string;
	refCount: number;
}

export interface ISNICertificatesResponse {
	certificates: ISNICertificateListItem[];
	totalCertificates: number;
}

export interface ISNICertificateDeleteRequest {
	hostname: string;
}

//---------------------------------------------------------
// Inline-PEM certificate store (/config/cert, certId-keyed).
// POST/PUT persist PEM under /etc/loxilb/certs/<certId>/ and
// auto-register the SAN/CN hostnames into the SNI store.
//---------------------------------------------------------
export interface ICert {
	certId?: string; // opaque handle; server mints one when absent on upload
	certPem: string;
	keyPem: string; // never returned by GET
	chainPem?: string;
	hostnames?: string[]; // output-only, derived from leaf SAN/CN
}

//---------------------------------------------------------
// IP Filter Types
//---------------------------------------------------------
export interface IIPFilterEntry {
	filterType: 'whitelist' | 'blacklist';
	cidr: string;
	zone?: number;
	priority?: number;
	action: 'allow' | 'drop';
	packets?: number;
	bytes?: number;
}

export interface IIPFilterResponse {
	ipFilterAttr: IIPFilterEntry[];
}

export interface IIPFilterDeleteParams {
	filterType: string;
	cidr: string;
	zone?: number;
}
