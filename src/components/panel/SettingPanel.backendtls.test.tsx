//---------------------------------------------------------
// Installed backend TLS on the rule detail.
//
// A rule ASKS for a backend TLS policy; the listener INSTALLS one, and the two
// can differ — a certificate replaced under the same ID that would not load, a
// restored rule that disagrees with its listener, a build that cannot verify
// at all. The gateway reports the installed policy beside the request, and the
// detail must keep them apart: a requested CA is not an installed one, and
// only `applied` says they agree. `pending` and `unsupported` carry filler
// members that describe no policy, and a gateway that reports nothing has
// reported nothing — none of those may read as "not verified".
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {IServiceArguments} from 'types/load_balancer';
import SettingsPanel, {backendTlsInstalledState} from './SettingPanel';

type Effective = NonNullable<IServiceArguments['backend_tls_effective']>;

function args(over: Partial<IServiceArguments> = {}): IServiceArguments {
	return {name: 'r', externalIP: '192.0.2.10', inactiveTimeOut: 0, port: 8443, protocol: 'tcp', mode: 4, security: 2, ...over};
}

const REQUEST: Partial<IServiceArguments> = {
	mtls_backend: {verify_server_cert: true},
	backend_ca_cert_id: 'ca-new',
	backend_client_cert_id: 'client-new',
	backend_tls_server_name: 'new.internal',
};

// SingleTextBox is a caption over a value, not a labelled control.
const valueOf = (label: string) => screen.queryByText(label)?.closest('.MuiStack-root')?.querySelector('.MuiTypography-body2')?.textContent;
const status = () => screen.getByRole('alert').textContent ?? '';

const INSTALLED_LABELS = ['Installed Verification', 'Installed CA Bundle', 'Installed Client Certificate', 'Installed Client Cert ID', 'Installed Server Name', 'Policy Generation'];

afterEach(cleanup);

describe('installed backend TLS state', () => {
	it('says a policy is described only where a listener runs one', () => {
		expect(backendTlsInstalledState({status: 'applied'})).toMatchObject({severity: 'success', hasPolicy: true});
		expect(backendTlsInstalledState({status: 'failed'})).toMatchObject({severity: 'error', hasPolicy: true});
		expect(backendTlsInstalledState({status: 'pending'})).toMatchObject({severity: 'warning', hasPolicy: false});
		expect(backendTlsInstalledState({status: 'unsupported'})).toMatchObject({severity: 'warning', hasPolicy: false});
		expect(backendTlsInstalledState(undefined)).toMatchObject({severity: 'info', hasPolicy: false});
	});

	it('does not claim a verified connection for an applied policy', () => {
		expect(backendTlsInstalledState({status: 'applied'}).message).toContain('does not say that any connection was verified');
	});

	it('passes through a status it does not know instead of guessing', () => {
		const state = backendTlsInstalledState({status: 'draining' as Effective['status']});
		expect(state).toMatchObject({severity: 'warning', hasPolicy: true});
		expect(state.message).toContain('draining');
		expect(backendTlsInstalledState({}).message).toContain('without a status');
	});
});

describe('installed backend TLS on the rule detail', () => {
	it('keeps a failed listener\'s installed policy apart from what the rule asks for', () => {
		render(
			<SettingsPanel
				serviceArguments={args({
					...REQUEST,
					backend_tls_effective: {status: 'failed', verify: true, ca: 'ca-old', client_cert: true, client_cert_id: 'client-old', server_name: 'old.internal', generation: 3},
				})}
			/>,
		);
		expect(valueOf('Requested Backend Verification')).toBe('Verify against ca-new');
		expect(valueOf('Requested Backend Client Cert ID')).toBe('client-new');
		expect(valueOf('Requested Backend TLS Server Name')).toBe('new.internal');

		expect(status()).toContain('Failed');
		expect(valueOf('Installed Verification')).toBe('Endpoint certificates are verified');
		expect(valueOf('Installed CA Bundle')).toBe('ca-old');
		expect(valueOf('Installed Client Certificate')).toBe('Presented');
		expect(valueOf('Installed Client Cert ID')).toBe('client-old');
		expect(valueOf('Installed Server Name')).toBe('old.internal');
		expect(valueOf('Policy Generation')).toBe('3');
	});

	it('shows false and zero as reported, not as missing', () => {
		render(<SettingsPanel serviceArguments={args({backend_tls_effective: {status: 'applied', verify: false, ca: 'none', client_cert: false, generation: 0}})} />);
		expect(status()).toContain('Applied');
		expect(valueOf('Installed Verification')).toBe('Not verified');
		expect(valueOf('Installed CA Bundle')).toBe('none');
		expect(valueOf('Installed Client Certificate')).toBe('Not presented');
		expect(screen.queryByText('Installed Client Cert ID')).toBeNull();
		expect(valueOf('Installed Server Name')).toBe('Endpoint address');
		expect(valueOf('Policy Generation')).toBe('0');
	});

	it.each(['pending', 'unsupported'] as const)('shows no installed policy for a %s rule, whatever filler it carries', state => {
		render(<SettingsPanel serviceArguments={args({...REQUEST, backend_tls_effective: {status: state, verify: false, ca: 'none', client_cert: false, generation: 0}})} />);
		expect(status().toLowerCase()).toContain(state);
		INSTALLED_LABELS.forEach(label => expect(screen.queryByText(label)).toBeNull());
		expect(screen.queryByText('Not verified')).toBeNull();
	});

	it('says nothing was reported when the gateway leaves the field out', () => {
		render(<SettingsPanel serviceArguments={args(REQUEST)} />);
		expect(status()).toContain('Not reported');
		INSTALLED_LABELS.forEach(label => expect(screen.queryByText(label)).toBeNull());
		expect(screen.queryByText('Not verified')).toBeNull();
		// The request is still shown, as a request.
		expect(valueOf('Requested Backend Verification')).toBe('Verify against ca-new');
	});

	it('names the listener the policy belongs to', () => {
		render(<SettingsPanel serviceArguments={args({backend_tls_effective: {status: 'applied', verify: true, ca: 'ca-1', client_cert: false, generation: 1}})} />);
		expect(valueOf('Listener')).toBe('192.0.2.10:8443/tcp');
	});

	it('has no section off the re-encrypting leg', () => {
		render(<SettingsPanel serviceArguments={args({security: 1})} />);
		expect(screen.queryByText('Installed Backend TLS')).toBeNull();
		cleanup();
		render(<SettingsPanel serviceArguments={args({mode: 0})} />);
		expect(screen.queryByText('Installed Backend TLS')).toBeNull();
	});
});
