//---------------------------------------------------------
// Checking a typed certificate ID against the usage a field needs.
//
// A rule names its backend CA bundle and client certificate by ID. What these
// pin: a stored ID of the wrong usage is not accepted as found; an ID that
// could not be looked up is not reported as missing; nothing is asked for an
// ID the gateway could not hold; and an answer does not outlive the ID it was
// read for.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import type {CertLookup} from 'connector/instance/cert';
import CertIdUsageCheck, {certIdVerdict} from './CertIdUsageCheck';

const state = vi.hoisted(() => ({lookup: vi.fn()}));

vi.mock('hooks/instanceHook', () => ({useInstanceFromURL: () => ({id: 1, name: 'gw'})}));
vi.mock('connector/instance/cert', async importOriginal => ({
	...(await importOriginal<typeof import('connector/instance/cert')>()),
	lookup_cert: state.lookup,
}));

const found = (usage: string): CertLookup => ({kind: 'found', cert: {certId: 'x', usage, hostnames: [], certificates: 1, chainCertificates: 0}});
const failed: CertLookup = {kind: 'error', result: {status: 'unavailable', code: 'cert.lookup.unavailable', localeKey: 'The service is temporarily unavailable.', retryable: true}};

const button = () => screen.getByRole('button', {name: 'Check Backend CA Cert ID'});
const answer = () => screen.queryByRole('alert')?.textContent ?? '';

afterEach(() => {
	cleanup();
	state.lookup.mockReset();
});

describe('certIdVerdict', () => {
	it('accepts only the usage the field needs', () => {
		expect(certIdVerdict(found('ca'), 'ca')).toBe('ok');
		expect(certIdVerdict(found('server'), 'ca')).toBe('wrong-usage');
		expect(certIdVerdict(found('client'), 'ca')).toBe('wrong-usage');
		expect(certIdVerdict(found('ca'), 'client')).toBe('wrong-usage');
	});

	it('keeps missing and unknown apart', () => {
		expect(certIdVerdict({kind: 'absent'}, 'ca')).toBe('absent');
		expect(certIdVerdict(failed, 'ca')).toBe('error');
	});
});

describe('CertIdUsageCheck', () => {
	it('asks nothing for an empty ID or one the gateway could not hold', () => {
		render(<CertIdUsageCheck label="Check Backend CA Cert ID" certId="" expected="ca" />);
		expect(button()).toHaveProperty('disabled', true);
		cleanup();
		render(<CertIdUsageCheck label="Check Backend CA Cert ID" certId="../etc" expected="ca" />);
		expect(button()).toHaveProperty('disabled', true);
		expect(state.lookup).not.toHaveBeenCalled();
	});

	it('confirms an ID stored with the needed usage', async () => {
		state.lookup.mockResolvedValue(found('ca'));
		render(<CertIdUsageCheck label="Check Backend CA Cert ID" certId=" backend-ca " expected="ca" />);
		fireEvent.click(button());
		await waitFor(() => expect(answer()).toContain('"backend-ca" is stored as: Backend CA bundle.'));
		expect(state.lookup).toHaveBeenCalledWith({id: 1, name: 'gw'}, 'backend-ca');
		expect(answer()).toContain('checks again when the rule is submitted');
	});

	it('names both usages when the ID is stored as something else', async () => {
		state.lookup.mockResolvedValue(found('server'));
		render(<CertIdUsageCheck label="Check Backend CA Cert ID" certId="web" expected="ca" />);
		fireEvent.click(button());
		await waitFor(() => expect(answer()).toContain('Listener certificate (SNI)'));
		expect(answer()).toContain('This field needs: Backend CA bundle.');
	});

	it('says an unknown ID is not stored', async () => {
		state.lookup.mockResolvedValue({kind: 'absent'});
		render(<CertIdUsageCheck label="Check Backend CA Cert ID" certId="nope" expected="ca" />);
		fireEvent.click(button());
		await waitFor(() => expect(answer()).toContain('No certificate is stored under the ID "nope"'));
	});

	it('does not call a failed lookup missing', async () => {
		state.lookup.mockResolvedValue(failed);
		render(<CertIdUsageCheck label="Check Backend CA Cert ID" certId="x" expected="ca" />);
		fireEvent.click(button());
		await waitFor(() => expect(answer()).toContain('whether it exists is not known'));
		expect(answer()).not.toContain('No certificate is stored');
	});

	it('drops the answer when the ID changes, and ignores a read still in flight for the old one', async () => {
		let release: (value: CertLookup) => void = () => undefined;
		state.lookup.mockResolvedValueOnce(found('ca'));
		const view = render(<CertIdUsageCheck label="Check Backend CA Cert ID" certId="one" expected="ca" />);
		fireEvent.click(button());
		await waitFor(() => expect(answer()).toContain('"one"'));

		state.lookup.mockReturnValueOnce(new Promise<CertLookup>(resolve => (release = resolve)));
		fireEvent.click(button());
		view.rerender(<CertIdUsageCheck label="Check Backend CA Cert ID" certId="two" expected="ca" />);
		expect(answer()).toBe('');
		release(found('ca'));
		await new Promise(r => setTimeout(r, 20));
		expect(answer()).toBe('');
		expect(button()).toHaveProperty('disabled', false);
	});
});
