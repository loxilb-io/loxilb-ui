//---------------------------------------------------------
// A create is reported from the key's own read, not from the 201
//---------------------------------------------------------
import 'locales/i18n';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {IInstance} from 'types/oam';
import {ApiKeyCreateReadbackNote, readBackCreatedApiKey} from './apiKeyCreateReadback';

const api = vi.hoisted(() => ({query_get_apikey: vi.fn()}));
vi.mock('connector/instance/ai', () => api);

const instance = {id: 1, name: 'gateway'} as IInstance;
const request = {tenant_id: 'tenant-a', name: 'ci', rate_limit_rps: 10, enabled: true};

beforeEach(() => {
	api.query_get_apikey.mockReset();
});
afterEach(() => {
	cleanup();
});

describe('readBackCreatedApiKey', () => {
	it('reads the key the create named, and no other', async () => {
		api.query_get_apikey.mockResolvedValue({key_id: 'k1', ...request});
		expect(await readBackCreatedApiKey(instance, 'k1', request)).toBe('match');
		expect(api.query_get_apikey).toHaveBeenCalledOnce();
		expect(api.query_get_apikey).toHaveBeenCalledWith(instance, 'k1');
	});

	it('names the fields that were stored differently', async () => {
		api.query_get_apikey.mockResolvedValue({key_id: 'k1', tenant_id: 'tenant-a', name: 'ci', enabled: false});
		expect(await readBackCreatedApiKey(instance, 'k1', request)).toEqual(['rate_limit_rps', 'enabled']);
	});

	it('is `missing` when the gateway does not find the key it just named', async () => {
		api.query_get_apikey.mockResolvedValue(null);
		expect(await readBackCreatedApiKey(instance, 'k1', request)).toBe('missing');
	});

	it('is `unreadable`, not a match, when the read fails', async () => {
		api.query_get_apikey.mockRejectedValue(new Error('503'));
		expect(await readBackCreatedApiKey(instance, 'k1', request)).toBe('unreadable');
	});

	it('is `unreadable` when the read answers with another key', async () => {
		api.query_get_apikey.mockResolvedValue({key_id: 'k2', ...request});
		expect(await readBackCreatedApiKey(instance, 'k1', request)).toBe('unreadable');
	});

	it('reads nothing when the create named no key', async () => {
		expect(await readBackCreatedApiKey(instance, undefined, request)).toBe('unreadable');
		expect(await readBackCreatedApiKey(instance, '', request)).toBe('unreadable');
		expect(api.query_get_apikey).not.toHaveBeenCalled();
	});
});

describe('ApiKeyCreateReadbackNote', () => {
	it('says the values match only for a match', () => {
		render(<ApiKeyCreateReadbackNote readback="match" />);
		expect(screen.getByText('The gateway reads this key back with the values that were sent.')).toBeTruthy();
	});

	it('names the differing fields by their labels', () => {
		render(<ApiKeyCreateReadbackNote readback={['rate_limit_rps', 'expires_at']} />);
		expect(screen.getByText(/reads back something else for: Rate Limit \(req\/s\), Expires At\./)).toBeTruthy();
	});

	it('does not claim a match for a key that is missing or could not be read', () => {
		for (const readback of ['missing', 'unreadable'] as const) {
			render(<ApiKeyCreateReadbackNote readback={readback} />);
			expect(screen.queryByText(/with the values that were sent/)).toBeNull();
			cleanup();
		}
		render(<ApiKeyCreateReadbackNote readback="missing" />);
		expect(screen.getByText(/does not find it by its ID/)).toBeTruthy();
	});
});
