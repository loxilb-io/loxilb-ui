//---------------------------------------------------------
// Changing an existing fullproxy (mode 4) rule on the inference gateway.
//
// The gateway has one write for it: a POST of the WHOLE rule on the same
// identity, which it treats as a replace. The tuple PATCH refuses mode 4.
// What the replace does to the running rule depends on what changed, and the
// gateway does not report which it did — so the split below mirrors its
// change detection, read from the gateway source. The listening socket is
// kept either way; a change the rule does not take in place builds its
// endpoint pool again. It decides what the
// operator is told BEFORE the write and never what is sent: the request is
// the same whole rule either way, so a gateway that later moves a field
// between the two groups makes a warning wrong, not a write.
//---------------------------------------------------------
import {IEndpoint, IServiceArguments, IServiceConfiguration} from './load_balancer';
import {isChwblSelector, READ_ONLY_SERVICE_ARGUMENTS} from './ai_gateway';

/**
 * Applied to the running rule when nothing outside this set changed: the
 * admission gate, the half-close mode, and the backend TLS policy.
 */
export const FULLPROXY_IN_PLACE_FIELDS: ReadonlySet<string> = new Set([
	'fc_mode',
	'fc_adaptive',
	'fc_expose_headers',
	'fc_max_outstanding',
	'fc_ep_max_inflight',
	'fc_prefill_max_inflight',
	'fc_decode_max_inflight',
	'fc_telemetry_stale_ms',
	'fc_warmup_ms',
	'fc_ttft_target_ms',
	'fc_tenant_max_share_pct',
	'fc_max_queue_depth',
	'fc_max_queue_wait_ms',
	'half_close_mode',
	'backend_ca_cert_id',
	'backend_client_cert_id',
	'backend_tls_server_name',
	'mtls_backend',
]);

/**
 * The members that say WHICH fullproxy rule this is. Changing one addresses a
 * different rule, so the write creates that rule and leaves this one alone.
 */
export const FULLPROXY_IDENTITY_FIELDS = ['externalIP', 'port', 'portMax', 'protocol', 'host', 'path_prefix', 'path_match_mode', 'model_name'] as const;

type Loose = Record<string, unknown>;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** One identity member as the gateway keys it, so equal keys compare equal. */
function identityValue(field: (typeof FULLPROXY_IDENTITY_FIELDS)[number], args: Loose): string {
	switch (field) {
		case 'port':
			return String(args.port ?? '');
		case 'portMax':
			// A range is one only when it reaches past the port.
			return typeof args.portMax === 'number' && typeof args.port === 'number' && args.portMax > args.port ? String(args.portMax) : '';
		case 'protocol':
			return text(args.protocol).toLowerCase();
		case 'path_match_mode':
			// "disabled" is stored as nothing.
			return text(args.path_match_mode) === 'disabled' ? '' : text(args.path_match_mode);
		default:
			return text(args[field]);
	}
}

/** The identity members an edit changed; empty when it still names the same rule. */
export function changedFullproxyIdentity(edited: Partial<IServiceArguments>, original: Partial<IServiceArguments>): string[] {
	return FULLPROXY_IDENTITY_FIELDS.filter(field => identityValue(field, edited as Loose) !== identityValue(field, original as Loose));
}

export type FullproxyReplacePlan =
	/** Nothing changed. */
	| {kind: 'none'}
	/** The gateway applies the change to the rule as it runs. */
	| {kind: 'apply'; fields: string[]}
	/** The gateway builds the endpoint pool of the rule again. */
	| {kind: 'recreate'; fields: string[]}
	/** The gateway has no way to make this change on an existing rule. */
	| {kind: 'refused'; reason: 'secondary-ips'; fields: string[]};

export interface FullproxyChangeSet {
	/** `serviceArguments` members that differ from the rule as read. */
	changedArguments: readonly string[];
	endpointsChanged: boolean;
	secondaryChanged: boolean;
	allowedChanged: boolean;
	/** The rule's selector before the edit, and after it. */
	selectors: readonly [unknown, unknown];
}

/**
 * What a replace carrying this change set does, in the order the gateway
 * decides it.
 */
export function planFullproxyReplace(change: FullproxyChangeSet): FullproxyReplacePlan {
	const fields = [
		...change.changedArguments.map(field => `serviceArguments.${field}`),
		...(change.endpointsChanged ? ['endpoints'] : []),
		...(change.secondaryChanged ? ['secondaryIPs'] : []),
		...(change.allowedChanged ? ['allowedSources'] : []),
	];
	if (fields.length === 0) return {kind: 'none'};

	// Refused outright, whatever else the request carries.
	if (change.secondaryChanged) return {kind: 'refused', reason: 'secondary-ips', fields};

	const inPlaceOnly = !change.endpointsChanged && !change.allowedChanged && change.changedArguments.every(field => FULLPROXY_IN_PLACE_FIELDS.has(field));
	// A consistent-hash rule is reconciled without building its pool again.
	const consistentHash = change.selectors.some(selector => isChwblSelector(selector as IServiceArguments['sel']));
	return inPlaceOnly || consistentHash ? {kind: 'apply', fields} : {kind: 'recreate', fields};
}

// Admission members whose "not declared" the gateway spells `inherit`.
const INHERITABLE_FIELDS: ReadonlySet<string> = new Set(['fc_mode', 'fc_adaptive', 'fc_expose_headers']);

const isBlank = (value: unknown) => value === undefined || value === null || value === '';

/**
 * The form's changes, as a replace can carry them.
 *
 * On a replace the gateway KEEPS an admission value the body leaves out, so
 * a field the operator blanked is not a request to clear it:
 *   - a mode, adaptive or response-header choice returned to "Gateway
 *     default" is sent as `inherit`, the gateway's word for it;
 *   - a blanked number is no change at all. The gateway's way back to its
 *     default there is an explicit 0, and the form does not turn a blank
 *     into one.
 * Without this a blanked field was sent as an omission, the rule kept its
 * value, and the read-back reported the write as not applied.
 */
export function fullproxyReplaceableChanges(patch: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [field, value] of Object.entries(patch)) {
		if (!field.startsWith('fc_') || !isBlank(value)) out[field] = value;
		else if (INHERITABLE_FIELDS.has(field)) out[field] = 'inherit';
	}
	return out;
}

export interface FullproxyEdit {
	/** The changed `serviceArguments` members, with their new values. */
	argumentsPatch: Partial<IServiceArguments>;
	/** Each list as edited, or `undefined` when the operator left it alone. */
	endpoints?: IEndpoint[];
	secondaryIPs?: IServiceConfiguration['secondaryIPs'];
	allowedSources?: IServiceConfiguration['allowedSources'];
}

/**
 * The whole rule to send: the rule as the gateway holds it NOW, with only the
 * operator's changes laid over it.
 *
 * A replace clears what the body leaves out, so the body has to carry every
 * field the rule has — and the form may have been opened from a list read some
 * time ago. Building on a fresh read keeps a change made elsewhere in between.
 */
export function buildFullproxyReplaceBody(fresh: IServiceConfiguration, edit: FullproxyEdit): IServiceConfiguration {
	const kept = Object.fromEntries(
		Object.entries(fresh.serviceArguments as unknown as Loose).filter(
			// What the gateway derives or observes is not the request's to send.
			// `security` and `egress` stay: a replace that omits them reads as
			// an attempt to change them, which the gateway refuses.
			([field]) => field !== 'managed' && field !== 'id' && !(READ_ONLY_SERVICE_ARGUMENTS as readonly string[]).includes(field),
		),
	);
	return {
		serviceArguments: {...kept, ...edit.argumentsPatch} as IServiceArguments,
		endpoints: edit.endpoints ?? (fresh.endpoints ?? []).map(({state, counter, ...endpoint}: IEndpoint & {state?: unknown; counter?: unknown}) => endpoint as IEndpoint),
		secondaryIPs: edit.secondaryIPs ?? fresh.secondaryIPs ?? [],
		allowedSources: edit.allowedSources ?? fresh.allowedSources ?? [],
	};
}
