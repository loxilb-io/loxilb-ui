//---------------------------------------------------------
// Backend TLS on the LB rule form: verification, the CA and client
// certificate IDs, and the server name.
//
// Pins: the group is offered only where this gateway takes the request, it is
// usable only on the re-encrypting leg (fullproxy + e2ehttps), a change is
// emitted as a delta that keeps what else a read-back carried, and what the
// gateway would refuse is said beside the field.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {IServiceArguments} from 'types/load_balancer';
import AdvancedSettingsForm from './AdvancedSettingsForm';

const gateway = vi.hoisted(() => ({knowsField: true}));

vi.mock('hooks/query/flavorHook', () => ({
	useInstanceCapabilities: () => ({
		resolved: true,
		flavor: 'inference-gateway',
		hasField: (_context: string, field: string) => field !== 'backend_tls_server_name' || gateway.knowsField,
		hasFeature: () => true,
		allowedEnum: (_site: string, values: unknown[]) => values,
		resolution: {state: 'resolved'},
	}),
}));

// The ID checks beside the two certificate IDs read the instance from the URL.
vi.mock('hooks/instanceHook', () => ({useInstanceFromURL: () => ({id: 1, name: 'gw'})}));

// What a gateway with the feature declares; one from before it has the two IDs only.
const DECLARED = {backend_ca_cert_id: {type: 'string'}, backend_client_cert_id: {type: 'string'}, backend_tls_server_name: {type: 'string'}};
const BEFORE_FEATURE = {backend_ca_cert_id: {type: 'string'}, backend_client_cert_id: {type: 'string'}};
const LABELS = ['Verify Backend Certificate', 'Backend CA Cert ID', 'Backend Client Cert ID', 'Backend TLS Server Name'];

function args(over: Partial<IServiceArguments> = {}): IServiceArguments {
	return {name: 'r', externalIP: '192.0.2.10', inactiveTimeOut: 0, port: 8443, protocol: 'tcp', mode: 4, security: 2, ...over};
}

function renderForm(value: IServiceArguments, params: Record<string, unknown> = DECLARED) {
	const onChange = vi.fn();
	render(<AdvancedSettingsForm value={value} onChange={onChange} params={params} />);
	return onChange;
}

// By label text: the section is a collapsed accordion, and an accessible name
// is not computed from a hidden label.
const control = (label: string) => screen.queryByLabelText(label) as HTMLInputElement | null;
const offered = () => LABELS.filter(label => control(label) !== null);

afterEach(() => {
	cleanup();
	gateway.knowsField = true;
});

describe('backend TLS group', () => {
	it('is offered where the gateway declares the server name', () => {
		renderForm(args());
		expect(offered()).toEqual(LABELS);
	});

	it('is not offered by a gateway that declares only the certificate IDs, which it refuses', () => {
		renderForm(args(), BEFORE_FEATURE);
		expect(offered()).toEqual([]);
	});

	it('is not offered on an instance whose contract has no such field', () => {
		gateway.knowsField = false;
		renderForm(args());
		expect(offered()).toEqual([]);
	});

	it('is locked off the re-encrypting leg, and shows verification as off there', () => {
		renderForm(args({security: 1, mtls_backend: {verify_server_cert: true}, backend_ca_cert_id: 'backend-ca'}));
		for (const label of LABELS) expect(control(label)?.disabled, label).toBe(true);
		expect(control('Verify Backend Certificate')?.checked).toBe(false);
		cleanup();

		renderForm(args({mode: 0}));
		for (const label of LABELS) expect(control(label)?.disabled, label).toBe(true);
	});

	it('emits a change as a delta', () => {
		const onChange = renderForm(args());
		fireEvent.change(control('Backend TLS Server Name')!, {target: {value: 'api.internal'}});
		expect(onChange).toHaveBeenLastCalledWith({backend_tls_server_name: 'api.internal'});
		fireEvent.change(control('Backend CA Cert ID')!, {target: {value: 'backend-ca'}});
		expect(onChange).toHaveBeenLastCalledWith({backend_ca_cert_id: 'backend-ca'});
	});

	it('switches verification on without losing what else mtls_backend carried', () => {
		const read = {client_cert_path: '/old/path'} as IServiceArguments['mtls_backend'];
		const onChange = renderForm(args({mtls_backend: read}));
		fireEvent.click(control('Verify Backend Certificate')!);
		expect(onChange).toHaveBeenLastCalledWith({mtls_backend: {client_cert_path: '/old/path', verify_server_cert: true}});
	});

	it('says beside the field what the gateway would refuse', () => {
		renderForm(args({mtls_backend: {verify_server_cert: true}}));
		expect(screen.getByText('Backend verification needs a CA certificate ID: there is no default trust store.')).toBeTruthy();
		cleanup();

		renderForm(args({backend_ca_cert_id: 'backend-ca'}));
		expect(screen.getByText('A backend CA certificate ID has no effect unless backend verification is on.')).toBeTruthy();
		cleanup();

		renderForm(args({backend_tls_server_name: '10.0.0.1'}));
		expect(screen.getByText(/must be a DNS name, not an address/)).toBeTruthy();
	});

	it('says nothing for a complete request, and nothing off the leg where the fields are not sent', () => {
		renderForm(args({mtls_backend: {verify_server_cert: true}, backend_ca_cert_id: 'backend-ca', backend_client_cert_id: 'backend-client', backend_tls_server_name: 'api.internal'}));
		expect(screen.queryByText(/CA certificate ID|DNS name|certificate ID\./)).toBeNull();
		cleanup();

		renderForm(args({security: 1, mtls_backend: {verify_server_cert: true}}));
		expect(screen.queryByText(/needs a CA certificate ID/)).toBeNull();
	});
});
