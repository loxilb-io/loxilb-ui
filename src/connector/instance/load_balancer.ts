//---------------------------------------------------------
// Imports
//---------------------------------------------------------
import {InstanceFlavor, stripGatewayOnlyFields} from 'api/capabilities';
import {serializeAIConfiguration, validateAIConfiguration} from 'types/ai_gateway';
import {IServiceConfiguration} from 'types/load_balancer';
import {buildLBDeleteKey, buildLBDeletePath} from 'types/lb_identity';
import {IInstance} from 'types/oam';
import {assertOk} from '../fetcher/fetcher_base';
import {OpResult} from '../fetcher/opResult';
import {fromNetworkError, fromSimpleResponse} from '../fetcher/opResultAdapter';
import {STATUS_LOCALE_KEYS} from '../fetcher/opResultCodes';
import {DELETE_INST, GET_INST, PATCH_INST, POST_INST} from '../fetcher/fetcher_inst';
import type {GwGetResp} from 'api';

//---------------------------------------------------------
// Helper Functions
//---------------------------------------------------------
function cleanNegativeNumbers(obj: any): any {
	if (obj === null || obj === undefined) return obj;
	
	if (Array.isArray(obj)) {
		return obj.map(item => cleanNegativeNumbers(item));
	}
	
	if (typeof obj === 'object') {
		const cleaned: any = {};
		for (const [key, value] of Object.entries(obj)) {
			// Skip keys with negative number values
			if (typeof value === 'number' && value < 0) {
				continue;
			}
			cleaned[key] = cleanNegativeNumbers(value);
		}
		return cleaned;
	}
	
	return obj;
}

/**
 * Project an outgoing LB body onto the fields the target flavor actually
 * declares — LX-EP-DEFAULTS.
 *
 * Done here, at the last boundary before the wire, rather than in the form: the
 * form gates CONTROLS, and a gated control still carries state. Every create
 * path (create, the edit upsert, the restore replay) shares this one funnel, so
 * a new caller cannot forget it.
 *
 * A no-op for the gateway, and — apart from the endpoint defaults — a no-op for
 * loxilb too, since the form gating already keeps the rest clean. It is the net
 * under that gating, not a replacement for it.
 */
function projectOntoFlavor(body: any, flavor: InstanceFlavor): any {
	if (flavor === 'inference-gateway') return body;

	const projected = stripGatewayOnlyFields(flavor, 'LoadbalanceEntry', body);
	return {
		...projected,
		...(projected.serviceArguments
			? {serviceArguments: stripGatewayOnlyFields(flavor, 'LoadbalanceEntry.serviceArguments', projected.serviceArguments)}
			: {}),
		...(Array.isArray(projected.endpoints)
			? {endpoints: projected.endpoints.map((ep: any) => stripGatewayOnlyFields(flavor, 'LoadbalanceEntry.endpoints[]', ep))}
			: {}),
	};
}

//---------------------------------------------------------
// API Caller Functions
//---------------------------------------------------------
export async function query_get_load_balancer_config_all(instance: IInstance): Promise<IServiceConfiguration[]> {
	const resp = await GET_INST<GwGetResp<'/config/loadbalancer/all'>>(instance, `/config/loadbalancer/all`);
	assertOk(resp, 'Get Load Balancer');
	return (resp.data?.lbAttr ?? []) as IServiceConfiguration[];
}

export async function request_create_load_balancer_config(instance: IInstance, data: IServiceConfiguration, flavor: InstanceFlavor): Promise<OpResult> {
	// Project FIRST. Gateway-only form state is outside the OSS contract, so it
	// must neither reach loxilb nor make an otherwise valid OSS create fail
	// IGW-specific validation. Serialization stays after validation: it
	// deliberately normalizes incompatible AI fields, which must not conceal a
	// known-invalid IGW combination from the client-side validator.
	const projectedData = projectOntoFlavor(data, flavor);

	// Keep the client-side matrix and the final wire payload in one pure policy.
	// Server validation remains authoritative, but known-invalid combinations
	// must not leave the browser.
	const aiIssues = validateAIConfiguration(projectedData);
	if (aiIssues.length > 0) {
		// Client-side backstop (the form validates inline before this point):
		// a mapped `invalid`, with the field messages in diagnostics only.
		return {
			status: 'invalid',
			code: 'lb.create.client_invalid',
			localeKey: STATUS_LOCALE_KEYS.invalid,
			retryable: false,
			rawDetail: aiIssues.map(issue => issue.message).join(' '),
		};
	}
	let cleanedData = cleanNegativeNumbers(serializeAIConfiguration(projectedData));

	// Clean up probe values according to serviceArguments.monitor value
	// If monitor is false, remove probetype, probeport, probereq, proberesp, probeTimeout, probeRetries
	if (cleanedData.serviceArguments && !cleanedData.serviceArguments.monitor) {
		const {probetype, probeport, probereq, proberesp, probeTimeout, probeRetries, ...serviceArgs} = cleanedData.serviceArguments;
		cleanedData = {
			...cleanedData,
			serviceArguments: serviceArgs
		};
	}

	// Drop mtls_frontend when client-cert verification is off. The Client Cert
	// Mode dropdown auto-defaults to 'disabled' on mount (ParamBox enum default),
	// so without this every rule — including non-TLS/dnat rules the gateway
	// rejects mtls_frontend on — would carry an inert mtls_frontend. 'disabled'
	// is the gateway's own default (no verification), so stripping it is a no-op
	// semantically and keeps the payload clean.
	const mf = cleanedData.serviceArguments?.mtls_frontend;
	if (mf && (!mf.client_cert_mode || mf.client_cert_mode === 'disabled')) {
		const {mtls_frontend, ...serviceArgs} = cleanedData.serviceArguments;
		cleanedData = {
			...cleanedData,
			serviceArguments: serviceArgs
		};
	}

	try {
		return fromSimpleResponse(await POST_INST(instance, `/config/loadbalancer`, cleanedData), 'lb.create');
	} catch (error) {
		return fromNetworkError('lb.create', error);
	}
}

/**
 * Apply an RFC 7386 JSON merge-patch to an existing LB rule identified by its
 * VIP/port/protocol composite key. Fields present are overwritten, absent
 * fields untouched. Immutable fields (mode, security, egress, protocol, VIP
 * key) are rejected by the gateway with 400 — callers must exclude them.
 */
export async function request_patch_load_balancer_config(
	instance: IInstance,
	ip: string,
	port: number,
	proto: string,
	patch: Partial<IServiceConfiguration>,
): Promise<OpResult> {
	try {
		return fromSimpleResponse(await PATCH_INST(instance, `/config/loadbalancer/externalipaddress/${ip}/port/${port}/protocol/${proto}`, patch), 'lb.patch');
	} catch (error) {
		return fromNetworkError('lb.patch', error);
	}
}

/**
 * Delete by rule name. This is the RELIABLE delete path: the tuple-based
 * endpoints below return 404 "no-rule error" for fullproxy/L7 (mode 4)
 * rules — the gateway keys those differently — while name-delete works for
 * every mode. Prefer this whenever the rule has a name.
 */
export async function request_delete_lb_by_name(instance: IInstance, name: string): Promise<OpResult> {
	try {
		return fromSimpleResponse(await DELETE_INST(instance, `/config/loadbalancer/name/${encodeURIComponent(name)}`), 'lb.delete');
	} catch (error) {
		return fromNetworkError('lb.delete', error);
	}
}

/** Delete a nameless rule by the complete key returned by the Gateway. */
export async function request_delete_lb_by_full_key(
	instance: IInstance,
	configuration: IServiceConfiguration,
): Promise<OpResult> {
	try {
		return fromSimpleResponse(await DELETE_INST(instance, buildLBDeletePath(buildLBDeleteKey(configuration))), 'lb.delete');
	} catch (error) {
		return fromNetworkError('lb.delete', error);
	}
}
