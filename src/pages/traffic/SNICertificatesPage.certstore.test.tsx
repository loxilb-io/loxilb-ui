//---------------------------------------------------------
// Certificate store operations on the SNI Certificates page.
//
// An accepted request is not a stored certificate, and an accepted delete is
// not an absent one. Each operation is followed by a read of the entry, and
// what the page says comes from that read:
//   - an upload or a rotation is a success only when the stored certificate
//     is the one submitted;
//   - a delete is a success only when the gateway answers that nothing is
//     stored; a read that failed has not said so;
//   - the gateway's refusal to delete a certificate a rule uses is shown with
//     its own sentence, which is the only thing that names the rule.
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import type {IServiceConfiguration} from 'types/load_balancer';
import SNICertificatesPage, {rulesUsingCert} from './SNICertificatesPage';

type Popup = {title: string; contents: unknown; onYes?: () => void | Promise<void>};

const state = vi.hoisted(() => ({
	popups: [] as Popup[],
	canWrite: true,
	lb: {data: [] as unknown[] | undefined, isError: false},
	upload: vi.fn(),
	rotate: vi.fn(),
	remove: vi.fn(),
	lookup: vi.fn(),
	confirm: vi.fn(),
	invalidated: 0,
	pemForm: null as null | ((data: Record<string, unknown>) => void),
}));

vi.mock('hooks/instanceHook', () => ({useInstanceFromURL: () => ({id: 5, name: 'gw'})}));
vi.mock('hooks/query/oamHooks', () => ({useRole: () => ({can_write_gateway: state.canWrite})}));
vi.mock('hooks/popupHook', () => ({
	usePopUp: () => ({
		enableYes: () => undefined,
		openPopUp: (title: string, contents: unknown, _yes?: string, _no?: string, onYes?: () => void | Promise<void>) => {
			state.popups.push({title, contents, onYes});
		},
	}),
}));
vi.mock('hooks/query/queryHooks', () => ({
	useSNICertificates: () => ({data: {certificates: []}, error: null, dataUpdatedAt: 1, refetch: () => undefined}),
	useMetadata: () => ({get_param: () => ({})}),
	useLoadBalancerConfig: () => state.lb,
}));
vi.mock('@tanstack/react-query', async importOriginal => ({
	...(await importOriginal<typeof import('@tanstack/react-query')>()),
	useQueryClient: () => ({invalidateQueries: () => (state.invalidated += 1)}),
}));
vi.mock('components/table/traffic/SNICertificatesTable', () => ({default: () => null}));
vi.mock('components/input/CertPemForm', () => ({
	default: (props: {onChange: (data: Record<string, unknown>) => void}) => {
		state.pemForm = props.onChange;
		return null;
	},
}));
vi.mock('connector/instance/cert', async importOriginal => ({
	...(await importOriginal<typeof import('connector/instance/cert')>()),
	request_upload_cert_pem: state.upload,
	request_rotate_cert_pem: state.rotate,
	request_delete_cert_pem: state.remove,
	lookup_cert: state.lookup,
	confirm_cert_material: state.confirm,
}));

const OK = {status: 'confirmed', code: 'x', localeKey: 'x', retryable: false};
const CERT_PEM = '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----';
const SUMMARY = {certId: 'backend-ca', usage: 'ca', hostnames: [], certificates: 1, chainCertificates: 0};
const UNAVAILABLE = {kind: 'error', result: {status: 'unavailable', code: 'cert.confirm.unavailable', localeKey: 'The service is temporarily unavailable.', retryable: true}};

const last = () => state.popups[state.popups.length - 1];
const text = (popup: Popup) => String(popup.contents);

/** Open a PEM dialog, hand it the form's state, and confirm. */
async function submitPem(button: 'Upload PEM' | 'Rotate (certId)', data: Record<string, unknown>) {
	fireEvent.click(screen.getByRole('button', {name: button}));
	const dialog = last();
	render(<>{dialog.contents as never}</>);
	state.pemForm!({isValid: true, certPem: CERT_PEM, keyPem: '', ...data});
	await dialog.onYes!();
}

/** Open the delete dialog, type the ID, and confirm. */
async function submitDelete(certId: string) {
	fireEvent.click(screen.getByRole('button', {name: 'Delete (certId)'}));
	const dialog = last();
	const form = render(<>{dialog.contents as never}</>);
	fireEvent.change(within(form.container).getByRole('textbox'), {target: {value: certId}});
	await dialog.onYes!();
	return form;
}

afterEach(() => {
	cleanup();
	state.popups = [];
	state.canWrite = true;
	state.lb = {data: [], isError: false};
	state.invalidated = 0;
	state.pemForm = null;
	for (const fn of [state.upload, state.rotate, state.remove, state.lookup, state.confirm]) fn.mockReset();
});

describe('rulesUsingCert', () => {
	const rule = (args: Record<string, unknown>) => ({serviceArguments: {externalIP: '192.0.2.1', port: 443, protocol: 'tcp', ...args}}) as unknown as IServiceConfiguration;

	it('names the rules that use an ID for either backend role', () => {
		const rules = [rule({name: 'a', backend_ca_cert_id: 'ca-1'}), rule({backend_client_cert_id: 'ca-1'}), rule({name: 'c', backend_ca_cert_id: 'ca-2'})];
		expect(rulesUsingCert(rules, 'ca-1')).toEqual(['a', '192.0.2.1:443/tcp']);
	});

	it('names none for an empty ID, even beside rules that set no ID', () => {
		expect(rulesUsingCert([rule({name: 'a'}), rule({name: 'b', backend_ca_cert_id: ''})], '')).toEqual([]);
	});
});

describe('upload and rotation', () => {
	it('calls an upload a success when the stored certificate is the one submitted', async () => {
		state.upload.mockResolvedValue(OK);
		state.confirm.mockResolvedValue({kind: 'found', cert: SUMMARY, material: 'match'});
		render(<SNICertificatesPage />);
		await submitPem('Upload PEM', {usage: 'ca', certId: ' backend-ca '});
		expect(state.confirm).toHaveBeenCalledWith({id: 5, name: 'gw'}, 'backend-ca', CERT_PEM);
		expect(last().title).toBe('Success');
		expect(text(last())).toContain('"backend-ca" was uploaded');
		expect(state.invalidated).toBe(0);
	});

	it('does not call a rotation a success when the entry still holds another certificate', async () => {
		state.rotate.mockResolvedValue(OK);
		state.confirm.mockResolvedValue({kind: 'found', cert: SUMMARY, material: 'differs'});
		render(<SNICertificatesPage />);
		await submitPem('Rotate (certId)', {usage: 'ca', certId: 'backend-ca'});
		expect(last().title).toBe('Warning');
		expect(text(last())).toContain('is not the one submitted');
	});

	it('confirms a rotation from the read-back, claims nothing about traffic, and refreshes the rules', async () => {
		state.rotate.mockResolvedValue(OK);
		state.confirm.mockResolvedValue({kind: 'found', cert: SUMMARY, material: 'match'});
		render(<SNICertificatesPage />);
		await submitPem('Rotate (certId)', {usage: 'ca', certId: 'backend-ca'});
		expect(last().title).toBe('Success');
		expect(text(last())).toContain('not that traffic is using it');
		expect(text(last()).toLowerCase()).not.toContain('zero');
		expect(state.invalidated).toBe(1);
	});

	it.each([
		['nothing is stored', {kind: 'absent'}, 'nothing is stored under "backend-ca"'],
		['the read-back fails', UNAVAILABLE, 'could not be read back'],
	])('does not call an accepted upload a success when %s', async (_name, stored, expected) => {
		state.upload.mockResolvedValue(OK);
		state.confirm.mockResolvedValue(stored);
		render(<SNICertificatesPage />);
		await submitPem('Upload PEM', {usage: 'ca', certId: 'backend-ca'});
		expect(last().title).toBe('Warning');
		expect(text(last())).toContain(expected);
	});

	it('says an upload without an ID cannot be looked up, and reads nothing', async () => {
		state.upload.mockResolvedValue(OK);
		render(<SNICertificatesPage />);
		await submitPem('Upload PEM', {});
		expect(state.confirm).not.toHaveBeenCalled();
		expect(last().title).toBe('Success');
		expect(text(last())).toContain('cannot be looked up from here');
	});

	it('reads nothing back after a refused upload, and keeps the certificate out of the message', async () => {
		state.upload.mockResolvedValue({status: 'invalid', code: 'cert.upload_cert_pem.invalid', localeKey: 'The request was rejected as invalid.', retryable: false, httpStatus: 400, rawDetail: `bad pem: ${CERT_PEM}`});
		render(<SNICertificatesPage />);
		await submitPem('Upload PEM', {usage: 'ca', certId: 'backend-ca'});
		expect(state.confirm).not.toHaveBeenCalled();
		expect(last().title).toBe('Error');
		expect(text(last())).not.toContain('BEGIN CERTIFICATE');
	});
});

describe('delete by ID', () => {
	it('calls a delete a success only when the gateway no longer stores the entry', async () => {
		state.remove.mockResolvedValue(OK);
		state.lookup.mockResolvedValue({kind: 'absent'});
		render(<SNICertificatesPage />);
		await submitDelete(' backend-ca ');
		expect(state.remove).toHaveBeenCalledWith({id: 5, name: 'gw'}, 'backend-ca');
		expect(state.lookup).toHaveBeenCalledWith({id: 5, name: 'gw'}, 'backend-ca');
		expect(last().title).toBe('Success');
	});

	it('does not call it gone when the entry is still stored', async () => {
		state.remove.mockResolvedValue(OK);
		state.lookup.mockResolvedValue({kind: 'found', cert: SUMMARY});
		render(<SNICertificatesPage />);
		await submitDelete('backend-ca');
		expect(last().title).toBe('Warning');
		expect(text(last())).toContain('is still stored');
	});

	it('does not call it gone when the read-back fails', async () => {
		state.remove.mockResolvedValue(OK);
		state.lookup.mockResolvedValue(UNAVAILABLE);
		render(<SNICertificatesPage />);
		await submitDelete('backend-ca');
		expect(last().title).toBe('Warning');
		expect(text(last())).toContain('could not be confirmed');
	});

	it("shows the gateway's refusal for a certificate a rule uses, and reads nothing back", async () => {
		const refusal = 'cert: certId "backend-ca" is used by load-balancer rule 192.0.2.1:443 for its backend leg; remove it from the rule first';
		state.remove.mockResolvedValue({status: 'invalid', code: 'cert.delete_cert_pem.invalid', localeKey: 'The request was rejected as invalid.', retryable: false, httpStatus: 400, rawDetail: refusal});
		render(<SNICertificatesPage />);
		await submitDelete('backend-ca');
		expect(last().title).toBe('Error');
		expect(text(last())).toContain(refusal);
		expect(state.lookup).not.toHaveBeenCalled();
	});

	it('names the rule that uses the ID before the delete is sent', () => {
		state.lb = {data: [{serviceArguments: {name: 'chat', externalIP: '192.0.2.1', port: 443, protocol: 'tcp', backend_ca_cert_id: 'backend-ca'}}], isError: false};
		render(<SNICertificatesPage />);
		fireEvent.click(screen.getByRole('button', {name: 'Delete (certId)'}));
		const form = render(<>{last().contents as never}</>);
		fireEvent.change(within(form.container).getByRole('textbox'), {target: {value: 'backend-ca'}});
		expect(form.container.textContent).toContain('Used for the backend leg of: chat.');
	});

	it.each([
		['failed', {data: undefined, isError: true}],
		['has not answered', {data: undefined, isError: false}],
	])('does not say an ID is unused when the rule list %s', (_name, lb) => {
		state.lb = lb;
		render(<SNICertificatesPage />);
		fireEvent.click(screen.getByRole('button', {name: 'Delete (certId)'}));
		const form = render(<>{last().contents as never}</>);
		fireEvent.change(within(form.container).getByRole('textbox'), {target: {value: 'backend-ca'}});
		expect(form.container.textContent).toContain('it is not known whether a rule uses this ID');
		expect(form.container.textContent).not.toContain('No loaded rule');
	});
});

describe('roles', () => {
	it('gives a viewer the lookup and none of the store operations', () => {
		state.canWrite = false;
		render(<SNICertificatesPage />);
		expect(screen.getByRole('button', {name: 'Look Up'})).not.toBeNull();
		expect(screen.queryByRole('button', {name: 'Upload PEM'})).toBeNull();
		expect(screen.queryByRole('button', {name: 'Delete (certId)'})).toBeNull();
	});
});
