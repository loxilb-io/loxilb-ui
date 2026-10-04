//---------------------------------------------------------
// JWT profile form ↔ entry mapping (J1)
//---------------------------------------------------------
// The form holds numerics as RAW TEXT and defaults as BLANKS. Both choices
// exist to keep "the operator did not choose" distinguishable from "the
// operator chose zero", which on this entry are opposite instructions: absent
// selects the documented default, and there is no field where zero is a
// meaningful non-default configuration.

import {describe, expect, it} from 'vitest';
import {
	INITIAL_JWT_FORM,
	isJWTProfileFormValid,
	jwtProfileFormToEntry,
	jwtProfileToForm,
} from './JWTAuthProfileInputForm';

const filled = {...INITIAL_JWT_FORM, name: 'realm-a', issuer: 'https://idp.example.com'};

describe('jwtProfileFormToEntry', () => {
	it('omits every untouched optional, so a create pins nothing by accident', () => {
		const entry = jwtProfileFormToEntry(filled);
		for (const f of ['jwks_url', 'audiences', 'algs', 'leeway_sec', 'refresh_sec', 'tenant_claim', 'user_claim', 'models_claim', 'roles_claim', 'model_role_prefix', 'username_claim', 'default_tenant']) {
			expect(entry, `${f} must be absent on an untouched form`).not.toHaveProperty(f);
		}
		expect(entry.name).toBe('realm-a');
		expect(entry.issuer).toBe('https://idp.example.com');
	});

	// A blank numeric is "default", not 0 — and 0 would mean the same thing
	// upstream, so sending it is merely noise; what matters is that a typo can
	// never become one.
	it('sends a blank or zero duration as absent', () => {
		expect(jwtProfileFormToEntry({...filled, leeway_sec: '', refresh_sec: ''})).not.toHaveProperty('leeway_sec');
		expect(jwtProfileFormToEntry({...filled, leeway_sec: '0', refresh_sec: '0'})).not.toHaveProperty('leeway_sec');
		expect(jwtProfileFormToEntry({...filled, leeway_sec: '45'}).leeway_sec).toBe(45);
	});

	// A half-typed numeric must block submit rather than silently resolving to
	// a number — evaluateNumericField answers invalid, isJWTProfileFormValid
	// refuses, and the popup's confirm stays disabled.
	it('refuses a non-numeric duration instead of coercing it', () => {
		expect(isJWTProfileFormValid({...filled, leeway_sec: '3o'})).toBe(false);
		expect(isJWTProfileFormValid({...filled, refresh_sec: '-1'})).toBe(false);
		expect(isJWTProfileFormValid({...filled, leeway_sec: '30'})).toBe(true);
	});

	it('splits a comma-separated audience list and drops blanks', () => {
		const entry = jwtProfileFormToEntry({...filled, audiences: ' api://gw , , account '});
		expect(entry.audiences).toEqual(['api://gw', 'account']);
	});

	it('requires name and issuer before the form can be submitted', () => {
		expect(isJWTProfileFormValid(INITIAL_JWT_FORM)).toBe(false);
		expect(isJWTProfileFormValid({...INITIAL_JWT_FORM, name: 'realm-a'})).toBe(false);
		expect(isJWTProfileFormValid(filled)).toBe(true);
	});

	it('rejects an issuer that is not an http(s) URL', () => {
		expect(isJWTProfileFormValid({...filled, issuer: 'idp.example.com'})).toBe(false);
	});
});

describe('jwtProfileToForm — the edit round-trip', () => {
	// POST is create-or-replace with no PATCH, so an edit sends the WHOLE
	// entry. Anything this loader drops is silently reverted on save.
	it('round-trips a fully specified entry without losing a field', () => {
		const entry = {
			name: 'realm-a', issuer: 'https://idp.example.com', jwks_url: 'https://idp.example.com/jwks',
			audiences: ['api://gw'], algs: ['RS512'], leeway_sec: 45, refresh_sec: 900,
			tenant_claim: 'tid', user_claim: 'uid', models_claim: 'models', roles_claim: 'roles',
			model_role_prefix: 'm:', username_claim: 'uname',
			model_authz: 'allow-all' as const, default_tenant: 'acme',
			forward_identity: true, authorization_passthrough: true,
		};
		expect(jwtProfileFormToEntry(jwtProfileToForm(entry))).toEqual(entry);
	});

	// ⚠️ A stored default must not come back as a literal. If the loader wrote
	// `leeway_sec: 30` into the text field, the next save would PIN 30 — a
	// value the operator never chose, which then stops tracking the gateway's
	// default if upstream ever changes it.
	it('loads an unset duration as blank, so an untouched field stays unset', () => {
		const form = jwtProfileToForm({name: 'realm-a', issuer: 'https://idp.example.com'});
		expect(form.leeway_sec).toBe('');
		expect(form.refresh_sec).toBe('');
		expect(jwtProfileFormToEntry(form)).not.toHaveProperty('leeway_sec');
	});

	// Empty audiences is a real setting — it skips the audience check — but it
	// is expressed by the field being absent, which upstream reads the same
	// way. What must NOT happen is it round-tripping into something else.
	it('round-trips an explicitly empty audience list as still-no-accept-list', () => {
		const form = jwtProfileToForm({name: 'realm-a', issuer: 'https://idp.example.com', audiences: []});
		expect(form.audiences).toBe('');
		expect(jwtProfileFormToEntry(form)).not.toHaveProperty('audiences');
	});

	it('keeps model_authz, which defaults to deny rather than to permissive', () => {
		expect(jwtProfileToForm({name: 'a', issuer: 'https://i.example'}).model_authz).toBe('claims-required');
		expect(jwtProfileFormToEntry(filled).model_authz).toBe('claims-required');
	});
});
