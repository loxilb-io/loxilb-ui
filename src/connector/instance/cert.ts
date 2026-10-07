//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import type {GwGetResp} from 'api';
import {CertUsage, ICert} from 'types/security';
import {IInstance} from 'types/oam';
import {DELETE_INST, GET_INST, POST_INST, PUT_INST} from '../fetcher/fetcher_inst';
import {OpResult} from '../fetcher/opResult';
import {fromNetworkError, fromSimpleResponse, runOp} from '../fetcher/opResultAdapter';

//---------------------------------------------------------
// Inline-PEM certificate store (/config/cert, certId-keyed)
//---------------------------------------------------------

/** What the gateway answers a create with: the ID the certificate is stored under. */
export type CertCreated = {certId?: string};

/** Upload inline PEM material; the server mints a certId when none is given
 *  and auto-registers the leaf cert's SAN/CN hostnames into the SNI store. */
export async function request_upload_cert_pem(instance: IInstance, data: ICert): Promise<OpResult<CertCreated>> {
	return runOp<CertCreated>('cert.upload_cert_pem', () => POST_INST(instance, `/config/cert`, data));
}

/**
 * The ID an accepted create stored the certificate under, as the gateway
 * answered it: the one the request named, or the one the gateway minted.
 * Empty when the answer carries none, as from a gateway that answers a create
 * with an empty body.
 */
export function createdCertId(result: OpResult<unknown>): string {
	const id = (result.data as CertCreated | null | undefined)?.certId;
	return typeof id === 'string' ? id.trim() : '';
}

/** Rotation: swap new PEM material under the SAME certId. */
export async function request_rotate_cert_pem(instance: IInstance, certId: string, data: ICert): Promise<OpResult> {
	return runOp('cert.rotate_cert_pem', () => PUT_INST(instance, `/config/cert/${encodeURIComponent(certId)}`, data));
}

/** Delete the managed material and unregister its derived hostnames. */
export async function request_delete_cert_pem(instance: IInstance, certId: string): Promise<OpResult> {
	return runOp('cert.delete_cert_pem', () => DELETE_INST(instance, `/config/cert/${encodeURIComponent(certId)}`));
}

//---------------------------------------------------------
// Lookup by certId (GET /config/cert/{certId})
//---------------------------------------------------------
// The only read of the certificate store: there is no list, and the SNI
// hostname list shows listener certificates only — a CA bundle or a client
// certificate has no row anywhere. So an ID is looked up one at a time, and
// that lookup is also what confirms an upload, a rotation and a delete.
//
// ⚠️ What leaves this module is a SUMMARY, never the response. The gateway
// answers with certificate and chain PEM (and the shared model has a key
// member, which the handler leaves empty). None of it is needed to show an
// entry, and anything returned from here can end up in component state, the
// query cache or a screenshot — so the summary is built field by field and
// the PEM is dropped where it arrives. Do not spread the response into it.

type CertRead = Partial<GwGetResp<'/config/cert/{certId}'>>;

export interface ICertSummary {
	certId: string;
	/** As the gateway reports it; an entry from before usages existed is a listener certificate. */
	usage: CertUsage | string;
	/** Hostnames registered for SNI. Empty for a CA bundle or a client certificate. */
	hostnames: string[];
	/** Certificates in the entry itself: one for a leaf, one or more for a CA bundle. */
	certificates: number;
	/** Certificates in the chain that travels with a leaf. */
	chainCertificates: number;
}

export type CertLookup =
	| {kind: 'found'; cert: ICertSummary}
	/** The gateway answered 404: nothing is stored under the ID. */
	| {kind: 'absent'}
	/** Anything else. NOT "absent": a read that failed has not said the entry is gone. */
	| {kind: 'error'; result: OpResult};

/** Whether the stored certificate is the one that was submitted. */
export type CertMaterial = 'match' | 'differs';

const CERT_BLOCK_RE = /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g;

/** The base64 body of every certificate in a PEM text, whitespace removed. */
function certBodies(pem: string | null | undefined): string[] {
	return [...(pem ?? '').matchAll(CERT_BLOCK_RE)].map(block => block[1].replace(/\s+/g, ''));
}

export function summarizeCert(certId: string, read: CertRead): ICertSummary {
	return {
		certId: read.certId || certId,
		usage: read.usage || 'server',
		hostnames: Array.isArray(read.hostnames) ? read.hostnames.filter(name => typeof name === 'string') : [],
		certificates: certBodies(read.certPem).length,
		chainCertificates: certBodies(read.chainPem).length,
	};
}

type RawLookup = {kind: 'found'; read: CertRead} | {kind: 'absent'} | {kind: 'error'; result: OpResult};

async function read_cert(instance: IInstance, certId: string, op: string): Promise<RawLookup> {
	try {
		const resp = await GET_INST<CertRead>(instance, `/config/cert/${encodeURIComponent(certId)}`);
		if (resp.code === 200) return {kind: 'found', read: resp.data ?? {}};
		// A 404 the management backend itself produced is about the instance or
		// the route, not about the certificate.
		const origin = resp.headers?.get('X-Loxi-Error-Origin')?.trim().toLowerCase();
		if (resp.code === 404 && origin !== 'oam') return {kind: 'absent'};
		return {kind: 'error', result: fromSimpleResponse(resp, op)};
	} catch (error) {
		return {kind: 'error', result: fromNetworkError(op, error)};
	}
}

/** Look one entry up by its ID. */
export async function lookup_cert(instance: IInstance, certId: string): Promise<CertLookup> {
	const raw = await read_cert(instance, certId, 'cert.lookup');
	return raw.kind === 'found' ? {kind: 'found', cert: summarizeCert(certId, raw.read)} : raw;
}

/**
 * Look an entry up after an upload or a rotation, and say whether what is
 * stored is what was submitted. The comparison is made here so that neither
 * PEM text has to leave the connector.
 */
export async function confirm_cert_material(
	instance: IInstance,
	certId: string,
	submittedCertPem: string,
): Promise<CertLookup & {material?: CertMaterial}> {
	const raw = await read_cert(instance, certId, 'cert.confirm');
	if (raw.kind !== 'found') return raw;
	const stored = certBodies(raw.read.certPem);
	const submitted = certBodies(submittedCertPem);
	const same = stored.length > 0 && stored.length === submitted.length && stored.every((body, i) => body === submitted[i]);
	return {kind: 'found', cert: summarizeCert(certId, raw.read), material: same ? 'match' : 'differs'};
}
