//---------------------------------------------------------
// Certificate lookup panel.
//
// A CA bundle or a client certificate has no row in the SNI hostname table,
// so this is the only place one can be seen. What these pin: the three
// outcomes stay apart (stored, not stored, not known), and a result never
// stays on screen beside an ID it was not read for.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import type {CertLookup} from 'connector/instance/cert';
import type {IInstance} from 'types/oam';
import CertLookupPanel, {certUsageName} from './CertLookupPanel';

const state = vi.hoisted(() => ({lookup: vi.fn()}));
vi.mock('connector/instance/cert', async importOriginal => ({
	...(await importOriginal<typeof import('connector/instance/cert')>()),
	lookup_cert: state.lookup,
}));

const INST = {id: 1, name: 'gw'} as IInstance;
const OTHER_INST = {id: 2, name: 'gw-2'} as IInstance;
const CA: CertLookup = {kind: 'found', cert: {certId: 'backend-ca', usage: 'ca', hostnames: [], certificates: 2, chainCertificates: 0}};
const LISTENER: CertLookup = {kind: 'found', cert: {certId: 'web', usage: 'server', hostnames: ['a.example', 'b.example'], certificates: 1, chainCertificates: 1}};

const input = () => screen.getByLabelText('Cert ID');
const lookUp = () => screen.getByRole('button', {name: 'Look Up'});
const panel = () => screen.getByTestId('cert-lookup').textContent ?? '';
const valueOf = (label: string) => screen.queryByText(label)?.closest('.MuiStack-root')?.querySelector('.MuiTypography-body2')?.textContent;
const type = (value: string) => fireEvent.change(input(), {target: {value}});

afterEach(() => {
	cleanup();
	state.lookup.mockReset();
});

describe('certUsageName', () => {
	it('names the usages as the upload form does, and passes an unknown one through', () => {
		expect(certUsageName('ca')).toBe('Backend CA bundle');
		expect(certUsageName('client')).toBe('Backend client certificate');
		expect(certUsageName('server')).toBe('Listener certificate (SNI)');
		expect(certUsageName('ocsp')).toBe('ocsp');
		expect(certUsageName('toString')).toBe('toString');
	});
});

describe('CertLookupPanel', () => {
	it('shows a CA bundle that has no hostname row', async () => {
		state.lookup.mockResolvedValue(CA);
		render(<CertLookupPanel instance={INST} />);
		type('  backend-ca ');
		fireEvent.click(lookUp());
		await waitFor(() => expect(valueOf('Certificate Usage')).toBe('Backend CA bundle'));
		expect(state.lookup).toHaveBeenCalledWith(INST, 'backend-ca');
		expect(valueOf('Certificates')).toBe('2');
		expect(valueOf('Chain Certificates')).toBe('0');
		expect(valueOf('SNI Hostnames')).toBe('None registered');
	});

	it('shows the hostnames of a listener certificate', async () => {
		state.lookup.mockResolvedValue(LISTENER);
		render(<CertLookupPanel instance={INST} />);
		type('web');
		fireEvent.click(lookUp());
		await waitFor(() => expect(valueOf('SNI Hostnames')).toBe('a.example, b.example'));
	});

	it('says an ID is not stored only when the gateway said so', async () => {
		state.lookup.mockResolvedValue({kind: 'absent'});
		render(<CertLookupPanel instance={INST} />);
		type('nope');
		fireEvent.click(lookUp());
		await waitFor(() => expect(panel()).toContain('No certificate is stored under the ID "nope".'));
	});

	it.each([
		['denied', 'You do not have permission'],
		['unavailable', 'unavailable'],
	])('does not call a %s lookup missing', async status => {
		state.lookup.mockResolvedValue({kind: 'error', result: {status, code: `cert.lookup.${status}`, localeKey: 'The service is temporarily unavailable.', retryable: false}});
		render(<CertLookupPanel instance={INST} />);
		type('x');
		fireEvent.click(lookUp());
		await waitFor(() => expect(panel()).toContain('whether it exists is not known'));
		expect(panel()).not.toContain('No certificate is stored');
	});

	it('asks nothing for an ID the gateway could not hold', () => {
		render(<CertLookupPanel instance={INST} />);
		expect(lookUp()).toHaveProperty('disabled', true);
		type('a/b');
		expect(lookUp()).toHaveProperty('disabled', true);
		expect(panel()).toContain('Not a certificate ID');
		fireEvent.keyDown(input(), {key: 'Enter'});
		expect(state.lookup).not.toHaveBeenCalled();
	});

	it('clears the result as soon as the ID is edited', async () => {
		state.lookup.mockResolvedValue(CA);
		render(<CertLookupPanel instance={INST} />);
		type('backend-ca');
		fireEvent.click(lookUp());
		await waitFor(() => expect(valueOf('Certificate Usage')).toBe('Backend CA bundle'));
		type('backend-c');
		expect(screen.queryByText('Certificate Usage')).toBeNull();
	});

	it('ignores a slow answer for an ID that has since been edited', async () => {
		let release: (value: CertLookup) => void = () => undefined;
		state.lookup.mockReturnValue(new Promise<CertLookup>(resolve => (release = resolve)));
		render(<CertLookupPanel instance={INST} />);
		type('backend-ca');
		fireEvent.click(lookUp());
		type('other');
		release(CA);
		await new Promise(r => setTimeout(r, 20));
		expect(screen.queryByText('Certificate Usage')).toBeNull();
		expect(lookUp()).toHaveProperty('disabled', false);
	});

	it('clears the result when the instance changes', async () => {
		state.lookup.mockResolvedValue(CA);
		const view = render(<CertLookupPanel instance={INST} />);
		type('backend-ca');
		fireEvent.click(lookUp());
		await waitFor(() => expect(valueOf('Certificate Usage')).toBe('Backend CA bundle'));
		view.rerender(<CertLookupPanel instance={OTHER_INST} />);
		expect(screen.queryByText('Certificate Usage')).toBeNull();
	});
});
