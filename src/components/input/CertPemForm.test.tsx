//---------------------------------------------------------
// Certificate usage on the inline-PEM upload/rotate form.
//
// A gateway stores three kinds of entry under /config/cert: a listener
// certificate, a CA bundle a rule verifies its backends against, and a client
// certificate a rule presents to them. Pins: what the form lets through
// matches what the gateway accepts for each kind, the request for a listener
// certificate is unchanged from before the field existed, and the choice is
// offered only where the gateway declares it.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {ICert} from 'types/security';
import CertPemForm, {certFormToRequest, isCertFormValid} from './CertPemForm';

const CERT = '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----';
// Armor only: the form checks the armor line, the gateway parses the rest.
const KEY = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ') + '\nAAAA';

const entry = (over: Partial<ICert> = {}): ICert => ({usage: 'server', certId: '', certPem: CERT, keyPem: KEY, chainPem: '', ...over});

afterEach(cleanup);

describe('isCertFormValid', () => {
	it('lets a listener certificate through without an ID, and needs certificate and key', () => {
		expect(isCertFormValid('upload', entry())).toBe(true);
		expect(isCertFormValid('upload', entry({keyPem: ''}))).toBe(false);
		expect(isCertFormValid('upload', entry({certPem: 'not pem'}))).toBe(false);
	});

	it('needs the ID on every rotation', () => {
		expect(isCertFormValid('rotate', entry())).toBe(false);
		expect(isCertFormValid('rotate', entry({certId: 'edge'}))).toBe(true);
	});

	it('takes a CA bundle with no key, and refuses one that carries a key', () => {
		expect(isCertFormValid('upload', entry({usage: 'ca', certId: 'backend-ca', keyPem: ''}))).toBe(true);
		expect(isCertFormValid('upload', entry({usage: 'ca', certId: 'backend-ca'}))).toBe(false);
	});

	it('needs a key for a client certificate', () => {
		expect(isCertFormValid('upload', entry({usage: 'client', certId: 'backend-client'}))).toBe(true);
		expect(isCertFormValid('upload', entry({usage: 'client', certId: 'backend-client', keyPem: ''}))).toBe(false);
	});

	// A CA or client entry is listed nowhere: an ID the gateway minted could not be referred to.
	it('needs an ID the operator chose for a CA bundle and for a client certificate', () => {
		expect(isCertFormValid('upload', entry({usage: 'ca', keyPem: ''}))).toBe(false);
		expect(isCertFormValid('upload', entry({usage: 'client', certId: '  '}))).toBe(false);
	});
});

describe('certFormToRequest', () => {
	it('sends a listener certificate exactly as before the usage field existed', () => {
		expect(certFormToRequest(entry())).toEqual({certPem: CERT, keyPem: KEY, chainPem: ''});
		expect(certFormToRequest(entry({certId: 'edge'}))).toEqual({certId: 'edge', certPem: CERT, keyPem: KEY, chainPem: ''});
		expect(certFormToRequest({certPem: CERT, keyPem: KEY})).not.toHaveProperty('usage');
	});

	it('names the usage of a CA bundle and sends its key as the empty string, present', () => {
		const body = certFormToRequest(entry({usage: 'ca', certId: 'backend-ca', keyPem: KEY}));
		expect(body).toEqual({usage: 'ca', certId: 'backend-ca', certPem: CERT, keyPem: '', chainPem: ''});
		expect(Object.keys(body)).toContain('keyPem');
	});

	it('names the usage of a client certificate and keeps its key', () => {
		expect(certFormToRequest(entry({usage: 'client', certId: 'backend-client'}))).toEqual({usage: 'client', certId: 'backend-client', certPem: CERT, keyPem: KEY, chainPem: ''});
	});
});

describe('CertPemForm', () => {
	// A label is matched by its start: a required one is followed by " *".
	const type = (label: string, value: string) =>
		fireEvent.change(screen.getByLabelText((text: string) => text.startsWith(label)), {target: {value}});
	const last = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.calls.at(-1)?.[0];

	async function choose(usage: string) {
		fireEvent.mouseDown(screen.getByRole('combobox', {name: /^Certificate Usage/}));
		fireEvent.click(within(await screen.findByRole('listbox')).getByText(usage));
	}

	it('does not offer the choice on a gateway that does not declare usage', () => {
		const onChange = vi.fn();
		render(<CertPemForm mode="upload" onChange={onChange} />);
		expect(screen.queryByRole('combobox', {name: /^Certificate Usage/})).toBeNull();

		type('Certificate (PEM)', CERT);
		type('Private Key (PEM)', KEY);
		expect(last(onChange)).toEqual({certPem: CERT, keyPem: KEY, chainPem: '', isValid: true});
	});

	it('drops the key field for a CA bundle and reports the request the gateway accepts', async () => {
		const onChange = vi.fn();
		render(<CertPemForm mode="upload" usageDeclared onChange={onChange} />);
		type('Private Key (PEM)', KEY);
		await choose('Backend CA bundle');

		expect(screen.queryByLabelText(/^Private Key \(PEM\)/)).toBeNull();
		// The key typed before the choice must not travel with the bundle.
		expect(last(onChange)).toMatchObject({usage: 'ca', keyPem: '', isValid: false});

		type('Cert ID', 'backend-ca');
		type('CA Certificate(s) (PEM)', CERT);
		expect(last(onChange)).toEqual({usage: 'ca', certId: 'backend-ca', certPem: CERT, keyPem: '', chainPem: '', isValid: true});
	});

	it('keeps the key field for a client certificate and asks for an ID', async () => {
		const onChange = vi.fn();
		render(<CertPemForm mode="upload" usageDeclared onChange={onChange} />);
		await choose('Backend client certificate');
		type('Certificate (PEM)', CERT);
		type('Private Key (PEM)', KEY);
		expect(last(onChange)).toMatchObject({usage: 'client', isValid: false});

		type('Cert ID', 'backend-client');
		expect(last(onChange)).toEqual({usage: 'client', certId: 'backend-client', certPem: CERT, keyPem: KEY, chainPem: '', isValid: true});
	});
});
