//---------------------------------------------------------
// Audit configuration: what is sent, and how a readback is judged.
//---------------------------------------------------------
// Limits here are the gateway's handler code, not the contract: the vendored
// spec carries no minimum, maximum, enum or required list for any audit model.
// Every audit field is `omitempty`, so each readback case is written the way
// the gateway answers: zero values ABSENT.
import {describe, expect, it} from 'vitest';
import {
	AUDIT_MAX_SECONDS,
	AUDIT_POLICY_FIELDS,
	AUDIT_POLICY_START,
	IAuditNamedSinkForm,
	IAuditSinkForm,
	namedSinkForm,
	parseNamedSinkForm,
	parsePolicyForm,
	parseSinkForm,
	policyDiff,
	policyForm,
	policyReported,
	policyValues,
	sinkDiff,
	sinkForm,
} from './audit_config';

describe('audit policy — reading', () => {
	it('reads an absent field as 0, and a prune count of 0 as the 1 the gateway uses', () => {
		expect(policyValues({max_segment_bytes: 4096})).toEqual({
			max_segment_bytes: 4096,
			max_segment_age_seconds: 0,
			retention_max_age_seconds: 0,
			retention_max_bytes: 0,
			retention_reserve_bytes: 0,
			retention_max_prune_per_pass: 1,
		});
	});

	// GET /audit/policy with no writer answers `{}`; a running writer cannot.
	it('tells `{}` (no writer) from a policy that was read', () => {
		expect(policyReported({})).toBe(false);
		expect(policyReported(undefined)).toBe(false);
		expect(policyReported({retention_max_prune_per_pass: 1})).toBe(true);
		// A zero that is present is still an answer.
		expect(policyReported({max_segment_bytes: 0})).toBe(true);
	});

	it('pins what a gateway starts with: 64 MiB, 24 h, no retention limit, one deletion per pass', () => {
		expect(AUDIT_POLICY_START).toEqual({
			max_segment_bytes: 67_108_864,
			max_segment_age_seconds: 86_400,
			retention_max_age_seconds: 0,
			retention_max_bytes: 0,
			retention_reserve_bytes: 0,
			retention_max_prune_per_pass: 1,
		});
	});
});

describe('audit policy — the form', () => {
	const form = (o: Partial<Record<(typeof AUDIT_POLICY_FIELDS)[number], string>> = {}) => ({...policyForm(AUDIT_POLICY_START), ...o});

	// A POST replaces the whole policy: a field left out becomes 0, which for
	// a retention limit means "no limit". So all six, always, zeros included.
	it('yields all six fields, zeros included', () => {
		const {values, errors} = parsePolicyForm(form());
		expect(errors).toEqual({});
		expect(Object.keys(values!).sort()).toEqual([...AUDIT_POLICY_FIELDS].sort());
		expect(JSON.parse(JSON.stringify(values))).toEqual(AUDIT_POLICY_START);
	});

	it.each(['', ' ', '-1', '1.5', '1e3', 'abc', '0x10'])('refuses %j: a blank is not sent as 0', text => {
		const {values, errors} = parsePolicyForm(form({retention_max_bytes: text}));
		expect(values).toBeUndefined();
		expect(errors).toEqual({retention_max_bytes: 'not_whole'});
	});

	// seconds × 1e9 must fit a signed 64-bit duration on the gateway.
	it('caps seconds below the duration overflow, on both age fields', () => {
		expect(parsePolicyForm(form({max_segment_age_seconds: String(AUDIT_MAX_SECONDS)})).errors).toEqual({});
		expect(parsePolicyForm(form({max_segment_age_seconds: String(AUDIT_MAX_SECONDS + 1)})).errors).toEqual({max_segment_age_seconds: 'too_large'});
		expect(parsePolicyForm(form({retention_max_age_seconds: String(AUDIT_MAX_SECONDS + 1)})).errors).toEqual({retention_max_age_seconds: 'too_large'});
		// 9_223_372_036 s × 1e9 ns is within 2^63 − 1; one more is not.
		expect(BigInt(AUDIT_MAX_SECONDS) * 1_000_000_000n <= 2n ** 63n - 1n).toBe(true);
		expect(BigInt(AUDIT_MAX_SECONDS + 1) * 1_000_000_000n > 2n ** 63n - 1n).toBe(true);
	});

	it('refuses a byte count that would not survive as a JSON number', () => {
		expect(parsePolicyForm(form({retention_max_bytes: '9007199254740993'})).errors).toEqual({retention_max_bytes: 'too_large'});
	});

	// Policy.Validate: only when both are set.
	it('refuses a quota below one segment, and only when both are limits', () => {
		expect(parsePolicyForm(form({max_segment_bytes: '1000', retention_max_bytes: '999'})).errors).toEqual({retention_max_bytes: 'below_segment'});
		expect(parsePolicyForm(form({max_segment_bytes: '1000', retention_max_bytes: '1000'})).errors).toEqual({});
		expect(parsePolicyForm(form({max_segment_bytes: '1000', retention_max_bytes: '0'})).errors).toEqual({});
		expect(parsePolicyForm(form({max_segment_bytes: '0', retention_max_bytes: '5'})).errors).toEqual({});
	});
});

describe('audit policy — judging the readback', () => {
	const sent = {...AUDIT_POLICY_START, retention_max_bytes: 1 << 30};

	it('confirms a readback whose zeros are absent', () => {
		expect(policyDiff(sent, {max_segment_bytes: 67_108_864, max_segment_age_seconds: 86_400, retention_max_bytes: 1 << 30, retention_max_prune_per_pass: 1})).toEqual([]);
	});

	it('confirms a prune count sent as 0 and read back as 1', () => {
		expect(policyDiff({...sent, retention_max_prune_per_pass: 0}, {max_segment_bytes: 67_108_864, max_segment_age_seconds: 86_400, retention_max_bytes: 1 << 30, retention_max_prune_per_pass: 1})).toEqual([]);
	});

	it('names each field that did not take, in display order', () => {
		expect(policyDiff(sent, {max_segment_bytes: 67_108_864, max_segment_age_seconds: 3600, retention_max_prune_per_pass: 1})).toEqual(['max_segment_age_seconds', 'retention_max_bytes']);
	});

	it('names every non-zero field against `{}`: no writer is not a confirmation', () => {
		expect(policyDiff(sent, {})).toEqual(['max_segment_bytes', 'max_segment_age_seconds', 'retention_max_bytes']);
		expect(policyDiff(sent, undefined)).toEqual(['max_segment_bytes', 'max_segment_age_seconds', 'retention_max_bytes']);
	});
});

const SINK: IAuditSinkForm = {
	address: 'siem.example:6514',
	ca_bundle_path: '/etc/loxilb/siem-ca.pem',
	server_name: '',
	client_cert_path: '',
	client_key_path: '',
	facility: '',
	max_frame_bytes: '',
};

describe('compliance sink — the form', () => {
	it('sends the settable fields and `enabled`, and nothing the gateway reports', () => {
		const {body, errors} = parseSinkForm(SINK);
		expect(errors).toEqual({});
		expect(body).toEqual({
			enabled: true,
			address: 'siem.example:6514',
			ca_bundle_path: '/etc/loxilb/siem-ca.pem',
			server_name: '',
			client_cert_path: '',
			client_key_path: '',
			facility: 0,
			max_frame_bytes: 0,
		});
	});

	// A form filled from a readback must not send the readback's counters back.
	it('drops the read-only fields of the answer it was filled from', () => {
		const form = sinkForm({enabled: true, connected: true, address: 'siem.example:6514', ca_bundle_path: '/ca.pem', facility: 16, submitted: 90, truncated: 2, write_errors: 3, last_error: 'x'});
		expect(form).toEqual({...SINK, ca_bundle_path: '/ca.pem', facility: '16'});
		expect(Object.keys(parseSinkForm(form).body!).sort()).toEqual(['address', 'ca_bundle_path', 'client_cert_path', 'client_key_path', 'enabled', 'facility', 'max_frame_bytes', 'server_name']);
	});

	it('requires an address and a CA bundle: there is no unverified mode', () => {
		expect(parseSinkForm({...SINK, address: ' ', ca_bundle_path: ''}).errors).toEqual({address: 'required', ca_bundle_path: 'required'});
	});

	it.each(['siem.example', 'siem.example:', ':6514', 'a:b:6514', 'siem.example:syslog', 'siem example:6514'])('refuses the address %j', address => {
		expect(parseSinkForm({...SINK, address}).errors).toEqual({address: 'address'});
	});

	it.each(['10.0.0.9:6514', '[2001:db8::9]:6514', 'siem-1.example.com:514'])('accepts the address %j', address => {
		expect(parseSinkForm({...SINK, address}).errors).toEqual({});
	});

	it('wants the client certificate and its key together or not at all, and points at the missing one', () => {
		expect(parseSinkForm({...SINK, client_cert_path: '/c.pem'}).errors).toEqual({client_key_path: 'pair'});
		expect(parseSinkForm({...SINK, client_key_path: '/k.pem'}).errors).toEqual({client_cert_path: 'pair'});
		expect(parseSinkForm({...SINK, client_cert_path: '/c.pem', client_key_path: '/k.pem'}).errors).toEqual({});
	});

	it('bounds the facility at 0..23 and the frame cap at 0..2^30', () => {
		expect(parseSinkForm({...SINK, facility: '23', max_frame_bytes: String(1 << 30)}).errors).toEqual({});
		expect(parseSinkForm({...SINK, facility: '24'}).errors).toEqual({facility: 'out_of_range'});
		expect(parseSinkForm({...SINK, max_frame_bytes: String((1 << 30) + 1)}).errors).toEqual({max_frame_bytes: 'out_of_range'});
		expect(parseSinkForm({...SINK, facility: '-1'}).errors).toEqual({facility: 'not_whole'});
	});
});

describe('compliance sink — judging the readback', () => {
	const sent = parseSinkForm({...SINK, facility: '16'}).body!;

	// `connected` is false right after a save, until the first record: it is
	// not a settable field and plays no part.
	it('confirms a saved sink that is not connected yet', () => {
		expect(sinkDiff(sent, {enabled: true, address: 'siem.example:6514', ca_bundle_path: '/etc/loxilb/siem-ca.pem', facility: 16})).toEqual([]);
	});

	// The API stores the facility as sent: 0 stays 0 (absent) and goes on the
	// wire as 13. So "blank" reads back absent, not 13.
	it('confirms a blank facility read back absent', () => {
		expect(sinkDiff(parseSinkForm(SINK).body!, {enabled: true, address: 'siem.example:6514', ca_bundle_path: '/etc/loxilb/siem-ca.pem'})).toEqual([]);
	});

	it('reports a sink that is not there as `enabled`, whatever else matches', () => {
		expect(sinkDiff(sent, {})).toEqual(['enabled']);
		expect(sinkDiff(sent, undefined)).toEqual(['enabled']);
	});

	it('names the settable fields that differ', () => {
		expect(sinkDiff(sent, {enabled: true, address: 'old.example:6514', ca_bundle_path: '/etc/loxilb/siem-ca.pem', facility: 13})).toEqual(['address', 'facility']);
	});
});

const NAMED: IAuditNamedSinkForm = {...SINK, name: 'edr', enterprise_number: '32473', streams: [], services: '', outcome: '', data_sample: ''};

describe('named sink — the form', () => {
	it('has no `enabled`, carries the enterprise number, and sends no filter that keeps everything', () => {
		const {name, body, errors} = parseNamedSinkForm({...NAMED, data_sample: '1'});
		expect(errors).toEqual({});
		expect(name).toBe('edr');
		expect(body).toEqual({
			address: 'siem.example:6514',
			ca_bundle_path: '/etc/loxilb/siem-ca.pem',
			server_name: '',
			client_cert_path: '',
			client_key_path: '',
			facility: 0,
			max_frame_bytes: 0,
			enterprise_number: 32473,
		});
	});

	it('builds the filter from what was chosen', () => {
		const {body} = parseNamedSinkForm({...NAMED, streams: ['mgmt', 'data'], services: 'chat, embed', outcome: 'failed', data_sample: '10'});
		expect(body!.filter).toEqual({streams: ['mgmt', 'data'], services: ['chat', 'embed'], outcome: 'failed', data_sample: 10});
	});

	it.each(['', 'EDR', 'edr.1', 'a b', 'x'.repeat(65), 'edr/1'])('refuses the name %j', name => {
		expect(parseNamedSinkForm({...NAMED, name}).errors).toEqual({name: 'name'});
	});

	it('refuses the compliance sink\'s own name', () => {
		expect(parseNamedSinkForm({...NAMED, name: 'compliance'}).errors).toEqual({name: 'reserved_name'});
	});

	it('requires an enterprise number in 1..2^32−1: none is built in', () => {
		expect(parseNamedSinkForm({...NAMED, enterprise_number: ''}).errors).toEqual({enterprise_number: 'required'});
		expect(parseNamedSinkForm({...NAMED, enterprise_number: '0'}).errors).toEqual({enterprise_number: 'out_of_range'});
		expect(parseNamedSinkForm({...NAMED, enterprise_number: '4294967296'}).errors).toEqual({enterprise_number: 'out_of_range'});
		expect(parseNamedSinkForm({...NAMED, enterprise_number: '4294967295'}).errors).toEqual({});
	});

	it('refuses an empty service name between commas', () => {
		expect(parseNamedSinkForm({...NAMED, services: 'chat,,embed'}).errors).toEqual({services: 'service'});
	});

	it('fills the form from a readback, filter included', () => {
		expect(namedSinkForm('edr', {name: 'edr', address: 'siem.example:6514', ca_bundle_path: '/ca.pem', enterprise_number: 32473, state: 'connected', poison: 2, filter: {streams: ['mgmt'], services: ['chat'], outcome: 'ok', data_sample: 5}})).toEqual({
			...NAMED,
			ca_bundle_path: '/ca.pem',
			streams: ['mgmt'],
			services: 'chat',
			outcome: 'ok',
			data_sample: '5',
		});
	});
});

describe('named sink — judging the readback', () => {
	const base = {name: 'edr', address: 'siem.example:6514', ca_bundle_path: '/etc/loxilb/siem-ca.pem', enterprise_number: 32473, state: 'starting'};

	it('confirms a sink with no filter read back with none', () => {
		expect(sinkDiff(parseNamedSinkForm(NAMED).body!, base)).toEqual([]);
	});

	// The gateway reports the filter only when it keeps something out.
	it('treats a sample of 1 and an absent filter as the same thing', () => {
		expect(sinkDiff({...parseNamedSinkForm(NAMED).body!, filter: {streams: [], services: [], outcome: '', data_sample: 1}}, base)).toEqual([]);
	});

	it('names the filter when it differs, and the enterprise number', () => {
		const sent = parseNamedSinkForm({...NAMED, streams: ['mgmt'], enterprise_number: '9'}).body!;
		expect(sinkDiff(sent, {...base, filter: {streams: ['data'], services: []}})).toEqual(['enterprise_number', 'filter']);
		expect(sinkDiff(sent, {...base, enterprise_number: 9})).toEqual(['filter']);
	});

	it('reports a sink that a single read did not find as `enabled`', () => {
		expect(sinkDiff(parseNamedSinkForm(NAMED).body!, undefined)).toEqual(['enabled']);
	});
});
