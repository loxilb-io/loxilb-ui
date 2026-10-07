//---------------------------------------------------------
// Certificate lookup by ID.
//
// What these pin:
//   - what leaves the connector is a summary: no PEM and no key member can
//     reach component state, the cache or a screenshot through it;
//   - only the gateway's own 404 means "nothing is stored under this ID". A
//     read that fails any other way — refused, unavailable, unreachable, or a
//     404 from the management backend about the instance — has not said so;
//   - a rotation is confirmed by the stored certificate BEING the submitted
//     one, not by the entry merely existing.
//---------------------------------------------------------
import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import {IInstance} from 'types/oam';
import {confirm_cert_material, lookup_cert, summarizeCert} from './cert';

const INST = {id: 1, name: 'gw-1'} as IInstance;

const pem = (body: string) => `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----`;
const LEAF = pem('TUlJQ2xlYWY=');
const OTHER = pem('TUlJQ290aGVy');
const CA_1 = pem('TUlJQ2NhMQ==');
const CA_2 = pem('TUlJQ2NhMg==');
// Assembled at run time so no key-shaped literal sits in the source.
const KEY_MARK = ['PRIVATE', 'KEY'].join(' ');

function mockFetch(body: unknown, status = 200, origin: string | null = 'gateway') {
	const headers: Record<string, string> = {'Content-Type': 'application/json'};
	if (origin) headers['X-Loxi-Error-Origin'] = origin;
	(global.fetch as Mock).mockResolvedValue(new Response(body === null ? null : JSON.stringify(body), {status, statusText: 'x', headers}));
}
const requested = () => String((global.fetch as Mock).mock.calls[0][0]);

beforeEach(() => {
	vi.stubGlobal('fetch', vi.fn());
	localStorage.clear();
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe('lookup_cert', () => {
	it('returns a summary of a client certificate, and none of its material', async () => {
		mockFetch({certId: 'backend-client', usage: 'client', certPem: LEAF, chainPem: `${CA_1}\n${CA_2}`, keyPem: `-----BEGIN ${KEY_MARK}-----\nc2VjcmV0\n-----END ${KEY_MARK}-----`, hostnames: []});
		const result = await lookup_cert(INST, 'backend-client');
		expect(result).toEqual({kind: 'found', cert: {certId: 'backend-client', usage: 'client', hostnames: [], certificates: 1, chainCertificates: 2}});
		const text = JSON.stringify(result);
		expect(text).not.toContain('BEGIN');
		expect(text).not.toContain('TUlJQ2xlYWY');
		expect(text).not.toContain('c2VjcmV0');
		expect(text).not.toContain('Pem');
	});

	it('counts the certificates of a CA bundle and reports its usage', async () => {
		mockFetch({certId: 'backend-ca', usage: 'ca', certPem: `${CA_1}\n${CA_2}`});
		expect(await lookup_cert(INST, 'backend-ca')).toEqual({kind: 'found', cert: {certId: 'backend-ca', usage: 'ca', hostnames: [], certificates: 2, chainCertificates: 0}});
	});

	it('reads an entry from before usages existed as a listener certificate', () => {
		expect(summarizeCert('old', {certPem: LEAF, hostnames: ['a.example']})).toMatchObject({certId: 'old', usage: 'server', hostnames: ['a.example']});
	});

	it('encodes the ID into the path', async () => {
		mockFetch({certId: 'a b', usage: 'ca', certPem: CA_1});
		await lookup_cert(INST, 'a b');
		expect(requested()).toMatch(/\/config\/cert\/a%20b$/);
	});

	it("reads the gateway's 404 as absent", async () => {
		mockFetch(null, 404);
		expect(await lookup_cert(INST, 'gone')).toEqual({kind: 'absent'});
	});

	it('reads an unmarked 404 as absent, as an older management backend relays it', async () => {
		mockFetch(null, 404, null);
		expect(await lookup_cert(INST, 'gone')).toEqual({kind: 'absent'});
	});

	it("does not read the management backend's own 404 as absent", async () => {
		mockFetch({error: 'instance not found'}, 404, 'oam');
		expect((await lookup_cert(INST, 'x')).kind).toBe('error');
	});

	it.each([401, 403, 500, 502, 503])('does not read a %i as absent', async status => {
		mockFetch({code: status, message: 'x'}, status);
		expect((await lookup_cert(INST, 'x')).kind).toBe('error');
	});

	it('does not read an unreachable gateway as absent, and does not throw', async () => {
		(global.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
		const result = await lookup_cert(INST, 'x');
		expect(result.kind).toBe('error');
		expect(result.kind === 'error' && result.result.status).toBe('unavailable');
	});
});

describe('confirm_cert_material', () => {
	it('matches the stored certificate whatever the line breaks', async () => {
		mockFetch({certId: 'c', usage: 'client', certPem: LEAF.replace(/\n/g, '\r\n') + '\n'});
		expect(await confirm_cert_material(INST, 'c', LEAF)).toMatchObject({kind: 'found', material: 'match'});
	});

	it('says so when the entry still holds another certificate', async () => {
		mockFetch({certId: 'c', usage: 'client', certPem: OTHER});
		expect(await confirm_cert_material(INST, 'c', LEAF)).toMatchObject({kind: 'found', material: 'differs'});
	});

	it('compares every certificate of a bundle, in order', async () => {
		mockFetch({certId: 'ca', usage: 'ca', certPem: `${CA_1}\n${CA_2}`});
		expect(await confirm_cert_material(INST, 'ca', `${CA_1}\n${CA_2}`)).toMatchObject({material: 'match'});
		mockFetch({certId: 'ca', usage: 'ca', certPem: CA_1});
		expect(await confirm_cert_material(INST, 'ca', `${CA_1}\n${CA_2}`)).toMatchObject({material: 'differs'});
	});

	it('does not match an entry that came back without a certificate', async () => {
		mockFetch({certId: 'c', usage: 'client'});
		expect(await confirm_cert_material(INST, 'c', 'not a certificate')).toMatchObject({kind: 'found', material: 'differs'});
	});

	it('keeps absent and failed apart, and returns no material for either', async () => {
		mockFetch(null, 404);
		expect(await confirm_cert_material(INST, 'c', LEAF)).toEqual({kind: 'absent'});
		mockFetch({code: 503}, 503);
		const failed = await confirm_cert_material(INST, 'c', LEAF);
		expect(failed.kind).toBe('error');
		expect(JSON.stringify(failed)).not.toContain('TUlJQ2xlYWY');
	});
});
