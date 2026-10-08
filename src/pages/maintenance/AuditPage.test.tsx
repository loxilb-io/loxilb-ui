//---------------------------------------------------------
// Audit Trail page.
//
// What these pin:
//   - `{}` from the policy read is "no writer", shown as unknown, never as
//     six zeros, and nothing can be sent to it;
//   - a change is reported from the read made after it: accepted-and-matches,
//     accepted-but-differs, and no-answer are three different sentences;
//   - a refusal (the gateway's 400 names no field) and a change with no
//     answer keep the dialog open with what was typed;
//   - a write carries the settable fields only, and a policy write all six;
//   - an operator reads everything and is offered no control;
//   - a sink that was just saved and is not connected yet raises no alarm;
//   - a delete is confirmed by one read by name answering "no such sink".
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {AUDIT_POLICY_START} from 'types/audit_config';
import AuditPage from './AuditPage';

type Popup = {title: string; contents: unknown; yes?: string; onYes?: () => void | Promise<void>};
type Q = Record<string, unknown>;

const state = vi.hoisted(() => ({
	isAdmin: true,
	popups: [] as Popup[],
	status: {} as Q,
	statusRefetches: 0,
	policy: {} as Q,
	policyAfter: undefined as unknown,
	policyRefetchFails: false,
	sink: {} as Q,
	sinkAfter: undefined as unknown,
	named: {} as Record<string, Q>,
	namedRefetches: [] as string[],
	api: {
		setPolicy: vi.fn(),
		rotate: vi.fn(),
		setSink: vi.fn(),
		disableSink: vi.fn(),
		putNamed: vi.fn(),
		deleteNamed: vi.fn(),
		getNamed: vi.fn(),
	},
}));

vi.mock('hooks/instanceHook', () => ({useInstanceFromURL: () => ({id: 5, name: 'gw'})}));
vi.mock('hooks/query/oamHooks', () => ({useRole: () => ({is_admin: state.isAdmin})}));
vi.mock('hooks/popupHook', () => ({
	usePopUp: () => ({
		openPopUp: (title: string, contents: unknown, yes?: string, _no?: string, onYes?: () => void | Promise<void>) => {
			state.popups.push({title, contents, yes, onYes});
		},
	}),
}));
vi.mock('hooks/query/statusHook', () => ({
	useGatewayAuditRest: () => ({
		...state.status,
		refetch: async () => {
			state.statusRefetches += 1;
		},
	}),
}));
vi.mock('hooks/query/auditHooks', () => ({
	useAuditPolicy: () => ({
		...state.policy,
		refetch: async () => (state.policyRefetchFails ? {isError: true, data: state.policy.data} : {isError: false, data: state.policyAfter ?? state.policy.data}),
	}),
	useAuditSink: () => ({...state.sink, refetch: async () => ({isError: false, data: state.sinkAfter ?? state.sink.data})}),
	useAuditNamedSinks: (_inst: unknown, names: string[]) =>
		names.map(name => ({
			...(state.named[name] ?? {data: undefined, isError: false}),
			refetch: async () => {
				state.namedRefetches.push(name);
			},
		})),
}));
vi.mock('connector/instance/audit', () => ({
	request_set_audit_policy: state.api.setPolicy,
	request_rotate_audit_segment: state.api.rotate,
	request_set_audit_sink: state.api.setSink,
	request_disable_audit_sink: state.api.disableSink,
	request_put_audit_named_sink: state.api.putNamed,
	request_delete_audit_named_sink: state.api.deleteNamed,
	query_get_audit_named_sink: state.api.getNamed,
}));

const loaded = (data: unknown) => ({data, error: null, isError: false, dataUpdatedAt: Date.now(), isFetching: false, isPending: false});
const ok = (extra: Q = {}) => ({status: 'confirmed', code: 'x.ok', localeKey: 'ok', retryable: false, httpStatus: 204, ...extra});
const refused = {status: 'invalid', code: 'x.invalid', localeKey: 'The request was rejected as invalid.', retryable: false, httpStatus: 400};
const noAnswer = {status: 'unknown', code: 'x.unknown', localeKey: 'No answer.', retryable: false, httpStatus: 504};

// The way the gateway answers: zeros absent.
const POLICY = {max_segment_bytes: 67_108_864, max_segment_age_seconds: 86_400};
const SINK = {enabled: true, address: 'siem.example:6514', ca_bundle_path: '/etc/loxilb/ca.pem', submitted: 90, write_errors: 2, last_error: 'broken pipe'};
const EDR = {name: 'edr', address: 'edr.example:6514', ca_bundle_path: '/etc/loxilb/ca.pem', enterprise_number: 32473, state: 'connected', poison: 3};

const statOf = (scope: HTMLElement, label: string) => within(scope).getByText(label).parentElement?.lastElementChild?.textContent;
const section = (id: string) => screen.getByTestId(id);
const button = (scope: HTMLElement, name: string) => within(scope).queryByRole('button', {name});
const field = (name: string) => screen.getByTestId(`audit-field-${name}`) as HTMLInputElement;
const type = (name: string, value: string) => fireEvent.change(field(name), {target: {value}});
const lastPopup = () => state.popups[state.popups.length - 1];
const dialog = () => screen.queryByRole('dialog');
const save = () => fireEvent.click(within(dialog()!).getByRole('button', {name: 'Save'}));

beforeEach(() => {
	state.isAdmin = true;
	state.popups = [];
	state.statusRefetches = 0;
	state.status = loaded({kind: 'ok', status: {available: true, sinks: null}});
	state.policy = loaded(POLICY);
	state.policyAfter = undefined;
	state.policyRefetchFails = false;
	state.sink = loaded({});
	state.sinkAfter = undefined;
	state.named = {};
	state.namedRefetches = [];
	for (const fn of Object.values(state.api)) fn.mockReset();
});
afterEach(cleanup);

describe('AuditPage — policy', () => {
	it('shows the six values, absent as 0 and the prune count as the 1 the gateway uses', () => {
		render(<AuditPage />);
		const s = section('audit-policy');
		expect(statOf(s, 'Seal a segment at (bytes)')).toBe('67108864');
		expect(statOf(s, 'Seal a segment after (seconds)')).toBe('86400');
		expect(statOf(s, 'Keep at most (bytes of sealed segments)')).toBe('0');
		expect(statOf(s, 'Deletions per retention pass')).toBe('1');
	});

	it.each([
		['the policy read answers {}', {available: true, sinks: null}, {}],
		['the status says there is no writer', {available: false}, POLICY],
	])('says the policy is unknown, shows no value and offers no change, when %s', (_why, status, policy) => {
		state.status = loaded({kind: 'ok', status});
		state.policy = loaded(policy);
		render(<AuditPage />);
		const s = section('audit-policy');
		expect(within(s).getByText(/No audit writer is running on this gateway.*The values are unknown, not zero\./)).toBeTruthy();
		expect(within(s).queryByText('Seal a segment at (bytes)')).toBeNull();
		expect(button(s, 'Change')).toBeNull();
		expect(button(s, 'Seal the segment now')).toBeNull();
	});

	it('gives an operator the values and the reason there are no controls', () => {
		state.isAdmin = false;
		state.sink = loaded(SINK);
		render(<AuditPage />);
		expect(screen.getByTestId('audit-read-only').textContent).toMatch(/needs the administrator role/);
		expect(statOf(section('audit-policy'), 'Seal a segment at (bytes)')).toBe('67108864');
		expect(screen.queryAllByRole('button', {name: /Change|Reset|Seal|Stop|Configure|Add a sink|Delete/})).toEqual([]);
	});

	it('does not send a blank field as 0: it stays in the dialog with the reason', () => {
		render(<AuditPage />);
		fireEvent.click(button(section('audit-policy'), 'Change')!);
		type('retention_max_bytes', '');
		save();
		expect(within(dialog()!).getByText('Enter a whole number, 0 or more.')).toBeTruthy();
		expect(state.api.setPolicy).not.toHaveBeenCalled();
	});

	it('sends all six values and reports success from the readback, zeros absent', async () => {
		state.api.setPolicy.mockResolvedValue(ok());
		state.policyAfter = {...POLICY, retention_max_bytes: 1_073_741_824, retention_max_prune_per_pass: 1};
		render(<AuditPage />);
		fireEvent.click(button(section('audit-policy'), 'Change')!);
		// Filled from the readback: the prune count shows the 1 in use.
		expect(field('retention_max_prune_per_pass').value).toBe('1');
		type('retention_max_bytes', '1073741824');
		save();
		await waitFor(() => expect(lastPopup()?.title).toBe('Success'));
		expect(state.api.setPolicy).toHaveBeenCalledWith(expect.objectContaining({id: 5}), {...AUDIT_POLICY_START, retention_max_bytes: 1_073_741_824});
		expect(lastPopup().contents).toBe('Saved. The gateway reads back what was sent.');
		expect(dialog()).toBeNull();
	});

	it('does not call an accepted change a success when the readback differs, and names the field', async () => {
		state.api.setPolicy.mockResolvedValue(ok());
		state.policyAfter = POLICY;
		render(<AuditPage />);
		fireEvent.click(button(section('audit-policy'), 'Change')!);
		type('retention_max_age_seconds', '3600');
		save();
		await waitFor(() => expect(lastPopup()?.title).toBe('Warning'));
		expect(lastPopup().contents).toBe('The change was accepted, but the gateway reads back something else for: Delete sealed segments older than (seconds).');
	});

	it('does not call an accepted change a success when it could not be read back', async () => {
		state.api.setPolicy.mockResolvedValue(ok());
		state.policyRefetchFails = true;
		render(<AuditPage />);
		fireEvent.click(button(section('audit-policy'), 'Change')!);
		save();
		await waitFor(() => expect(lastPopup()?.title).toBe('Warning'));
		expect(lastPopup().contents).toMatch(/could not be read back/);
	});

	// Every refusal of the handler is a 400 with no body.
	it('keeps the dialog and the input on a 400, and does not pretend to know which value', async () => {
		state.api.setPolicy.mockResolvedValue(refused);
		render(<AuditPage />);
		fireEvent.click(button(section('audit-policy'), 'Change')!);
		type('retention_reserve_bytes', '123456');
		save();
		await waitFor(() => expect(lastPopup()?.title).toBe('Error'));
		expect(lastPopup().contents).toBe('The gateway refused these values (400) and does not say which one. Nothing was changed, and what you entered is kept.');
		expect(field('retention_reserve_bytes').value).toBe('123456');
		// Usable again: the operator can correct and resend.
		await waitFor(() => expect((within(dialog()!).getByRole('button', {name: 'Save'}) as HTMLButtonElement).disabled).toBe(false));
	});

	it('reads back after a change that got no answer, and says which of the two it was', async () => {
		state.api.setPolicy.mockResolvedValue(noAnswer);
		state.policyAfter = {...POLICY, retention_reserve_bytes: 5};
		const first = render(<AuditPage />);
		fireEvent.click(button(section('audit-policy'), 'Change')!);
		type('retention_reserve_bytes', '5');
		save();
		await waitFor(() => expect(lastPopup()?.title).toBe('Success'));
		expect(lastPopup().contents).toBe('No answer came back for the change, but the gateway now reads back what was sent.');
		first.unmount();

		state.policyAfter = POLICY;
		render(<AuditPage />);
		fireEvent.click(button(section('audit-policy'), 'Change')!);
		type('retention_reserve_bytes', '5');
		save();
		await waitFor(() => expect(lastPopup()?.title).toBe('Warning'));
		expect(lastPopup().contents).toMatch(/does not read back what was sent \(Free space to keep on the audit filesystem \(bytes\)\)\. It may not have been applied/);
		expect(dialog()).not.toBeNull();
	});

	it('resets to the starting values only after the operator confirms, with all six sent', async () => {
		state.api.setPolicy.mockResolvedValue(ok());
		state.policy = loaded({...POLICY, retention_max_bytes: 999_999_999});
		state.policyAfter = {...POLICY, retention_max_prune_per_pass: 1};
		render(<AuditPage />);
		fireEvent.click(button(section('audit-policy'), 'Reset to starting values')!);
		expect(state.api.setPolicy).not.toHaveBeenCalled();
		await lastPopup().onYes?.();
		expect(state.api.setPolicy).toHaveBeenCalledWith(expect.anything(), AUDIT_POLICY_START);
		expect(lastPopup().title).toBe('Success');
	});

	it('reports a rotation with both segment identifiers, and a rotation with no answer as not confirmed', async () => {
		state.api.rotate.mockResolvedValue(ok({httpStatus: 200, data: {sealed_segment_uuid: 'seg-a', new_segment_uuid: 'seg-b'}}));
		render(<AuditPage />);
		fireEvent.click(button(section('audit-policy'), 'Seal the segment now')!);
		await lastPopup().onYes?.();
		expect(lastPopup().contents).toBe('Sealed segment seg-a. The gateway now writes segment seg-b. These are the identifiers recorded in the trail.');

		state.api.rotate.mockResolvedValue(noAnswer);
		fireEvent.click(button(section('audit-policy'), 'Seal the segment now')!);
		await lastPopup().onYes?.();
		expect(lastPopup().title).toBe('Warning');
		expect(lastPopup().contents).toMatch(/^The segment was not confirmed sealed\./);
	});
});

describe('AuditPage — compliance sink', () => {
	it('says what no sink means, and offers to configure one', () => {
		render(<AuditPage />);
		const s = section('audit-compliance-sink');
		expect(within(s).getByText(/No compliance sink is configured: no record leaves the gateway in full/)).toBeTruthy();
		expect(button(s, 'Configure')).not.toBeNull();
		expect(button(s, 'Stop')).toBeNull();
	});

	// `connected` is false after a successful save until the first record.
	it('shows a sink with no session yet as a plain row, with no alarm', () => {
		state.sink = loaded(SINK);
		render(<AuditPage />);
		const s = section('audit-compliance-sink');
		expect(statOf(s, 'Session established')).toBe('No');
		expect(statOf(s, 'Syslog facility')).toBe('13 (default)');
		expect(statOf(s, 'Largest message (bytes)')).toBe('No limit');
		expect(statOf(s, 'Failed submissions')).toBe('2');
		expect(within(s).queryByRole('alert')).toBeNull();
	});

	it('saves the settable fields only, and confirms a readback that is not connected yet', async () => {
		state.sink = loaded(SINK);
		state.sinkAfter = {enabled: true, address: 'siem2.example:6514', ca_bundle_path: '/etc/loxilb/ca.pem'};
		state.api.setSink.mockResolvedValue(ok());
		render(<AuditPage />);
		fireEvent.click(button(section('audit-compliance-sink'), 'Change')!);
		type('address', 'siem2.example:6514');
		save();
		await waitFor(() => expect(lastPopup()?.title).toBe('Success'));
		expect(state.api.setSink.mock.calls[0][1]).toEqual({
			enabled: true,
			address: 'siem2.example:6514',
			ca_bundle_path: '/etc/loxilb/ca.pem',
			server_name: '',
			client_cert_path: '',
			client_key_path: '',
			facility: 0,
			max_frame_bytes: 0,
		});
		// The System page's sink line reads the same status.
		expect(state.statusRefetches).toBe(1);
	});

	it('refuses an address without a port before sending', () => {
		render(<AuditPage />);
		fireEvent.click(button(section('audit-compliance-sink'), 'Configure')!);
		type('address', 'siem.example');
		type('ca_bundle_path', '/ca.pem');
		save();
		expect(within(dialog()!).getByText(/Enter one host and one port/)).toBeTruthy();
		expect(state.api.setSink).not.toHaveBeenCalled();
	});

	it('stops the sink after confirmation, and judges it by `enabled` not being true in the readback', async () => {
		state.sink = loaded(SINK);
		state.sinkAfter = {};
		state.api.disableSink.mockResolvedValue(ok());
		render(<AuditPage />);
		fireEvent.click(button(section('audit-compliance-sink'), 'Stop')!);
		expect(state.api.disableSink).not.toHaveBeenCalled();
		await lastPopup().onYes?.();
		expect(lastPopup().title).toBe('Success');

		state.sinkAfter = SINK;
		fireEvent.click(button(section('audit-compliance-sink'), 'Stop')!);
		await lastPopup().onYes?.();
		expect(lastPopup().title).toBe('Warning');
		expect(lastPopup().contents).toMatch(/reads back something else for: Whether the sink exists/);
	});
});

describe('AuditPage — named sinks', () => {
	const withEdr = () => {
		state.status = loaded({kind: 'ok', status: {available: true, sinks: [{name: 'compliance', compliance: true, state: 'connected'}, {name: 'edr', state: 'connected'}]}});
		state.named = {edr: {data: EDR, isError: false}};
	};

	it('says the sinks are unknown, not none, when the status does not list them, and offers no Add', () => {
		state.status = loaded({kind: 'ok', status: {available: true}});
		render(<AuditPage />);
		const s = section('audit-named-sinks');
		expect(within(s).getByRole('alert').textContent).toMatch(/the named sinks are unknown, not none/);
		expect(button(s, 'Add a sink')).toBeNull();
	});

	it('says the same when the status read failed', () => {
		state.status = {...loaded({kind: 'ok', status: {available: true, sinks: null}}), isError: true};
		render(<AuditPage />);
		expect(within(section('audit-named-sinks')).getByRole('alert').textContent).toMatch(/unknown, not none/);
	});

	it('lists the named sinks and leaves the compliance sink to its own section', () => {
		withEdr();
		render(<AuditPage />);
		expect(screen.queryByTestId('audit-named-sink-compliance')).toBeNull();
		const card = section('audit-named-sink-edr');
		expect(statOf(card, 'State')).toBe('connected');
		expect(statOf(card, 'Enterprise number')).toBe('32473');
		expect(statOf(card, 'Records passed over')).toBe('3');
		expect(statOf(card, 'Filter')).toBe('None: every record');
	});

	it('does not show a sink the read by name could not find, or could not read, as an empty one', () => {
		withEdr();
		state.named = {edr: {data: null, isError: false}};
		const first = render(<AuditPage />);
		expect(within(section('audit-named-sink-edr')).getByText(/a read by name did not find it/)).toBeTruthy();
		expect((button(section('audit-named-sink-edr'), 'Change') as HTMLButtonElement).disabled).toBe(true);
		first.unmount();

		state.named = {edr: {data: undefined, isError: true}};
		render(<AuditPage />);
		expect(within(section('audit-named-sink-edr')).getByText(/settings are unknown, not empty/)).toBeTruthy();
	});

	// A PUT to a name in use replaces that sink and restarts its counters.
	it('refuses to add under a name that is taken, before sending', () => {
		withEdr();
		render(<AuditPage />);
		fireEvent.click(button(section('audit-named-sinks'), 'Add a sink')!);
		type('name', 'edr');
		type('address', 'x.example:6514');
		type('ca_bundle_path', '/ca.pem');
		type('enterprise_number', '32473');
		save();
		expect(within(dialog()!).getByText('A sink of this name already exists. Edit that one instead.')).toBeTruthy();
		expect(state.api.putNamed).not.toHaveBeenCalled();
	});

	it('adds a sink, confirms it by one read by name, and refreshes the list', async () => {
		withEdr();
		state.api.putNamed.mockResolvedValue(ok());
		state.api.getNamed.mockResolvedValue({name: 'lake', address: 'lake.example:6514', ca_bundle_path: '/ca.pem', enterprise_number: 32473, state: 'starting', filter: {streams: ['mgmt'], services: []}});
		render(<AuditPage />);
		fireEvent.click(button(section('audit-named-sinks'), 'Add a sink')!);
		type('name', 'lake');
		type('address', 'lake.example:6514');
		type('ca_bundle_path', '/ca.pem');
		type('enterprise_number', '32473');
		fireEvent.click(within(dialog()!).getByRole('checkbox', {name: 'mgmt'}));
		save();
		await waitFor(() => expect(lastPopup()?.title).toBe('Success'));
		expect(state.api.putNamed.mock.calls[0].slice(1)).toEqual([
			'lake',
			{address: 'lake.example:6514', ca_bundle_path: '/ca.pem', server_name: '', client_cert_path: '', client_key_path: '', facility: 0, max_frame_bytes: 0, enterprise_number: 32473, filter: {streams: ['mgmt'], services: [], outcome: '', data_sample: 0}},
		]);
		expect(state.api.getNamed).toHaveBeenCalledWith(expect.anything(), 'lake');
		expect(state.statusRefetches).toBe(1);
	});

	it('locks the name when changing a sink, and sends none of its counters back', async () => {
		withEdr();
		state.api.putNamed.mockResolvedValue(ok());
		state.api.getNamed.mockResolvedValue({...EDR, facility: 16});
		render(<AuditPage />);
		fireEvent.click(button(section('audit-named-sink-edr'), 'Change')!);
		expect(field('name').disabled).toBe(true);
		type('facility', '16');
		save();
		await waitFor(() => expect(lastPopup()?.title).toBe('Success'));
		expect(state.api.putNamed.mock.calls[0][1]).toBe('edr');
		expect(Object.keys(state.api.putNamed.mock.calls[0][2]).sort()).toEqual(['address', 'ca_bundle_path', 'client_cert_path', 'client_key_path', 'enterprise_number', 'facility', 'max_frame_bytes', 'server_name']);
		expect(state.namedRefetches).toEqual(['edr']);
	});

	it('confirms a delete by one read by name answering no such sink', async () => {
		withEdr();
		state.api.deleteNamed.mockResolvedValue(ok());
		state.api.getNamed.mockResolvedValue(null);
		render(<AuditPage />);
		fireEvent.click(button(section('audit-named-sink-edr'), 'Delete')!);
		expect(state.api.deleteNamed).not.toHaveBeenCalled();
		await lastPopup().onYes?.();
		expect(state.api.deleteNamed).toHaveBeenCalledWith(expect.anything(), 'edr');
		expect(state.api.getNamed).toHaveBeenCalledTimes(1);
		expect(lastPopup().title).toBe('Success');
	});

	it('does not call a delete done while the sink still answers, or when the read failed', async () => {
		withEdr();
		state.api.deleteNamed.mockResolvedValue(ok());
		state.api.getNamed.mockResolvedValue(EDR);
		render(<AuditPage />);
		fireEvent.click(button(section('audit-named-sink-edr'), 'Delete')!);
		await lastPopup().onYes?.();
		expect(lastPopup().title).toBe('Warning');
		expect(lastPopup().contents).toMatch(/Whether the sink exists/);

		state.api.getNamed.mockRejectedValue(new Error('503'));
		fireEvent.click(button(section('audit-named-sink-edr'), 'Delete')!);
		await lastPopup().onYes?.();
		expect(lastPopup().contents).toMatch(/could not be read back/);
	});

	it('does not read back after a refusal: nothing was sent to confirm', async () => {
		withEdr();
		state.api.deleteNamed.mockResolvedValue({status: 'denied', code: 'x.denied', localeKey: 'Permission denied.', retryable: false, httpStatus: 403});
		render(<AuditPage />);
		fireEvent.click(button(section('audit-named-sink-edr'), 'Delete')!);
		await lastPopup().onYes?.();
		expect(lastPopup().title).toBe('Error');
		expect(state.api.getNamed).not.toHaveBeenCalled();
	});
});

describe('AuditPage — gateway without the audit API', () => {
	it('says so and renders no section', () => {
		state.status = loaded({kind: 'absent'});
		render(<AuditPage />);
		expect(screen.getByText('This gateway has no audit API, so there is nothing to configure here.')).toBeTruthy();
		expect(screen.queryByTestId('audit-policy')).toBeNull();
	});
});
