import {describe, expect, it} from 'vitest';
import {validate_email, validate_password, validate_username} from './user';

describe('validate_password', () => {
	it('accepts a compliant password', () => {
		expect(validate_password('Str0ng!pass').isValid).toBe(true);
	});

	it.each([
		['short', 'Ab1!x', 'at least 9 characters'],
		['no lowercase', 'ABCDEF1!X', 'lowercase'],
		['no uppercase', 'abcdef1!x', 'uppercase'],
		['no digit', 'Abcdefg!x', 'number'],
		['no special', 'Abcdefg1x', 'special character'],
	])('rejects %s', (_name, pw, fragment) => {
		const res = validate_password(pw);
		expect(res.isValid).toBe(false);
		expect(res.message).toContain(fragment);
	});
});

describe('validate_username', () => {
	it('accepts letters, digits and underscore', () => {
		expect(validate_username('net_lox01').isValid).toBe(true);
	});

	it.each([
		['too short', 'ab'],
		['starts with a digit', '1admin'],
		['illegal chars', 'ad-min'],
		['too long', 'a'.repeat(51)],
	])('rejects %s', (_name, username) => {
		expect(validate_username(username).isValid).toBe(false);
	});
});

describe('validate_email', () => {
	it.each(['a@b.co', 'user.name+tag@example.io'])('accepts %s', e => {
		expect(validate_email(e)).toBe(true);
	});
	it.each(['plain', 'a@b', 'a b@c.d', '@x.y'])('rejects %s', e => {
		expect(validate_email(e)).toBe(false);
	});
});
