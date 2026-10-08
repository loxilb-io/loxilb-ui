//---------------------------------------------------------
// Audit trail configuration: policy, compliance sink, named sinks
//---------------------------------------------------------
// What an administrator may change on the gateway's audit trail, and how a
// change is checked against what the gateway reads back.
//
// ⚠️ The vendored spec carries no minimum, maximum, enum or required list for
// any audit model. Every limit below is read from the gateway's handler code
// (api/restapi/handler/audit_policy.go, audit_sink.go; pkg/audit/policy.go;
// pkg/audit/syslog), not from the contract, and a spec re-vendor will not move
// them.
//
// ⚠️ Every field of every audit model is `omitempty`: a value the gateway
// holds as 0, "" or false is absent from the answer. Absent is therefore
// compared as the zero value everywhere here, never as "not reported".
//
// ⚠️ A refused change answers 400 with no body, whatever was wrong. The checks
// here are what stands between the operator and an unexplained refusal.
import type {GwSchema} from 'api';
import type {IAuditSink} from './audit_status';

export type IAuditPolicy = GwSchema<'AuditPolicy'>;
export type IAuditNamedSink = GwSchema<'AuditNamedSink'>;
export type IAuditSinkFilter = GwSchema<'AuditSinkFilter'>;
export type IAuditRotateResult = GwSchema<'AuditRotateResult'>;

//---------------------------------------------------------
// Policy
//---------------------------------------------------------

/** The six fields, in display order. A write always carries all six. */
export const AUDIT_POLICY_FIELDS = [
	'max_segment_bytes',
	'max_segment_age_seconds',
	'retention_max_age_seconds',
	'retention_max_bytes',
	'retention_reserve_bytes',
	'retention_max_prune_per_pass',
] as const;
export type AuditPolicyField = (typeof AUDIT_POLICY_FIELDS)[number];
export type AuditPolicyValues = Record<AuditPolicyField, number>;
export type AuditPolicyForm = Record<AuditPolicyField, string>;

const SECONDS_FIELDS: readonly AuditPolicyField[] = ['max_segment_age_seconds', 'retention_max_age_seconds'];

/**
 * The gateway multiplies seconds by 1e9 into a signed 64-bit duration. One
 * second more than this wraps: to a negative value the gateway refuses, or to
 * a positive one it accepts as a different age.
 */
export const AUDIT_MAX_SECONDS = 9_223_372_036;

/**
 * What a gateway starts with (pkg/audit writer.go defaults; no start option
 * overrides them): 64 MiB or 24 h per segment, no retention limit, one
 * deletion per pass. The policy is held in memory only, so these are also what
 * a restart brings back.
 */
export const AUDIT_POLICY_START: AuditPolicyValues = {
	max_segment_bytes: 64 * 1024 * 1024,
	max_segment_age_seconds: 24 * 60 * 60,
	retention_max_age_seconds: 0,
	retention_max_bytes: 0,
	retention_reserve_bytes: 0,
	retention_max_prune_per_pass: 1,
};

function zeroIfAbsent(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * The policy as numbers: absent is 0, and a prune count of 0 is 1 (the
 * gateway stores "0, the built-in default" as 1 and reads back 1).
 */
export function policyValues(read: IAuditPolicy | AuditPolicyValues | undefined): AuditPolicyValues {
	const out = {} as AuditPolicyValues;
	for (const field of AUDIT_POLICY_FIELDS) out[field] = zeroIfAbsent(read?.[field]);
	if (out.retention_max_prune_per_pass === 0) out.retention_max_prune_per_pass = 1;
	return out;
}

/**
 * False for `{}`. A gateway with no audit writer answers the policy read with
 * `{}`, and a running writer never does (its segment limits start non-zero and
 * a saved prune count reads back at least 1). So an answer with none of the six
 * is "no writer", not "everything unlimited".
 */
export function policyReported(read: IAuditPolicy | undefined): boolean {
	return !!read && AUDIT_POLICY_FIELDS.some(field => read[field] !== undefined);
}

export function policyForm(values: AuditPolicyValues): AuditPolicyForm {
	const out = {} as AuditPolicyForm;
	for (const field of AUDIT_POLICY_FIELDS) out[field] = String(values[field]);
	return out;
}

export type AuditInputError =
	| 'not_whole'
	| 'too_large'
	| 'below_segment'
	| 'required'
	| 'address'
	| 'pair'
	| 'name'
	| 'reserved_name'
	| 'out_of_range'
	| 'service';

const WHOLE = /^\d+$/;

function wholeNumber(text: string, max: number): {value?: number; error?: AuditInputError} {
	const trimmed = text.trim();
	if (!WHOLE.test(trimmed)) return {error: 'not_whole'};
	const value = Number(trimmed);
	// Above 2^53 the number sent would not be the number typed.
	if (!Number.isSafeInteger(value) || value > max) return {error: 'too_large'};
	return {value};
}

/** Every field is required: a write replaces the whole policy, and a field left out would be set to 0. */
export function parsePolicyForm(form: AuditPolicyForm): {values?: AuditPolicyValues; errors: Partial<Record<AuditPolicyField, AuditInputError>>} {
	const errors: Partial<Record<AuditPolicyField, AuditInputError>> = {};
	const values = {} as AuditPolicyValues;
	for (const field of AUDIT_POLICY_FIELDS) {
		const parsed = wholeNumber(form[field] ?? '', SECONDS_FIELDS.includes(field) ? AUDIT_MAX_SECONDS : Number.MAX_SAFE_INTEGER);
		if (parsed.error) errors[field] = parsed.error;
		else values[field] = parsed.value!;
	}
	// pkg/audit Policy.Validate: a quota below one segment can never be met.
	if (!errors.retention_max_bytes && !errors.max_segment_bytes && values.retention_max_bytes > 0 && values.max_segment_bytes > 0 && values.retention_max_bytes < values.max_segment_bytes) {
		errors.retention_max_bytes = 'below_segment';
	}
	return Object.keys(errors).length > 0 ? {errors} : {values, errors};
}

/** Fields where what the gateway reads back is not what was sent. Empty means the change is confirmed. */
export function policyDiff(sent: AuditPolicyValues, read: IAuditPolicy | undefined): AuditPolicyField[] {
	const a = policyValues(sent);
	const b = policyValues(read);
	return AUDIT_POLICY_FIELDS.filter(field => a[field] !== b[field]);
}

//---------------------------------------------------------
// Sinks
//---------------------------------------------------------

/** pkg/audit/syslog: MaxFacility, DefaultFacility, MaxFrameBytesLimit; handler MaxEnterpriseNumber. */
export const AUDIT_MAX_FACILITY = 23;
export const AUDIT_DEFAULT_FACILITY = 13;
export const AUDIT_MAX_FRAME_BYTES = 1 << 30;
export const AUDIT_MAX_ENTERPRISE_NUMBER = 4_294_967_295;

/** pkg/audit ValidSinkName; `compliance` is the compliance sink's own name. */
export const AUDIT_SINK_NAME_RE = /^[a-z0-9_-]{1,64}$/;
export const AUDIT_RESERVED_SINK_NAME = 'compliance';

export const AUDIT_FILTER_STREAMS = ['mgmt', 'data', 'audit_system'] as const;
export const AUDIT_FILTER_OUTCOMES = ['ok', 'failed'] as const;

/** The fields both kinds of sink take. Strings, as typed. */
export interface IAuditSinkForm {
	address: string;
	ca_bundle_path: string;
	server_name: string;
	client_cert_path: string;
	client_key_path: string;
	/** Blank is the gateway's default, 13. */
	facility: string;
	/** Blank is no limit. */
	max_frame_bytes: string;
}

/** A named sink has no `enabled` and no `connected`; it has a number of its own and a filter. */
export interface IAuditNamedSinkForm extends IAuditSinkForm {
	name: string;
	enterprise_number: string;
	streams: string[];
	/** Comma separated. */
	services: string;
	outcome: string;
	/** Blank keeps every data record. */
	data_sample: string;
}

export type AuditSinkErrors = Partial<Record<keyof IAuditNamedSinkForm, AuditInputError>>;

/** What a write carries: the settable fields only, never a counter or a state the gateway reports. */
export type AuditSinkWrite = Required<Pick<IAuditSink, 'address' | 'ca_bundle_path' | 'server_name' | 'client_cert_path' | 'client_key_path' | 'facility' | 'max_frame_bytes'>>;
export type AuditComplianceSinkWrite = AuditSinkWrite & {enabled: true};
export type AuditNamedSinkWrite = AuditSinkWrite & {enterprise_number: number; filter?: IAuditSinkFilter};

const SINK_TEXT_FIELDS = ['address', 'ca_bundle_path', 'server_name', 'client_cert_path', 'client_key_path'] as const;
const SINK_NUMBER_FIELDS = ['facility', 'max_frame_bytes'] as const;

const blankIfZero = (value: unknown): string => (typeof value === 'number' && value !== 0 ? String(value) : '');

export function sinkForm(read: IAuditSink | IAuditNamedSink | undefined): IAuditSinkForm {
	return {
		address: read?.address ?? '',
		ca_bundle_path: read?.ca_bundle_path ?? '',
		server_name: read?.server_name ?? '',
		client_cert_path: read?.client_cert_path ?? '',
		client_key_path: read?.client_key_path ?? '',
		facility: blankIfZero(read?.facility),
		max_frame_bytes: blankIfZero(read?.max_frame_bytes),
	};
}

export function namedSinkForm(name: string, read: IAuditNamedSink | undefined): IAuditNamedSinkForm {
	return {
		...sinkForm(read),
		name,
		enterprise_number: blankIfZero(read?.enterprise_number),
		streams: [...(read?.filter?.streams ?? [])],
		services: (read?.filter?.services ?? []).join(', '),
		outcome: read?.filter?.outcome ?? '',
		data_sample: blankIfZero(read?.filter?.data_sample),
	};
}

// Go's net.SplitHostPort wants one host and one port; an IPv6 host goes in
// brackets. Anything looser is refused by the gateway without a reason.
const HOST_PORT = /^(\[[^\]\s]+\]|[^:\s[\]]+):\d{1,5}$/;

function optionalNumber(text: string, min: number, max: number): {value: number; error?: AuditInputError} {
	if (text.trim() === '') return {value: 0};
	const parsed = wholeNumber(text, Number.MAX_SAFE_INTEGER);
	if (parsed.error) return {value: 0, error: parsed.error};
	if (parsed.value! < min || parsed.value! > max) return {value: 0, error: 'out_of_range'};
	return {value: parsed.value!};
}

function parseShared(form: IAuditSinkForm, errors: AuditSinkErrors): AuditSinkWrite {
	const address = form.address.trim();
	if (address === '') errors.address = 'required';
	else if (!HOST_PORT.test(address)) errors.address = 'address';
	// There is no unverified mode.
	if (form.ca_bundle_path.trim() === '') errors.ca_bundle_path = 'required';
	const cert = form.client_cert_path.trim();
	const key = form.client_key_path.trim();
	if ((cert === '') !== (key === '')) errors[cert === '' ? 'client_cert_path' : 'client_key_path'] = 'pair';
	const facility = optionalNumber(form.facility, 0, AUDIT_MAX_FACILITY);
	if (facility.error) errors.facility = facility.error;
	const frame = optionalNumber(form.max_frame_bytes, 0, AUDIT_MAX_FRAME_BYTES);
	if (frame.error) errors.max_frame_bytes = frame.error;
	return {
		address,
		ca_bundle_path: form.ca_bundle_path.trim(),
		server_name: form.server_name.trim(),
		client_cert_path: cert,
		client_key_path: key,
		facility: facility.value,
		max_frame_bytes: frame.value,
	};
}

export function parseSinkForm(form: IAuditSinkForm): {body?: AuditComplianceSinkWrite; errors: AuditSinkErrors} {
	const errors: AuditSinkErrors = {};
	const shared = parseShared(form, errors);
	return Object.keys(errors).length > 0 ? {errors} : {body: {enabled: true, ...shared}, errors};
}

export function parseNamedSinkForm(form: IAuditNamedSinkForm): {name?: string; body?: AuditNamedSinkWrite; errors: AuditSinkErrors} {
	const errors: AuditSinkErrors = {};
	const name = form.name;
	if (name === AUDIT_RESERVED_SINK_NAME) errors.name = 'reserved_name';
	else if (!AUDIT_SINK_NAME_RE.test(name)) errors.name = 'name';
	const shared = parseShared(form, errors);

	// Required, and none is built in.
	let enterprise = 0;
	if (form.enterprise_number.trim() === '') errors.enterprise_number = 'required';
	else {
		const parsed = optionalNumber(form.enterprise_number, 1, AUDIT_MAX_ENTERPRISE_NUMBER);
		if (parsed.error) errors.enterprise_number = parsed.error;
		enterprise = parsed.value;
	}

	const services = form.services.split(',').map(s => s.trim());
	const anyService = form.services.trim() !== '';
	if (anyService && services.some(s => s === '')) errors.services = 'service';
	const sample = optionalNumber(form.data_sample, 0, Number.MAX_SAFE_INTEGER);
	if (sample.error) errors.data_sample = sample.error;

	if (Object.keys(errors).length > 0) return {errors};
	const body: AuditNamedSinkWrite = {...shared, enterprise_number: enterprise};
	const filter = normalFilter({streams: form.streams, services: anyService ? services : [], outcome: form.outcome, data_sample: sample.value});
	if (filter) body.filter = filter;
	return {name, body, errors};
}

// The gateway reports a filter only when it keeps something out: a sample of
// 0 or 1 keeps every record, and so does an empty list.
function normalFilter(filter: IAuditSinkFilter | undefined): IAuditSinkFilter | undefined {
	const streams = [...(filter?.streams ?? [])];
	const services = [...(filter?.services ?? [])];
	const outcome = filter?.outcome ?? '';
	const sample = zeroIfAbsent(filter?.data_sample) > 1 ? zeroIfAbsent(filter?.data_sample) : 0;
	if (streams.length === 0 && services.length === 0 && outcome === '' && sample === 0) return undefined;
	return {streams, services, outcome, data_sample: sample};
}

const sameList = (a: readonly string[] = [], b: readonly string[] = []) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Settable fields where the readback is not what was sent. A sink that is not
 * there at all (`read` undefined, or the compliance sink read back without
 * `enabled`) is reported as the single field `enabled`.
 */
export function sinkDiff(sent: AuditComplianceSinkWrite | AuditNamedSinkWrite, read: IAuditSink | IAuditNamedSink | undefined): string[] {
	if (!read) return ['enabled'];
	if ('enabled' in sent && (read as IAuditSink).enabled !== true) return ['enabled'];
	const out: string[] = [];
	for (const field of SINK_TEXT_FIELDS) if (sent[field] !== (read[field] ?? '')) out.push(field);
	for (const field of SINK_NUMBER_FIELDS) if (sent[field] !== zeroIfAbsent(read[field])) out.push(field);
	if ('enterprise_number' in sent) {
		const named = read as IAuditNamedSink;
		if (sent.enterprise_number !== zeroIfAbsent(named.enterprise_number)) out.push('enterprise_number');
		const a = normalFilter(sent.filter);
		const b = normalFilter(named.filter ?? undefined);
		const same = (!a && !b) || (!!a && !!b && sameList(a.streams, b.streams) && sameList(a.services, b.services) && a.outcome === b.outcome && a.data_sample === b.data_sample);
		if (!same) out.push('filter');
	}
	return out;
}
