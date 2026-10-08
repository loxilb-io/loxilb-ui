//---------------------------------------------------------
// The TLS security of a rule on the LB rule form.
//
// Frontend mTLS and backend TLS are offered by it: the first on a fullproxy
// rule that terminates TLS, the second on one that also re-encrypts. The security itself is fixed once the rule exists, so on an
// edit it is shown and cannot be changed — and it has to be shown, or the
// controls it offers are locked on every existing rule.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {IServiceArguments} from 'types/load_balancer';
import AdvancedSettingsForm from './AdvancedSettingsForm';

vi.mock('hooks/query/flavorHook', () => ({
	useInstanceCapabilities: () => ({
		resolved: true,
		flavor: 'inference-gateway',
		hasField: () => true,
		hasFeature: () => true,
		allowedEnum: (_site: string, values: unknown[]) => values,
		resolution: {state: 'resolved'},
	}),
}));

// The ID checks beside the two certificate IDs read the instance from the URL.
vi.mock('hooks/instanceHook', () => ({useInstanceFromURL: () => ({id: 1, name: 'gw'})}));

// What a gateway with backend TLS declares for a rule.
const DECLARED = {backend_ca_cert_id: {type: 'string'}, backend_client_cert_id: {type: 'string'}, backend_tls_server_name: {type: 'string'}};

function args(over: Partial<IServiceArguments> = {}): IServiceArguments {
	return {name: 'r', externalIP: '192.0.2.10', inactiveTimeOut: 0, port: 8443, protocol: 'tcp', mode: 4, ...over};
}

function renderForm(value: IServiceArguments, isEdit: boolean) {
	render(<AdvancedSettingsForm value={value} onChange={vi.fn()} params={DECLARED} isEdit={isEdit} />);
}

// By label text: the section is a collapsed accordion, and an accessible name
// is not computed from a hidden label.
const caPath = () => screen.getByLabelText('Client CA Path') as HTMLInputElement;
const backendCa = () => screen.getByLabelText('Backend CA Cert ID') as HTMLInputElement;
const securityLocked = () => screen.getByLabelText('Security').getAttribute('aria-disabled') === 'true';

afterEach(cleanup);

describe('frontend mTLS on an existing rule', () => {
	it('is open on a fullproxy rule that terminates TLS', () => {
		renderForm(args({security: 1, mtls_frontend: {client_cert_mode: 'optional'}}), true);
		expect(caPath().disabled).toBe(false);
	});

	it('is locked on a fullproxy rule that does not', () => {
		renderForm(args({security: 0}), true);
		expect(caPath().disabled).toBe(true);
		cleanup();
		renderForm(args(), true);
		expect(caPath().disabled).toBe(true);
	});

	it('is locked on a rule that is not fullproxy, whatever its security', () => {
		renderForm(args({mode: 0, security: 1}), true);
		expect(caPath().disabled).toBe(true);
	});
});

describe('backend TLS on an existing rule', () => {
	it('is open on a fullproxy rule that re-encrypts', () => {
		renderForm(args({security: 2}), true);
		expect(backendCa().disabled).toBe(false);
	});

	it('is locked on a rule that only terminates TLS, and on one without a security', () => {
		renderForm(args({security: 1}), true);
		expect(backendCa().disabled).toBe(true);
		cleanup();
		renderForm(args(), true);
		expect(backendCa().disabled).toBe(true);
	});
});

describe('the security of a rule', () => {
	it('can be chosen while a fullproxy rule is being created', () => {
		renderForm(args({security: 1}), false);
		expect(securityLocked()).toBe(false);
	});

	it('cannot be changed on an existing rule', () => {
		renderForm(args({security: 1}), true);
		expect(securityLocked()).toBe(true);
	});
});
