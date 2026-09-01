//---------------------------------------------------------
// UI-P6-3 — confirm predicates ("did my write land?") per endpoint family.
//
// Rule 6: never structurally compare the submitted object against what the
// list returns. Gateway GET canonicalization is asymmetric — zero-valued
// fields come back omitted, `[]` can come back `null`, optional fields are
// defaulted server-side and row order is not stable. A deep-equal check would
// report a landed write as "never appeared" and poll out to a false pending.
//
// So each predicate compares the SMALLEST stable identity for its family and
// nothing else. Until the gateway canonicalization table lands (external
// input, tracked with Tranche B), that means primary-key fields only —
// deliberately not the whole tuple `canonicalLBRuleIdentity` uses for row
// identity, because parts of that tuple (portMax, path fields) are exactly
// what the server is free to normalize.
//---------------------------------------------------------
import {IEndpointItem} from 'types/endpoint';
import {IServiceArguments, IServiceConfiguration} from 'types/load_balancer';

/** VIP + port + protocol: the tuple the gateway keys a rule on. */
function lbKey(args: Pick<IServiceArguments, 'externalIP' | 'port' | 'protocol'>): string {
	return [args.externalIP ?? '', String(args.port ?? ''), (args.protocol ?? '').toLowerCase()].join('|');
}

/** The rule the operator just created/updated is present. */
export const lbRuleAppeared =
	(submitted: IServiceConfiguration) =>
	(rows: IServiceConfiguration[]): boolean => {
		const wanted = lbKey(submitted.serviceArguments);
		return rows.some(r => lbKey(r.serviceArguments) === wanted);
	};

/** Every rule the operator deleted is gone. */
export const lbRulesGone =
	(deleted: IServiceConfiguration[]) =>
	(rows: IServiceConfiguration[]): boolean => {
		const present = new Set(rows.map(r => lbKey(r.serviceArguments)));
		return deleted.every(d => !present.has(lbKey(d.serviceArguments)));
	};

/**
 * Endpoints are keyed by host. `name` is optional on input and may be
 * server-assigned, so it is not part of the identity used here.
 */
const epKey = (item: {hostName?: string}): string => item.hostName ?? '';

export const endpointAppeared =
	(submitted: {hostName: string}) =>
	(rows: IEndpointItem[]): boolean =>
		rows.some(r => epKey(r) === epKey(submitted));

export const endpointsGone =
	(deleted: IEndpointItem[]) =>
	(rows: IEndpointItem[]): boolean => {
		const present = new Set(rows.map(epKey));
		return deleted.every(d => !present.has(epKey(d)));
	};

/**
 * API keys are identified by the gateway-issued `key_id`. The create response
 * carries it, so confirmation is exact; a create whose response omitted the
 * id has already been reported as a failure before reconciliation is reached.
 */
export const apiKeyAppeared =
	(keyId: string) =>
	(rows: {key_id?: string}[]): boolean =>
		rows.some(r => r.key_id === keyId);

export const apiKeysGone =
	(deletedKeyIds: string[]) =>
	(rows: {key_id?: string}[]): boolean => {
		const present = new Set(rows.map(r => r.key_id));
		return deletedKeyIds.every(id => !present.has(id));
	};

/** A tenant rate limit is confirmed once the tenant has a row at all. */
export const tenantRateLimitAppeared =
	(tenantId: string) =>
	(rows: {tenant_id?: string}[]): boolean =>
		rows.some(r => r.tenant_id === tenantId);
