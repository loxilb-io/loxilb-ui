import {describe, expect, it} from 'vitest';
import {apiKeyFormToRequest, IApiKeyFormState, importedApiKeyError} from './ApiKeyInputForm';

const form = (overrides: Partial<IApiKeyFormState> = {}): IApiKeyFormState => ({
	mode: 'generate',
	api_key: '',
	tenant_id: 'tenant-a',
	name: '',
	allowed_models: '',
	rate_limit_rps: '0',
	burst_size: '0',
	tokens_per_min: '0',
	expires_at: '',
	enabled: true,
	...overrides,
});

describe('imported API key validation', () => {
	it('accepts the Gateway boundary lengths and printable non-space ASCII', () => {
		expect(importedApiKeyError('a'.repeat(16))).toBeUndefined();
		expect(importedApiKeyError('!'.repeat(512))).toBeUndefined();
	});

	it('rejects short, long, whitespace, control and non-ASCII material without echoing it', () => {
		const invalid = [
			'a'.repeat(15),
			'a'.repeat(513),
			'123456789012345 ',
			'123456789012345\n',
			'123456789012345한',
		];
		for (const secret of invalid) {
			const error = importedApiKeyError(secret);
			expect(error).toBeDefined();
			expect(error).not.toContain(secret);
		}
	});

	it('omits material in generate mode and includes it only for a valid import', () => {
		expect(apiKeyFormToRequest(form({api_key: 'valid-import-key'}))).not.toHaveProperty('api_key');
		expect(apiKeyFormToRequest(form({mode: 'import', api_key: 'valid-import-key'}))).toMatchObject({
			tenant_id: 'tenant-a',
			api_key: 'valid-import-key',
		});
		expect(apiKeyFormToRequest(form({mode: 'import', api_key: 'too-short'}))).not.toHaveProperty('api_key');
	});
});
